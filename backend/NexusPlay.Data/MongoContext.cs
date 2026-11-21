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
        // Old order numbers used a short random suffix, so an existing database
        // could contain duplicates. Only create the unique index when safe.
        var duplicateOrderNo = await Orders.Aggregate()
            .Group(order => order.OrderNo,
                group => new { OrderNo = group.Key, Count = group.Count() })
            .Match(group => group.Count > 1)
            .FirstOrDefaultAsync(ct);

        if (duplicateOrderNo is null)
        {
            await Orders.Indexes.CreateOneAsync(
                new CreateIndexModel<Order>(
                    Builders<Order>.IndexKeys.Ascending(order => order.OrderNo),
                    new CreateIndexOptions { Unique = true, Name = "ux_orderno" }),
                cancellationToken: ct);
        }
        else
        {
            Console.Error.WriteLine(
                "[startup] Duplicate legacy order numbers detected. The unique order-number index was not created; resolve duplicates before re-enabling it.");
        }

        await Orders.Indexes.CreateOneAsync(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Ascending(order => order.UserId)
                    .Descending(order => order.CreatedAt),
                new CreateIndexOptions { Name = "ix_user_created" }),
            cancellationToken: ct);

        await Orders.Indexes.CreateOneAsync(
            new CreateIndexModel<Order>(
                Builders<Order>.IndexKeys.Descending(order => order.CreatedAt)),
            cancellationToken: ct);

        await Users.Indexes.CreateOneAsync(
            new CreateIndexModel<AppUser>(
                Builders<AppUser>.IndexKeys.Ascending(user => user.Email),
                new CreateIndexOptions { Unique = true, Name = "ux_email" }),
            cancellationToken: ct);

        await Wishlists.Indexes.CreateOneAsync(
            new CreateIndexModel<WishlistItem>(
                Builders<WishlistItem>.IndexKeys
                    .Ascending(item => item.UserId)
                    .Ascending(item => item.ProductId),
                new CreateIndexOptions { Unique = true, Name = "ux_user_product" }),
            cancellationToken: ct);
    }
}