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

    public async Task EnsureIndexesAsync(CancellationToken ct = default)
    {
        await Orders.Indexes.CreateManyAsync(new[]
        {
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(o => o.OrderNo),
                new CreateIndexOptions { Unique = true, Name = "ux_orderno" }),
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(o => o.UserId).Descending(o => o.CreatedAt),
                new CreateIndexOptions { Name = "ix_user_created" }),
            new CreateIndexModel<Order>(Builders<Order>.IndexKeys.Descending(o => o.CreatedAt)),
        }, ct);

        await Users.Indexes.CreateOneAsync(
            new CreateIndexModel<AppUser>(
                Builders<AppUser>.IndexKeys.Ascending(u => u.Email),
                new CreateIndexOptions { Unique = true, Name = "ux_email" }),
            cancellationToken: ct);

        await Wishlists.Indexes.CreateOneAsync(
            new CreateIndexModel<WishlistItem>(
                Builders<WishlistItem>.IndexKeys
                    .Ascending(w => w.UserId)
                    .Ascending(w => w.ProductId),
                new CreateIndexOptions { Unique = true, Name = "ux_user_product" }),
            cancellationToken: ct);
    }
}