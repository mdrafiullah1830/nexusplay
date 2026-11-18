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
    }
}
