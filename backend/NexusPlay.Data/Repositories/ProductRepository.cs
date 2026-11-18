using MongoDB.Bson;
using MongoDB.Driver;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data.Repositories;

public class ProductRepository : IProductRepository
{
    private readonly IMongoCollection<Product> _products;

    public ProductRepository(MongoContext context)
    {
        _products = context.Products;
    }

    public async Task<PagedResult<Product>> SearchAsync(ProductQuery q, CancellationToken ct = default)
    {
        var filter = Builders<Product>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(q.Category))
            filter &= Builders<Product>.Filter.Eq(p => p.Category, q.Category.ToLowerInvariant());

        if (!string.IsNullOrWhiteSpace(q.Brand))
            filter &= Builders<Product>.Filter.Eq(p => p.Brand, q.Brand);

        if (!string.IsNullOrWhiteSpace(q.Stock))
            filter &= Builders<Product>.Filter.Eq(p => p.Stock, q.Stock);

        if (q.Min is not null)
            filter &= Builders<Product>.Filter.Gte(p => p.Price, q.Min.Value);

        if (q.Max is not null)
            filter &= Builders<Product>.Filter.Lte(p => p.Price, q.Max.Value);

        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var regex = new BsonRegularExpression(
                System.Text.RegularExpressions.Regex.Escape(q.Q.Trim()), "i");
            filter &= Builders<Product>.Filter.Or(
                Builders<Product>.Filter.Regex(p => p.Name, regex),
                Builders<Product>.Filter.Regex(p => p.Brand, regex),
                Builders<Product>.Filter.Regex(p => p.Description!, regex));
        }

        var sort = q.Sort switch
        {
            "price-asc" => Builders<Product>.Sort.Ascending(p => p.Price),
            "price-desc" => Builders<Product>.Sort.Descending(p => p.Price),
            "newest" => Builders<Product>.Sort.Descending(p => p.CreatedAt),
            "discount" => Builders<Product>.Sort.Descending(p => p.OldPrice - p.Price),
            _ => Builders<Product>.Sort.Descending(p => p.Rating),
        };

        var page = Math.Max(1, q.Page);
        var pageSize = Math.Clamp(q.PageSize, 1, 100);

        var total = await _products.CountDocumentsAsync(filter, cancellationToken: ct);
        var items = await _products
            .Find(filter)
            .Sort(sort)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Product> { Items = items, Total = total, Page = page, PageSize = pageSize };
    }

    public async Task<Product?> GetAsync(string id, CancellationToken ct = default) =>
        await _products.Find(p => p.Id == id).FirstOrDefaultAsync(ct);

    public async Task<List<Product>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var list = ids.Distinct().ToList();
        return await _products.Find(p => list.Contains(p.Id)).ToListAsync(ct);
    }

    public async Task<Product> CreateAsync(Product product, CancellationToken ct = default)
    {
        await _products.InsertOneAsync(product, cancellationToken: ct);
        return product;
    }

    public async Task<bool> ReplaceAsync(Product product, CancellationToken ct = default)
    {
        var result = await _products.ReplaceOneAsync(p => p.Id == product.Id, product,
            new ReplaceOptions { IsUpsert = false }, ct);
        return result.IsAcknowledged && result.ModifiedCount == 1;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        var result = await _products.DeleteOneAsync(p => p.Id == id, ct);
        return result.IsAcknowledged && result.DeletedCount == 1;
    }

    public async Task<bool> AnyAsync(CancellationToken ct = default) =>
        await _products.Find(Builders<Product>.Filter.Empty).AnyAsync(ct);

    public async Task<long> CountAsync(CancellationToken ct = default) =>
        await _products.CountDocumentsAsync(Builders<Product>.Filter.Empty, cancellationToken: ct);
}
