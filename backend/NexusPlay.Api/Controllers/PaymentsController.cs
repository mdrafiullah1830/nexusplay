using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/payments")]
public class PaymentsController : ControllerBase
{
    private readonly IOrderRepository _orders;
    private readonly IProductRepository _products;
    private readonly IPaymentService _payments;
    private readonly OrderEventService _events;

    public PaymentsController(IOrderRepository orders, IProductRepository products,
        IPaymentService payments, OrderEventService events)
    {
        _orders = orders;
        _products = products;
        _payments = payments;
        _events = events;
    }

    [HttpPost("initiate")]
    [AllowAnonymous]
    public async Task<ActionResult> Initiate(PlaceOrderRequest req, CancellationToken ct)
    {
        if (req.Customer is null || string.IsNullOrWhiteSpace(req.Customer.Name) ||
            string.IsNullOrWhiteSpace(req.Customer.Phone) ||
            string.IsNullOrWhiteSpace(req.Customer.Address))
            return BadRequest(new { message = "Customer name, phone and address are required" });

        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { message = "Cart is empty" });

        var gateway = req.PaymentGateway?.ToLowerInvariant();
        if (gateway is not ("sslcommerz" or "stripe") and not null)
            return BadRequest(new { message = "Payment gateway must be 'sslcommerz' or 'stripe'" });

        var items = new List<OrderItem>();
        foreach (var line in req.Items)
        {
            var qty = Math.Clamp(line.Qty, 1, 50);
            var product = await _products.GetAsync(line.ProductId, ct);
            if (product is null)
                return BadRequest(new { message = $"Product not found: {line.ProductId}" });

            if (product.Stock == "out-of-stock")
                return BadRequest(new { message = $"'{product.Name}' is out of stock" });

            items.Add(new OrderItem
            {
                ProductId = product.Id,
                Name = product.Name,
                Brand = product.Brand,
                Category = product.Category,
                Price = product.Price,
                Qty = qty,
                Colour = line.Colour,
            });
        }

        var subtotal = items.Sum(i => i.Price * i.Qty);
        var deliveryFee = subtotal >= 5000m ? 0m : 120m;
        var total = subtotal + deliveryFee;

        var orderNo = GenerateOrderNo();
        var order = new Order
        {
            OrderNo = orderNo,
            UserId = User.Identity?.IsAuthenticated == true
                ? User.FindFirstValue("sub")
                : null,
            Customer = new CustomerInfo
            {
                Name = req.Customer.Name.Trim(),
                Phone = req.Customer.Phone.Trim(),
                Email = req.Customer.Email?.Trim(),
                Address = req.Customer.Address.Trim(),
                City = req.Customer.City?.Trim(),
                Area = req.Customer.Area?.Trim(),
                Note = req.Customer.Note?.Trim(),
            },
            Items = items,
            Subtotal = subtotal,
            DeliveryFee = deliveryFee,
            Total = total,
            PaymentMethod = gateway == "stripe" ? "card" : "bkash",
            PaymentGateway = gateway,
            PaymentStatus = "payment-initiated",
            Status = "pending",
        };

        order.Tracking.Add(new TrackingEvent
        {
            Status = "pending",
            Note = "Order created — awaiting payment",
            At = DateTime.UtcNow,
        });

        await _orders.CreateAsync(order, ct);

        var baseUrl = $"{Request.Scheme}://{Request.Host}";
        var callbackUrl = $"{baseUrl}/api/payments/success?orderNo={orderNo}";
        var cancelUrl = $"{baseUrl}/api/payments/fail?orderNo={orderNo}";
        var ipnUrl = $"{baseUrl}/api/payments/webhook";

        var initiation = await _payments.InitiateAsync(order, callbackUrl, cancelUrl, ipnUrl, ct);

        if (!initiation.Success)
        {
            order.PaymentStatus = "failed";
            order.Status = "cancelled";
            order.Tracking.Add(new TrackingEvent
            {
                Status = "cancelled",
                Note = $"Payment initiation failed: {initiation.Error}",
                At = DateTime.UtcNow,
            });
            await _orders.UpdateAsync(order, ct);

            return BadRequest(new { message = initiation.Error ?? "Payment initiation failed" });
        }

