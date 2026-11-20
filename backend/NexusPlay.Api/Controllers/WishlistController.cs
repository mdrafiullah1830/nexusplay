using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPlay.Core.Interfaces;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/wishlist")]
public class WishlistController : ControllerBase
{
    private readonly IWishlistRepository _wishlist;
    private readonly IProductRepository _products;

    public WishlistController(IWishlistRepository wishlist, IProductRepository products)
    {
        _wishlist = wishlist;
        _products = products;
    }

    /// <summary>The signed-in user's saved products, newest first.</summary>
    [HttpGet]
    [Authorize]
    public async Task<ActionResult> List(CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var items = await _wishlist.GetForUserAsync(userId, ct);
        var ids = items.Select(i => i.ProductId).Distinct().ToList();
        var products = ids.Count > 0
            ? (await _products.GetByIdsAsync(ids, ct)).ToDictionary(p => p.Id)
            : new Dictionary<string, Core.Models.Product>();

        var payload = items
            .Where(i => products.TryGetValue(i.ProductId, out _))
            .Select(i =>
            {
                var p = products[i.ProductId];
                return new
                {
                    productId = p.Id,
                    name = p.Name,
                    brand = p.Brand,
                    price = p.Price,
                    oldPrice = p.OldPrice,
                    imageUrl = p.ImageUrls?.FirstOrDefault() ?? p.Image,
                    stock = p.Stock,
                    addedAt = i.CreatedAt,
                };
            });

        return Ok(new { items = payload });
    }

    [HttpPost]
    [Authorize]
    public async Task<ActionResult> Add([FromBody] WishlistRequest request, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var productId = request.ProductId?.Trim();
        if (string.IsNullOrEmpty(productId))
            return BadRequest(new { message = "ProductId is required" });

        var product = await _products.GetAsync(productId, ct);
        if (product is null)
            return NotFound(new { message = "Product not found" });

        var added = await _wishlist.AddAsync(userId, productId, ct);
        return Ok(new { added = added is not null });
    }

    [HttpDelete("{productId}")]
    [Authorize]
    public async Task<ActionResult> Remove(string productId, CancellationToken ct)
    {
        var userId = CurrentUserId();
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var removed = await _wishlist.RemoveAsync(userId, productId, ct);
        return Ok(new { removed });
    }

    private string? CurrentUserId() =>
        User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
}

public class WishlistRequest
{
    public string ProductId { get; set; } = string.Empty;
}
