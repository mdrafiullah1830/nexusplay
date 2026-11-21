using System.IO;
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
    private readonly string _uploadsDirectory;
    private readonly OrderEventService _events;

    private static readonly HashSet<string> ValidStatuses = new()
    {
        "pending", "awaiting-verification", "confirmed", "shipped", "delivered", "cancelled",
    };

    public AdminController(IProductRepository products, IOrderRepository orders,
        IWebHostEnvironment env, OrderEventService events, IConfiguration config)
    {
        _products = products;
        _orders = orders;
        _events = events;
        _uploadsDirectory = config["Storage:UploadsPath"] ??
            Path.Combine(env.WebRootPath ?? Path.Combine(env.ContentRootPath, "wwwroot"),
                "uploads", "products");
    }

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

    [HttpGet("products")]
    public async Task<ActionResult<PagedResult<Product>>> Products(
        [FromQuery] string? search, CancellationToken ct)
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

        product.Id = Guid.NewGuid().ToString("N");
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

    [HttpPost("products/{id}/images")]
    [RequestSizeLimit(25 * 1024 * 1024)]
    public async Task<ActionResult<Product>> UploadImages(
        string id, IFormFileCollection files, CancellationToken ct)
    {
        var product = await _products.GetAsync(id, ct);
        if (product is null) return NotFound(new { message = "Product not found" });
        if (files.Count is < 1 or > 5)
            return BadRequest(new { message = "Upload between 1 and 5 images at a time." });

        Directory.CreateDirectory(_uploadsDirectory);
        product.ImageUrls ??= new List<string>();

        foreach (var file in files)
        {
            if (file.Length is <= 0 or > 5 * 1024 * 1024)
                return BadRequest(new { message = "Each image must be between 1 byte and 5 MB." });

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            if (extension is not (".jpg" or ".jpeg" or ".png" or ".webp") ||
                !await HasValidImageSignatureAsync(file, extension, ct))
            {
                return BadRequest(new { message = "Only valid JPG, PNG or WEBP images are accepted." });
            }

            var fileName = $"{Guid.NewGuid():N}{extension}";
            var filePath = Path.Combine(_uploadsDirectory, fileName);
            await using (var stream = new FileStream(filePath, FileMode.CreateNew,
                FileAccess.Write, FileShare.None, 81920, FileOptions.Asynchronous))
            {
                await file.CopyToAsync(stream, ct);
            }

            product.ImageUrls.Add($"/uploads/products/{fileName}");
        }

        var updated = await _products.ReplaceAsync(product, ct);
        return updated ? Ok(product) : NotFound(new { message = "Product not found" });
    }

    private static async Task<bool> HasValidImageSignatureAsync(
        IFormFile file, string extension, CancellationToken ct)
    {
        var header = new byte[12];
        await using var stream = file.OpenReadStream();
        var read = await stream.ReadAsync(header.AsMemory(0, header.Length), ct);

        return extension switch
        {
            ".jpg" or ".jpeg" => read >= 3 &&
                header[0] == 0xFF && header[1] == 0xD8 && header[2] == 0xFF,
            ".png" => read >= 8 &&
                header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E &&
                header[3] == 0x47 && header[4] == 0x0D && header[5] == 0x0A &&
                header[6] == 0x1A && header[7] == 0x0A,
            ".webp" => read >= 12 &&
                header[0] == (byte)'R' && header[1] == (byte)'I' &&
                header[2] == (byte)'F' && header[3] == (byte)'F' &&
                header[8] == (byte)'W' && header[9] == (byte)'E' &&
                header[10] == (byte)'B' && header[11] == (byte)'P',
            _ => false,
        };
    }

    [HttpGet("orders")]
    public async Task<ActionResult<PagedResult<Order>>> Orders(
        [FromQuery] OrderQuery query, CancellationToken ct)
    {
        var result = await _orders.SearchAsync(query, ct);
        return Ok(result);
    }

    [HttpPut("orders/{id}/status")]
    public async Task<ActionResult<Order>> UpdateStatus(
        string id, StatusUpdateRequest req, CancellationToken ct)
    {
        if (!ValidStatuses.Contains(req.Status))
            return BadRequest(new { message = "Invalid order status" });

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
        _events.Publish(order.OrderNo, req.Status, req.Note);
        return Ok(order);
    }
}