using System.Net;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPlay.Core.Interfaces;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly IProductRepository _products;
    private readonly IUserRepository _users;

    public ReviewsController(IProductRepository products, IUserRepository users)
    {
        _products = products;
        _users = users;
    }

    [HttpPost("{productId}")]
    [Authorize]
    public async Task<ActionResult> Submit(
        string productId, [FromBody] ReviewDto dto, CancellationToken ct)
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();

        var user = await _users.GetAsync(userId, ct);
        if (user is null) return Unauthorized();

        var product = await _products.GetAsync(productId, ct);
        if (product is null)
            return NotFound(new { message = "Product not found" });

        var comment = dto.Comment?.Trim();
        if (dto.Rating is < 1 or > 5)
            return BadRequest(new { message = "Rating must be between 1 and 5" });
        if (string.IsNullOrWhiteSpace(comment) || comment.Length > 1000)
            return BadRequest(new { message = "Review comment must be between 1 and 1000 characters" });

        product.Reviews ??= new List<string>();
        // User identity is taken from the validated token/database, never from
        // a client-controlled display-name field. Encode before the legacy
        // string format is embedded into the product page's HTML.
        var safeName = WebUtility.HtmlEncode(user.Name);
        var safeComment = WebUtility.HtmlEncode(comment);
        product.Reviews.Add($"{safeName}: {safeComment} (Rating: {dto.Rating})");

        var sum = 0d;
        var count = 0;
        foreach (var review in product.Reviews)
        {
            var marker = review.LastIndexOf("Rating: ", StringComparison.Ordinal);
            if (marker < 0) continue;

            var ratingText = review[(marker + 8)..].TrimEnd(')');
            if (double.TryParse(ratingText,
                System.Globalization.NumberStyles.Number,
                System.Globalization.CultureInfo.InvariantCulture, out var rating) &&
                rating is >= 1 and <= 5)
            {
                sum += rating;
                count++;
            }
        }

        product.Rating = count == 0 ? 0 : Math.Round(sum / count, 1);
        await _products.ReplaceAsync(product, ct);

        return Ok(new
        {
            message = "Review submitted",
            newAverageRating = product.Rating,
            totalReviews = product.Reviews.Count,
        });
    }

    [HttpGet("{productId}")]
    [AllowAnonymous]
    public async Task<ActionResult> Get(string productId, CancellationToken ct)
    {
        var product = await _products.GetAsync(productId, ct);
        if (product is null)
            return NotFound(new { message = "Product not found" });

        return Ok(new
        {
            averageRating = product.Rating,
            totalReviews = product.Reviews?.Count ?? 0,
            reviews = ParseReviews(product.Reviews),
        });
    }

    private static object ParseReviews(List<string>? reviews)
    {
        if (reviews is null || reviews.Count == 0)
            return Array.Empty<object>();

        return reviews.Select(review =>
        {
            var rating = 0;
            var text = review;
            var marker = review.LastIndexOf("(Rating: ", StringComparison.Ordinal);
            if (marker >= 0 && review.EndsWith(")", StringComparison.Ordinal))
            {
                var raw = review[(marker + 9)..^1];
                int.TryParse(raw, out rating);
                text = review[..marker].Trim();
            }

            var separator = text.IndexOf(':');
            if (separator > 0)
            {
                return (object)new
                {
                    userName = text[..separator].Trim(),
                    comment = text[(separator + 1)..].Trim(),
                    rating,
                };
            }

            return (object)new { userName = string.Empty, comment = text, rating };
        }).ToArray();
    }
}

public class ReviewDto
{
    public string Comment { get; set; } = string.Empty;
    public int Rating { get; set; }
}