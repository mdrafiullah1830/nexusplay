using System.Text.RegularExpressions;
using MongoDB.Bson;
using MongoDB.Driver;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data.Repositories;

public class OrderRepository : IOrderRepository
{
    private readonly IMongoCollection<Order> _orders;

    public OrderRepository(MongoContext context)
    {
        _orders = context.Orders;
    }

    public async Task<Order> CreateAsync(Order order, CancellationToken ct = default)
    {
        await _orders.InsertOneAsync(order, cancellationToken: ct);
        return order;
    }

    public async Task<Order?> GetAsync(string id, CancellationToken ct = default) =>
        await _orders.Find(o => o.Id == id).FirstOrDefaultAsync(ct);

    public async Task<Order?> FindAsync(string orderNo, string phone, CancellationToken ct = default)
    {
        var normalizedOrderNo = orderNo.Trim().ToUpperInvariant();
        var normalizedPhone = Regex.Replace(phone ?? string.Empty, @"\D", string.Empty);

        // Exact phone match only. Suffix matching allows unrelated numbers to
        // reveal an order and must never be used for public order tracking.
        return await _orders.Find(o =>
                o.OrderNo == normalizedOrderNo &&
                o.Customer.Phone == normalizedPhone)
            .FirstOrDefaultAsync(ct);
    }

    public async Task<Order?> FindByOrderNoAsync(string orderNo, CancellationToken ct = default)
    {
        var normalizedOrderNo = orderNo.Trim().ToUpperInvariant();
        return await _orders.Find(o => o.OrderNo == normalizedOrderNo).FirstOrDefaultAsync(ct);
    }

    public async Task<PagedResult<Order>> SearchAsync(OrderQuery q, CancellationToken ct = default)
    {
        var filter = Builders<Order>.Filter.Empty;

        if (!string.IsNullOrWhiteSpace(q.Status))
            filter &= Builders<Order>.Filter.Eq(o => o.Status, q.Status);

        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            var term = q.Q.Trim();
            filter &= Builders<Order>.Filter.Or(
                Builders<Order>.Filter.Regex(o => o.OrderNo,
                    new BsonRegularExpression(Regex.Escape(term), "i")),
                Builders<Order>.Filter.Regex(o => o.Customer.Phone,
                    new BsonRegularExpression(Regex.Escape(term), "i")),
                Builders<Order>.Filter.Regex(o => o.Customer.Name,
                    new BsonRegularExpression(Regex.Escape(term), "i")));
        }

        return await QueryPageAsync(filter, q.Page, q.PageSize, ct);
    }

    public async Task<PagedResult<Order>> SearchForUserAsync(
        string userId, int page, int pageSize, CancellationToken ct = default)
    {
        var filter = Builders<Order>.Filter.Eq(o => o.UserId, userId);
        return await QueryPageAsync(filter, page, pageSize, ct);
    }

    private async Task<PagedResult<Order>> QueryPageAsync(
        FilterDefinition<Order> filter, int requestedPage, int requestedPageSize,
        CancellationToken ct)
    {
        var page = Math.Max(1, requestedPage);
        var pageSize = Math.Clamp(requestedPageSize, 1, 100);
        var total = await _orders.CountDocumentsAsync(filter, cancellationToken: ct);
        var items = await _orders.Find(filter)
            .SortByDescending(o => o.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Limit(pageSize)
            .ToListAsync(ct);

        return new PagedResult<Order>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize,
        };
    }

    public async Task<bool> UpdateAsync(Order order, CancellationToken ct = default)
    {
        order.UpdatedAt = DateTime.UtcNow;
        var result = await _orders.ReplaceOneAsync(o => o.Id == order.Id, order,
            new ReplaceOptions { IsUpsert = false }, ct);
        return result.IsAcknowledged && result.ModifiedCount == 1;
    }

    public async Task<long> CountAsync(CancellationToken ct = default) =>
        await _orders.CountDocumentsAsync(Builders<Order>.Filter.Empty, cancellationToken: ct);

    public async Task<long> CountByStatusAsync(string status, CancellationToken ct = default) =>
        await _orders.CountDocumentsAsync(Builders<Order>.Filter.Eq(o => o.Status, status),
            cancellationToken: ct);

    public async Task<decimal> RevenueAsync(CancellationToken ct = default)
    {
        var filter = Builders<Order>.Filter.In(o => o.Status,
            new[] { "confirmed", "shipped", "delivered" });
        var totals = await _orders.Find(filter).Project(o => o.Total).ToListAsync(ct);
        return totals.Sum();
    }
}