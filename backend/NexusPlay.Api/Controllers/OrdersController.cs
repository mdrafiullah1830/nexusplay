using System.Net;
using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly IOrderRepository _orders;
    private readonly IProductRepository _products;
    private readonly OrderEventService _events;
    private readonly IEmailService _emails;
    private readonly ISmsService _sms;

    private const decimal FreeDeliveryThreshold = 5000m;
    private const decimal StandardDeliveryFee = 120m;

    public OrdersController(IOrderRepository orders, IProductRepository products,
        OrderEventService events, IEmailService emails, ISmsService sms)
    {
        _orders = orders;
        _products = products;
        _events = events;
        _emails = emails;
        _sms = sms;
    }

    [HttpPost]
    [EnableRateLimiting("OrderPolicy")]
    public async Task<ActionResult<Order>> Place(PlaceOrderRequest req, CancellationToken ct)
    {
        if (req.Customer is null || string.IsNullOrWhiteSpace(req.Customer.Name) ||
            string.IsNullOrWhiteSpace(req.Customer.Phone) ||
            string.IsNullOrWhiteSpace(req.Customer.Address))
            return BadRequest(new { message = "Customer name, phone and address are required" });

        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { message = "Cart is empty" });

        var normalizedPhone = NormalizePhone(req.Customer.Phone);
        if (normalizedPhone.Length != 11 ||
            !normalizedPhone.StartsWith("01", StringComparison.Ordinal) ||
            normalizedPhone[2] is < '3' or > '9')
            return BadRequest(new { message = "A valid Bangladeshi mobile number is required" });

        var method = req.PaymentMethod?.Trim().ToLowerInvariant();
        if (method is not ("cod" or "bkash"))
            return BadRequest(new { message = "Payment method must be 'cod' or 'bkash'" });

        if (method == "bkash" && string.IsNullOrWhiteSpace(req.BkashTrxId))
            return BadRequest(new { message = "bKash transaction ID is required" });

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
        var deliveryFee = subtotal >= FreeDeliveryThreshold ? 0m : StandardDeliveryFee;

        var order = new Order
        {
            OrderNo = GenerateOrderNo(),
            UserId = User.Identity?.IsAuthenticated == true ? User.FindFirstValue("sub") : null,
            Customer = new CustomerInfo
            {
                Name = req.Customer.Name.Trim(),
                Phone = normalizedPhone,
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
            PaymentMethod = method,
            BkashTrxId = method == "bkash" ? req.BkashTrxId?.Trim() : null,
            Status = method == "bkash" ? "awaiting-verification" : "pending",
        };

        order.Tracking.Add(new TrackingEvent
        {
            Status = order.Status,
            Note = method == "bkash"
                ? "bKash payment submitted — awaiting verification"
                : "Order placed (Cash on Delivery)",
            At = DateTime.UtcNow,
        });

        await _orders.CreateAsync(order, ct);
        await SendOrderConfirmation(order, ct);

        return CreatedAtAction(nameof(Track), new { orderNo = order.OrderNo }, order);
    }

    private async Task SendOrderConfirmation(Order order, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(order.Customer.Email))
        {
            static string Encode(string? value) => WebUtility.HtmlEncode(value ?? string.Empty);
            var customerName = Encode(order.Customer.Name);
            var orderNo = Encode(order.OrderNo);
            var paymentMethod = Encode(order.PaymentMethod);
            var address = Encode(order.Customer.Address);
            var city = Encode(order.Customer.City);
            var area = Encode(order.Customer.Area);
            var customerEmail = Encode(order.Customer.Email);

            var body = $"""
                <html>
                  <body>
                    <h2>Thank you for your order, {customerName}!</h2>
                    <p>Your order has been received.</p>
                    <table style="border-collapse:collapse;width:100%;margin:20px 0;">
                      <tr><td><strong>Order Number</strong></td><td>{orderNo}</td></tr>
                      <tr><td><strong>Payment Method</strong></td><td>{paymentMethod}</td></tr>
                      <tr><td><strong>Total</strong></td><td>BDT {order.Total:N2}</td></tr>
                    </table>
                    <p><strong>Delivery:</strong> {address}{(string.IsNullOrEmpty(city) ? "" : $", {city}")}{(string.IsNullOrEmpty(area) ? "" : $", {area}")}</p>
                    <p><strong>Contact:</strong> {customerEmail}</p>
                  </body>
                </html>
                """;

            await _emails.SendAsync(order.Customer.Email, "NexusPlay Order Confirmation", body, ct);
        }

        if (!string.IsNullOrWhiteSpace(order.Customer.Phone))
        {
            var smsBody = $"NexusPlay order received: {order.OrderNo}. Total BDT {order.Total:N2}.";
            await _sms.SendAsync(order.Customer.Phone, smsBody, ct);
        }
    }

    [HttpGet("track")]
    public async Task<ActionResult<Order>> Track(
        [FromQuery] string orderNo, [FromQuery] string phone, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(orderNo) || string.IsNullOrWhiteSpace(phone))
            return BadRequest(new { message = "orderNo and phone are required" });

        var order = await _orders.FindAsync(orderNo, phone, ct);
        return order is null
            ? NotFound(new { message = "No order found for that order number and phone number" })
            : Ok(order);
    }

    [HttpGet("track/stream/{orderNo}")]
    [AllowAnonymous]
    public async Task Stream(string orderNo, CancellationToken ct)
    {
        var order = await _orders.FindByOrderNoAsync(orderNo, ct);
        if (order is null)
        {
            HttpContext.Response.StatusCode = StatusCodes.Status404NotFound;
            await HttpContext.Response.WriteAsync("Order not found", ct);
            return;
        }

        HttpContext.Response.StatusCode = StatusCodes.Status200OK;
        HttpContext.Response.Headers["Content-Type"] = "text/event-stream";
        HttpContext.Response.Headers["Cache-Control"] = "no-cache";
        HttpContext.Response.Headers["Connection"] = "keep-alive";
        HttpContext.Response.Headers["X-Accel-Buffering"] = "no";

        var initialPayload = JsonSerializer.Serialize(new
        {
            status = order.Status,
            note = "Stream connected",
            at = DateTime.UtcNow,
        });
        await HttpContext.Response.WriteAsync($"event: order-status\ndata: {initialPayload}\n\n", ct);
        await HttpContext.Response.Body.FlushAsync(ct);

        await foreach (var evt in _events.SubscribeAsync(orderNo, ct))
        {
            await HttpContext.Response.WriteAsync(evt, ct);
            await HttpContext.Response.Body.FlushAsync(ct);
        }
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<ActionResult<PagedResult<Order>>> My(
        [FromQuery] int page = 1, [FromQuery] int pageSize = 20, CancellationToken ct = default)
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var mine = await _orders.SearchForUserAsync(userId, page, pageSize, ct);
        return Ok(mine);
    }

    private static string NormalizePhone(string phone) =>
        new(phone.Where(char.IsDigit).ToArray());

    private static string GenerateOrderNo()
    {
        var stamp = DateTime.UtcNow.ToString("yyMMdd");
        var suffix = Convert.ToHexString(System.Security.Cryptography.RandomNumberGenerator.GetBytes(8));
        return $"NP{stamp}{suffix}";
    }
}