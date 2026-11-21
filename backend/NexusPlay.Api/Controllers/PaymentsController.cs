using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
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
    private readonly IConfiguration _config;

    public PaymentsController(IOrderRepository orders, IProductRepository products,
        IPaymentService payments, OrderEventService events, IConfiguration config)
    {
        _orders = orders;
        _products = products;
        _payments = payments;
        _events = events;
        _config = config;
    }

    [HttpPost("initiate")]
    [AllowAnonymous]
    [EnableRateLimiting("OrderPolicy")]
    public async Task<ActionResult> Initiate(PlaceOrderRequest req, CancellationToken ct)
    {
        if (req.Customer is null || string.IsNullOrWhiteSpace(req.Customer.Name) ||
            string.IsNullOrWhiteSpace(req.Customer.Phone) ||
            string.IsNullOrWhiteSpace(req.Customer.Address))
            return BadRequest(new { message = "Customer name, phone and address are required" });

        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { message = "Cart is empty" });

        if (string.IsNullOrWhiteSpace(req.Customer.Email) ||
            req.Customer.Email.Length > 50 ||
            !System.Net.Mail.MailAddress.TryCreate(req.Customer.Email, out _))
            return BadRequest(new { message = "A valid email address (maximum 50 characters) is required for card payments." });

        if (req.Customer.Name.Length > 50 || req.Customer.Address.Length > 50 ||
            (req.Customer.City?.Length ?? 0) > 50)
            return BadRequest(new { message = "Customer name, address and city must each be 50 characters or fewer for card payments." });

        if (!string.Equals(req.PaymentMethod, "card", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { message = "This endpoint is only for card gateway payments." });

        var gateway = req.PaymentGateway?.Trim().ToLowerInvariant() ?? "sslcommerz";
        if (gateway != "sslcommerz")
            return BadRequest(new { message = "Only SSLCOMMERZ is currently supported." });

        var phone = NormalizePhone(req.Customer.Phone);
        if (phone.Length != 11 || !phone.StartsWith("01", StringComparison.Ordinal) ||
            phone[2] is < '3' or > '9')
            return BadRequest(new { message = "A valid Bangladeshi mobile number is required" });

        var items = new List<OrderItem>();
        foreach (var line in req.Items)
        {
            if (string.IsNullOrWhiteSpace(line.ProductId) || line.Qty < 1 || line.Qty > 50)
                return BadRequest(new { message = "Each cart item must have a valid product and quantity (1–50)" });

            var product = await _products.GetAsync(line.ProductId, ct);
            if (product is null)
                return BadRequest(new { message = "One or more selected products are unavailable" });

            if (product.Stock == "out-of-stock")
                return BadRequest(new { message = $"'{product.Name}' is out of stock" });

            items.Add(new OrderItem
            {
                ProductId = product.Id,
                Name = product.Name,
                Brand = product.Brand,
                Category = product.Category,
                Price = product.Price,
                Qty = line.Qty,
                Colour = line.Colour,
            });
        }

        var subtotal = items.Sum(item => item.Price * item.Qty);
        var deliveryFee = subtotal >= 5000m ? 0m : 120m;
        var order = new Order
        {
            OrderNo = GenerateOrderNo(),
            UserId = User.Identity?.IsAuthenticated == true ? User.FindFirst("sub")?.Value : null,
            Customer = new CustomerInfo
            {
                Name = req.Customer.Name.Trim(),
                Phone = phone,
                Email = req.Customer.Email?.Trim(),
                Address = req.Customer.Address.Trim(),
                City = req.Customer.City?.Trim(),
                Area = req.Customer.Area?.Trim(),
                Note = req.Customer.Note?.Trim(),
            },
            Items = items,
            Subtotal = subtotal,
            DeliveryFee = deliveryFee,
            Total = subtotal + deliveryFee,
            PaymentMethod = "card",
            PaymentGateway = "sslcommerz",
            PaymentStatus = "payment-initiated",
            Status = "pending",
        };

        order.Tracking.Add(new TrackingEvent
        {
            Status = "pending",
            Note = "Order created — awaiting secure payment",
            At = DateTime.UtcNow,
        });
        await _orders.CreateAsync(order, ct);

        var configuredPublicUrl = _config["App:PublicUrl"]?.TrimEnd('/');
        var baseUrl = string.IsNullOrWhiteSpace(configuredPublicUrl)
            ? $"{Request.Scheme}://{Request.Host}"
            : configuredPublicUrl;
        var callbackUrl = $"{baseUrl}/api/payments/success?orderNo={Uri.EscapeDataString(order.OrderNo)}";
        var cancelUrl = $"{baseUrl}/api/payments/fail?orderNo={Uri.EscapeDataString(order.OrderNo)}";
        var ipnUrl = $"{baseUrl}/api/payments/webhook";

        var initiation = await _payments.InitiateAsync(order, callbackUrl, cancelUrl, ipnUrl, ct);
        if (!initiation.Success || string.IsNullOrWhiteSpace(initiation.GatewayUrl))
        {
            order.PaymentStatus = "failed";
            order.Status = "cancelled";
            order.Tracking.Add(new TrackingEvent
            {
                Status = "cancelled",
                Note = "Payment session could not be created",
                At = DateTime.UtcNow,
            });
            await _orders.UpdateAsync(order, ct);
            return BadRequest(new { message = initiation.Error ?? "Payment initiation failed" });
        }

        return Ok(new
        {
            orderNo = order.OrderNo,
            gatewayUrl = initiation.GatewayUrl,
            sessionId = initiation.SessionId,
            total = order.Total,
        });
    }

    [HttpPost("webhook")]
    [AllowAnonymous]
    [EnableRateLimiting("OrderPolicy")]
    public async Task<ActionResult> Webhook(CancellationToken ct)
    {
        if (!Request.HasFormContentType)
            return BadRequest(new { message = "Invalid IPN content type" });

        var form = await Request.ReadFormAsync(ct);
        var payload = form.Keys.ToDictionary(
            key => key, key => form[key].ToString(), StringComparer.OrdinalIgnoreCase);

        var verification = await _payments.ProcessIpnAsync(payload, ct);
        if (!verification.Success)
            return BadRequest(new { message = "Payment notification could not be verified" });

        var order = await _orders.FindByOrderNoAsync(verification.OrderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        if (!MatchesOrder(order, verification))
            return BadRequest(new { message = "Verified transaction does not match this order" });

        if (order.PaymentStatus == "paid")
        {
            return string.Equals(order.GatewayTransactionId, verification.TransactionId, StringComparison.Ordinal)
                ? Ok(new { received = true })
                : Conflict(new { message = "A different transaction has already paid this order" });
        }

        if (order.PaymentStatus != "payment-initiated")
            return Conflict(new { message = "This order is not awaiting gateway payment" });

        await MarkPaidAsync(order, verification.TransactionId, "Payment confirmed by verified gateway notification", ct);
        return Ok(new { received = true });
    }

    [HttpGet("success")]
    [AllowAnonymous]
    public async Task<ActionResult> Success(
        [FromQuery] string orderNo, [FromQuery(Name = "val_id")] string? validationId,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(orderNo) || string.IsNullOrWhiteSpace(validationId))
            return BadRequest(new { message = "Missing payment confirmation details" });

        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        var verification = await _payments.VerifyAsync(validationId, ct);
        if (!MatchesOrder(order, verification))
            return BadRequest(new { message = "Payment could not be verified for this order" });

        if (order.PaymentStatus == "paid")
        {
            if (!string.Equals(order.GatewayTransactionId, verification.TransactionId, StringComparison.Ordinal))
                return Conflict(new { message = "A different transaction has already paid this order" });
        }
        else if (order.PaymentStatus == "payment-initiated")
        {
            await MarkPaidAsync(order, verification.TransactionId, "Payment verified on gateway return", ct);
        }
        else
        {
            return Conflict(new { message = "This order is no longer awaiting payment" });
        }

        var frontendUrl = _config["App:FrontendUrl"]?.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(frontendUrl))
            return Redirect($"{frontendUrl}/track.html?orderNo={Uri.EscapeDataString(order.OrderNo)}&payment=success");

        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            total = order.Total,
            message = "Payment successful. Your order is confirmed.",
        });
    }

    [HttpGet("fail")]
    [AllowAnonymous]
    public async Task<ActionResult> Fail([FromQuery] string orderNo, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        // A browser redirect is not proof of a failed transaction. Only a
        // verified gateway notification may change the persisted payment state.
        var frontendUrl = _config["App:FrontendUrl"]?.TrimEnd('/');
        if (!string.IsNullOrWhiteSpace(frontendUrl))
            return Redirect($"{frontendUrl}/track.html?orderNo={Uri.EscapeDataString(order.OrderNo)}&payment=pending");

        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            message = "Payment was not confirmed. You may retry from your order details.",
        });
    }

    [HttpGet("verify/{orderNo}")]
    [AllowAnonymous]
    public async Task<ActionResult> Verify(string orderNo, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
            return NotFound(new { message = "Order not found" });

        // Never expose gateway validation IDs or bank transaction references.
        return Ok(new
        {
            orderNo = order.OrderNo,
            status = order.Status,
            paymentStatus = order.PaymentStatus,
            total = order.Total,
        });
    }

    private async Task MarkPaidAsync(
        Order order, string transactionId, string note, CancellationToken ct)
    {
        order.PaymentStatus = "paid";
        order.GatewayTransactionId = transactionId;
        order.Status = "confirmed";
        order.Tracking.Add(new TrackingEvent
        {
            Status = "confirmed",
            Note = note,
            At = DateTime.UtcNow,
        });

        await _orders.UpdateAsync(order, ct);
        _events.Publish(order.OrderNo, order.Status, note);
    }

    private static bool MatchesOrder(Order order, PaymentVerificationResult verification) =>
        verification.Success &&
        string.Equals(verification.OrderNo, order.OrderNo, StringComparison.Ordinal) &&
        string.Equals(verification.Currency, "BDT", StringComparison.OrdinalIgnoreCase) &&
        verification.RiskLevel == "0" &&
        Math.Abs(verification.Amount - order.Total) < 0.01m &&
        order.PaymentGateway == "sslcommerz";

    private static string NormalizePhone(string phone) =>
        new(phone.Where(char.IsDigit).ToArray());

    private static string GenerateOrderNo()
    {
        var stamp = DateTime.UtcNow.ToString("yyMMdd");
        var suffix = Convert.ToHexString(RandomNumberGenerator.GetBytes(8));
        return $"NP{stamp}{suffix}";
    }
}