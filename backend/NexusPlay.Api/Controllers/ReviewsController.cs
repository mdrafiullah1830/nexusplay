using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/reviews")]
public class ReviewsController : ControllerBase
{
    private readonly IProductRepository _products;

    public ReviewsController(IProductRepository products)
    {
        _products = products;
    }

    [HttpPost("{productId}")]
    [Authorize]
    public async Task<ActionResult> Submit(string productId, [FromBody] ReviewDto dto, CancellationToken ct)
    {
        var product = await _products.GetAsync(productId, ct);
        if (product is null)
            return NotFound(new { message = "Product not found" });

        if (dto.Rating < 1 || dto.Rating > 5)
            return BadRequest(new { message = "Rating must be between 1 and 5" });

        if (product.Reviews == null)
            product.Reviews = new List<string>();

        product.Reviews.Add($"{dto.UserName}: {dto.Comment} (Rating: {dto.Rating})");

        // Calculate average rating
        double avg = 0;
        if (product.Reviews.Count > 0)
        {
            double sum = 0;
            foreach (var rev in product.Reviews)
            {
                var last = rev.LastIndexOf("Rating: ");
                if (last >= 0)
                {
                    var ratingStr = rev.Substring(last + 8);
                    if (double.TryParse(ratingStr, out double r))
                        sum += r;
                }
            }
            avg = sum / product.Reviews.Count;
        }

        product.Rating = Math.Round(avg, 1);

        await _products.ReplaceAsync(product, ct);
        return Ok(new { message = "Review submitted", newAverageRating = product.Rating, totalReviews = product.Reviews.Count });
    }

    [HttpGet("{productId}")]
    [AllowAnonymous]
    public async Task<ActionResult> Get(string productId, CancellationToken ct)
    {
        var product = await _products.GetAsync(productId, ct);
        if (product is null)
            return NotFound(new { message = "Product not found" });

        return Ok(new { averageRating = product.Rating, totalReviews = product.Reviews?.Count ?? 0 });
    }
}

public class ReviewDto
{
    public string UserName { get; set; } = "";
    public string Comment { get; set; } = "";
    public int Rating { get; set; }
}