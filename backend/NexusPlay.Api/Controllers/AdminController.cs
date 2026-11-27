using System.IO;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/admin")]
[Authorize(Roles = "admin")]
public class AdminController : ControllerBase
{
    private readonly IProductRepository _products;
    private readonly IOrderRepository _orders;
    private readonly IWebHostEnvironment _env;
    private readonly OrderEventService _events;
    private readonly IConfiguration _config;
    private readonly IHttpClientFactory _httpClients;

    private static readonly HashSet<string> ValidStatuses = new()
    {
        "pending", "awaiting-verification", "confirmed", "shipped", "delivered", "cancelled",
    };

    public AdminController(IProductRepository products, IOrderRepository orders,
        IWebHostEnvironment env, OrderEventService events, IConfiguration config,
        IHttpClientFactory httpClients)
    {
        _products = products;
        _orders = orders;
        _env = env;
        _events = events;
        _config = config;
        _httpClients = httpClients;
    }

    // -- Dashboard ------------------------------------------------

    [HttpGet("stats")]
    public async Task<ActionResult<object>> Stats(CancellationToken ct)
    {
        return Ok(new
        {
            totalProducts = await _products.CountAsync(ct),
            totalOrders = await _orders.CountAsync(ct),
            pendingOrders = await _orders.CountByStatusAsync("pending", ct),
            awaitingVerification = await _orders.CountByStatusAsync("awaiting-verification", ct),
            delivered = await _orders.CountByStatusAsync("delivered", ct),
            revenue = await _orders.RevenueAsync(ct),
        });
    }

    // -- Products -------------------------------------------------

    [HttpGet("products")]
    public async Task<ActionResult<PagedResult<Product>>> Products([FromQuery] string? search,
        CancellationToken ct)
    {
        var result = await _products.SearchAsync(new ProductQuery
        {
            Q = search,
            Sort = "newest",
            Page = 1,
            PageSize = 100,
        }, ct);
        return Ok(result);
    }

    [HttpPost("products")]
    public async Task<ActionResult<Product>> Create(Product product, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(product.Name))
            return BadRequest(new { message = "Name is required" });

        product.Id = string.Empty; // let Mongo assign
        var created = await _products.CreateAsync(product, ct);
        return CreatedAtAction(nameof(Create), new { id = created.Id }, created);
    }

    [HttpPut("products/{id}")]
    public async Task<ActionResult<Product>> Update(string id, Product product, CancellationToken ct)
    {
        product.Id = id;
        var ok = await _products.ReplaceAsync(product, ct);
        return ok ? Ok(product) : NotFound(new { message = "Product not found" });
    }

    [HttpDelete("products/{id}")]
    public async Task<IActionResult> Delete(string id, CancellationToken ct)
    {
        var ok = await _products.DeleteAsync(id, ct);
        return ok ? NoContent() : NotFound(new { message = "Product not found" });
    }

    // -- Product Images -------------------------------------------

    [HttpPost("products/{id}/images")]
    public async Task<ActionResult<Product>> UploadImages(string id, IFormFileCollection files, CancellationToken ct)
    {
        var product = await _products.GetAsync(id, ct);
        if (product is null) return NotFound(new { message = "Product not found" });

        var gateway = _config["D1:GatewayUrl"];
        var uploadsDir = Path.Combine(_env.ContentRootPath, "wwwroot", "uploads", "products");
        if (string.IsNullOrWhiteSpace(gateway)) Directory.CreateDirectory(uploadsDir);

        foreach (var file in files)
        {
            if (file.Length == 0) continue;
            var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (ext is not (".jpg" or ".jpeg" or ".png" or ".webp"))
                return BadRequest(new { message = $"Unsupported file type: {ext}" });
            if (file.Length > 5_000_000)
                return BadRequest(new { message = "Images must be under 5 MB" });

            var fileName = $"{Guid.NewGuid():N}{ext}";
            if (!string.IsNullOrWhiteSpace(gateway))
            {
                using var client = _httpClients.CreateClient();
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _config["D1:Token"]);
                await using var stream = file.OpenReadStream();
                using var content = new StreamContent(stream);
                content.Headers.ContentType = new MediaTypeHeaderValue(file.ContentType);
                using var response = await client.PutAsync($"{gateway.TrimEnd('/')}/images/{fileName}", content, ct);
                response.EnsureSuccessStatusCode();
                var uploaded = await response.Content.ReadFromJsonAsync<UploadedImage>(cancellationToken: ct);
                product.ImageUrls.Add(uploaded?.Url ?? throw new InvalidOperationException("Missing R2 image URL"));
            }
            else
            {
                var filePath = Path.Combine(uploadsDir, fileName);
                await using var fs = new FileStream(filePath, FileMode.Create);
                await file.CopyToAsync(fs, ct);
                product.ImageUrls.Add($"/uploads/products/{fileName}");
            }
        }

        var ok = await _products.ReplaceAsync(product, ct);
        return ok ? Ok(product) : NotFound(new { message = "Product not found" });
    }

    private sealed record UploadedImage(string Url);

    // -- Orders ---------------------------------------------------

    [HttpGet("orders")]
    public async Task<ActionResult<PagedResult<Order>>> Orders([FromQuery] OrderQuery query,
        CancellationToken ct)
    {
        var result = await _orders.SearchAsync(query, ct);
        return Ok(result);
    }

    /// <summary>Updates order status (and appends a tracking event).</summary>
    [HttpPut("orders/{id}/status")]
    public async Task<ActionResult<Order>> UpdateStatus(string id, StatusUpdateRequest req,
        CancellationToken ct)
    {
        if (!ValidStatuses.Contains(req.Status))
            return BadRequest(new { message = $"Invalid status '{req.Status}'" });

        var order = await _orders.GetAsync(id, ct);
        if (order is null) return NotFound(new { message = "Order not found" });

        order.Status = req.Status;
        order.Tracking.Add(new TrackingEvent
        {
            Status = req.Status,
            Note = req.Note,
            At = DateTime.UtcNow,
        });

        await _orders.UpdateAsync(order, ct);

        // Publish real-time SSE event to order tracking subscribers
        _events.Publish(order.OrderNo, req.Status, req.Note);

        return Ok(order);
    }
}