        return Ok(new
        {
            orderNo,
            gatewayUrl = initiation.GatewayUrl,
            sessionId = initiation.SessionId,
            total,
        });
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    public async Task<ActionResult> Webhook(CancellationToken ct)
    {
        var form = Request.Form;
        var payload = form.Keys.ToDictionary(k => k, k => form[k]!.ToString());

        var isValid = await _payments.ProcessIpnAsync(payload, ct);
        if (!isValid)
            return BadRequest(new { message = "Invalid IPN payload" });

        if (!payload.TryGetValue("tran_id", out var orderNo) ||
            !payload.TryGetValue("status", out var status) ||
            !payload.TryGetValue("val_id", out var valId))
        {
            return BadRequest(new { message = "Missing IPN fields" });
        }

        var order = await _orders.FindByOrderNoAsync(orderNo!, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        var isPaid = string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase) ||
                     string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase);

        if (isPaid && order.PaymentStatus != "paid")
        {
            order.PaymentStatus = "paid";
            order.GatewayTransactionId = valId;
            order.Status = "confirmed";
            order.Tracking.Add(new TrackingEvent
            {
                Status = "confirmed",
                Note = "Payment confirmed via gateway",
                At = DateTime.UtcNow,
            });
        }
        else if (!isPaid && order.PaymentStatus != "failed")
        {
            order.PaymentStatus = "failed";
            order.Status = "cancelled";
            order.Tracking.Add(new TrackingEvent
            {
                Status = "cancelled",
                Note = "Payment failed via gateway",
                At = DateTime.UtcNow,
            });
        }

        await _orders.UpdateAsync(order, ct);

        // Publish real-time SSE event
        _events.Publish(order.OrderNo, order.Status,
            order.PaymentStatus == "paid" ? "Payment confirmed via gateway" : "Payment failed via gateway");

        return Ok(new { received = true });
    }

    [HttpGet("success")]
    [AllowAnonymous]
    public async Task<ActionResult> Success([FromQuery] string orderNo, [FromQuery] string? val_id, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        if (!string.IsNullOrEmpty(val_id))
        {
            var verify = await _payments.VerifyAsync(val_id, ct);
            if (verify.Success)
            {
                order.PaymentStatus = "paid";
                order.GatewayTransactionId = val_id;
                order.Status = "confirmed";
                order.Tracking.Add(new TrackingEvent
                {
                    Status = "confirmed",
                    Note = "Payment verified on return",
                    At = DateTime.UtcNow,
                });
                await _orders.UpdateAsync(order, ct);

                // Publish real-time SSE event
                _events.Publish(order.OrderNo, order.Status, "Payment verified on return");
            }
        }

        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            total = order.Total,
            message = order.PaymentStatus == "paid"
                ? "Payment successful! Your order is confirmed."
                : "Payment pending. Please check your order status.",
        });
    }

    [HttpGet("fail")]
    [AllowAnonymous]
    public async Task<ActionResult> Fail([FromQuery] string orderNo, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        if (order.PaymentStatus != "failed")
        {
            order.PaymentStatus = "failed";
            order.Status = "cancelled";
            order.Tracking.Add(new TrackingEvent
            {
                Status = "cancelled",
                Note = "Payment cancelled by user",
                At = DateTime.UtcNow,
            });
            await _orders.UpdateAsync(order, ct);
        }

        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            message = "Payment was cancelled or failed. You can try again.",
        });
    }

    [HttpGet("verify/{orderNo}")]
    [AllowAnonymous]
    public async Task<ActionResult> Verify(string orderNo, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            gatewayTransactionId = order.GatewayTransactionId,
        });
    }

    private static string GenerateOrderNo()
    {
        var stamp = DateTime.UtcNow.ToString("yyMMdd");
        var suffix = Random.Shared.Next(1000, 10000);
        return $"NP{stamp}{suffix}";
    }
}