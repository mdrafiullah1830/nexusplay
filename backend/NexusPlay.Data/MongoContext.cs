using MongoDB.Driver;
using NexusPlay.Core.Models;

namespace NexusPlay.Data;

public class MongoContext
{
    public IMongoDatabase Db { get; }

    public MongoContext(string connectionString, string databaseName)
    {
        var client = new MongoClient(connectionString);
        Db = client.GetDatabase(databaseName);
    }

    public IMongoCollection<Product> Products => Db.GetCollection<Product>("products");
    public IMongoCollection<Order> Orders => Db.GetCollection<Order>("orders");
    public IMongoCollection<AppUser> Users => Db.GetCollection<AppUser>("users");
    public IMongoCollection<WishlistItem> Wishlists => Db.GetCollection<WishlistItem>("wishlists");

    /// <summary>Creates indexes required by the app (idempotent).</summary>
    public async Task EnsureIndexesAsync(CancellationToken ct = default)
    {
        var orderKeys = Builders<Order>.IndexKeys
            .Ascending(o => o.OrderNo)
            .Ascending(o => o.Customer.Phone)
            .Descending(o => o.CreatedAt);

        await Orders.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<Order>(orderKeys,
                new CreateIndexOptions { Unique = true, Name = "ix_orderno" }),
            new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Descending(o => o.CreatedAt)),
        }, ct);

        await Users.Indexes.CreateOneAsync(
            new CreateIndexModel<AppUser>(
                Builders<AppUser>.IndexKeys.Ascending(u => u.Email),
                new CreateIndexOptions { Unique = true, Name = "ux_email" }),
            cancellationToken: ct);

        // Google subject IDs are unique per Google account. The sparse index lets
        // password-only users (whose subject is null) share the collection.
        await Users.Indexes.CreateOneAsync(
            new CreateIndexModel<AppUser>(
                Builders<AppUser>.IndexKeys.Ascending(u => u.GoogleSubject),
                new CreateIndexOptions { Unique = true, Sparse = true, Name = "ux_google_subject" }),
            cancellationToken: ct);

        // One saved product per user — the unique index is also what makes
        // POST /api/wishlist idempotent at the database level.
        await Wishlists.Indexes.CreateOneAsync(
            new CreateIndexModel<WishlistItem>(
                Builders<WishlistItem>.IndexKeys
                    .Ascending(w => w.UserId)
                    .Ascending(w => w.ProductId),
                new CreateIndexOptions { Unique = true, Name = "ux_user_product" }),
            cancellationToken: ct);
    }
}
