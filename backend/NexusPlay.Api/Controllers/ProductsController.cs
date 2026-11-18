using Microsoft.AspNetCore.Mvc;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly IProductRepository _products;

    public ProductsController(IProductRepository products)
    {
        _products = products;
    }

    /// <summary>Public catalogue search with filters, sort and pagination.</summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<Product>>> Search([FromQuery] ProductQuery query,
        CancellationToken ct)
    {
        var result = await _products.SearchAsync(query, ct);
        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Product>> GetById(string id, CancellationToken ct)
    {
        var product = await _products.GetAsync(id, ct);
        return product is null ? NotFound(new { message = "Product not found" }) : Ok(product);
    }
}
