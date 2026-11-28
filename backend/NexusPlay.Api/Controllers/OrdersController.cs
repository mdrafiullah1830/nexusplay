using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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
    private readonly ILogger<OrdersController> _logger;

    private const decimal FreeDeliveryThreshold = 5000;
    private const decimal StandardDeliveryFee = 120;

    public OrdersController(IOrderRepository orders, IProductRepository products,
        OrderEventService events, IEmailService emails, ISmsService sms,
        ILogger<OrdersController> logger)
    {
        _orders = orders;
        _products = products;
        _events = events;
        _emails = emails;
        _sms = sms;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<Order>> Place(PlaceOrderRequest req, CancellationToken ct)
    {
        if (req.Customer is null || string.IsNullOrWhiteSpace(req.Customer.Name) ||
            string.IsNullOrWhiteSpace(req.Customer.Phone) ||
            string.IsNullOrWhiteSpace(req.Customer.Address))
            return BadRequest(new { message = "Customer name, phone and address are required" });

        if (req.Items is null || req.Items.Count == 0)
            return BadRequest(new { message = "Cart is empty" });

        var method = req.PaymentMethod?.ToLowerInvariant();
        if (method is not ("cod" or "bkash"))
            return BadRequest(new { message = "Payment method must be 'cod' or 'bkash'" });

        if (method == "bkash" && string.IsNullOrWhiteSpace(req.BkashTrxId))
            return BadRequest(new { message = "bKash transaction ID is required" });

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
        var deliveryFee = subtotal >= FreeDeliveryThreshold ? 0 : StandardDeliveryFee;

        var order = new Order
        {
            OrderNo = GenerateOrderNo(),
            UserId = User.Identity?.IsAuthenticated == true
                ? (User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier))
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

        // Send confirmation email & SMS
        try
        {
            await SendOrderConfirmation(order);
        }
        catch (Exception ex)
        {
            // The order is already stored; a notification failure must not
            // make the customer retry and create a second order.
            _logger.LogWarning(ex, "Order confirmation failed for {OrderNo}", order.OrderNo);
        }

        return CreatedAtAction(nameof(Track), new { orderNo = order.OrderNo }, order);
    }

    private async Task SendOrderConfirmation(Order order)
    {
        var email = order.Customer.Email;
        var phone = order.Customer.Phone;

        // Email confirmation
        if (!string.IsNullOrEmpty(email))
        {
            var subject = "CtrlZoneBD Order Confirmation";
            var customerName = System.Net.WebUtility.HtmlEncode(order.Customer.Name);
            var address = System.Net.WebUtility.HtmlEncode(order.Customer.Address);
            var city = System.Net.WebUtility.HtmlEncode(order.Customer.City);
            var area = System.Net.WebUtility.HtmlEncode(order.Customer.Area);
            var contact = System.Net.WebUtility.HtmlEncode(order.Customer.Email);
            var body = $"""
               <html>
                 <body>
                   <h2>🎉 Thank you for your order, {customerName}!</h2>
                   <p>Your order has been received.</p>
                   <table style="border-collapse: collapse; width: 100%; margin: 20px 0;">
                     <tr><td style="padding: 8px;"><strong>Order Number</strong></td><td style="padding: 8px;"><strong>{order.OrderNo}</strong></td></tr>
                     <tr><td style="padding: 8px;"><strong>Payment Method</strong></td><td style="padding: 8px;">{order.PaymentMethod}</td></tr>
                     <tr><td style="padding: 8px;"><strong>Total</strong></td><td style="padding: 8px;">BDT {order.Total:N2}</td></tr>
                   </table>
                   <p><strong>Track your order:</strong> <a href="https://ctrlzonebd.com/track.html?orderNo={order.OrderNo}">https://ctrlzonebd.com/track.html?orderNo={order.OrderNo}</a></p>
                   <p><strong>Delivery:</strong> {address}{(order.Customer.City != null ? $", {city}" : "")}{(order.Customer.Area != null ? $", {area}" : "")}</p>
                   {(order.Customer.Email != null ? $"<p><strong>Contact:</strong> {contact}</p>" : "")}
                 </body>
               </html>
               """;

            await _emails.SendAsync(email, subject, body);
        }

        // SMS confirmation
        if (!string.IsNullOrEmpty(phone))
        {
            var smsBody = $"CtrlZoneBD Order Confirmed: {order.OrderNo} · Total BDT {order.Total:N2}";
            await _sms.SendAsync(phone, smsBody);
        }
    }

    [HttpGet("track")]
    public async Task<ActionResult<Order>> Track([FromQuery] string orderNo,
        [FromQuery] string phone, CancellationToken ct)
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
            HttpContext.Response.StatusCode = 404;
            await HttpContext.Response.WriteAsync("Order not found", ct);
            return;
        }

        HttpContext.Response.StatusCode = 200;
        HttpContext.Response.Headers["Content-Type"] = "text/event-stream";
        HttpContext.Response.Headers["Cache-Control"] = "no-cache";
        HttpContext.Response.Headers["Connection"] = "keep-alive";
        HttpContext.Response.Headers["X-Accel-Buffering"] = "no";

        var initial = "event: order-status" + "\n" +
                      "data: {\"status\":\"" + order.Status +
                      "\",\"note\":\"Stream connected\",\"at\":\"" + DateTime.UtcNow.ToString("o") + "\"}" + "\n\n";
        await HttpContext.Response.WriteAsync(initial, ct);
        await HttpContext.Response.Body.FlushAsync(ct);

        await foreach (var evt in _events.SubscribeAsync(orderNo, ct))
        {
            await HttpContext.Response.WriteAsync(evt, ct);
            await HttpContext.Response.Body.FlushAsync(ct);
        }
    }

    [Authorize]
    [HttpGet("my")]
    public async Task<ActionResult<PagedResult<Order>>> My([FromQuery] int page = 1,
        CancellationToken ct = default)
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        return Ok(await _orders.SearchAsync(new OrderQuery { UserId = userId, Page = page, PageSize = 20 }, ct));
    }

    private static string GenerateOrderNo()
    {
        var stamp = DateTime.UtcNow.ToString("yyMMdd");
        var suffix = Random.Shared.Next(1000, 10000);
        return $"NP{stamp}{suffix}";
    }
}
