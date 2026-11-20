using MongoDB.Driver;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data.Repositories;

public class WishlistRepository : IWishlistRepository
{
    private readonly IMongoCollection<WishlistItem> _wishlist;

    public WishlistRepository(MongoContext context)
    {
        _wishlist = context.Wishlists;
    }

    public async Task<List<WishlistItem>> GetForUserAsync(string userId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(userId)) return new List<WishlistItem>();

        return await _wishlist.Find(w => w.UserId == userId)
            .SortByDescending(w => w.CreatedAt)
            .ToListAsync(ct);
    }

    public async Task<bool> AnyAsync(string userId, string productId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(productId)) return false;

        var count = await _wishlist.CountDocumentsAsync(
            w => w.UserId == userId && w.ProductId == productId,
            cancellationToken: ct);
        return count > 0;
    }

    public async Task<WishlistItem?> AddAsync(string userId, string productId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(productId)) return null;
        if (await AnyAsync(userId, productId, ct)) return null;

        var item = new WishlistItem { UserId = userId, ProductId = productId };
        await _wishlist.InsertOneAsync(item, cancellationToken: ct);
        return item;
    }

    public async Task<bool> RemoveAsync(string userId, string productId, CancellationToken ct = default)
    {
        if (string.IsNullOrEmpty(userId) || string.IsNullOrEmpty(productId)) return false;

        var res = await _wishlist.DeleteOneAsync(
            w => w.UserId == userId && w.ProductId == productId,
            ct);
        return res.DeletedCount > 0;
    }
}
