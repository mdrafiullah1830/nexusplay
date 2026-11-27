using System.Text.Json;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data.D1;

public sealed class D1ProductRepository(D1Client db) : IProductRepository
{
    public async Task<PagedResult<Product>> SearchAsync(ProductQuery q, CancellationToken ct = default)
    {
        var where = new List<string>();
        var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(q.Category)) { where.Add("category = ?"); args.Add(q.Category.ToLowerInvariant()); }
        if (!string.IsNullOrWhiteSpace(q.Brand)) { where.Add("brand = ?"); args.Add(q.Brand); }
        if (!string.IsNullOrWhiteSpace(q.Stock)) { where.Add("stock = ?"); args.Add(q.Stock); }
        if (q.Min is not null) { where.Add("price >= ?"); args.Add(q.Min); }
        if (q.Max is not null) { where.Add("price <= ?"); args.Add(q.Max); }
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            where.Add("(name LIKE ? OR brand LIKE ? OR json LIKE ?)");
            var term = "%" + q.Q.Trim() + "%";
            args.Add(term); args.Add(term); args.Add(term);
        }
        var filter = where.Count == 0 ? "" : " WHERE " + string.Join(" AND ", where);
        var total = await db.QueryAsync("SELECT COUNT(*) AS n FROM products" + filter, args.ToArray(), ct);
        var sort = q.Sort switch
        {
            "price-asc" => "price ASC",
            "price-desc" => "price DESC",
            "newest" => "created_at DESC",
            "discount" => "(old_price - price) DESC",
            _ => "rating DESC",
        };
        var page = Math.Max(1, q.Page);
        var size = Math.Clamp(q.PageSize, 1, 100);
        var listArgs = args.Concat([size, (page - 1) * size]).ToArray();
        var rows = await db.QueryAsync("SELECT json FROM products" + filter + " ORDER BY " + sort + " LIMIT ? OFFSET ?", listArgs, ct);
        return new PagedResult<Product> { Items = rows.Select(D1Client.Decode<Product>).ToList(),
            Total = D1Client.Long(total[0], "n"), Page = page, PageSize = size };
    }

    public async Task<Product?> GetAsync(string id, CancellationToken ct = default) =>
        (await db.QueryAsync("SELECT json FROM products WHERE id = ?", [id], ct)).FirstOrDefault() is var row && row.ValueKind != JsonValueKind.Undefined
            ? D1Client.Decode<Product>(row) : null;

    public async Task<List<Product>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default)
    {
        var list = ids.Distinct().ToArray();
        if (list.Length == 0) return [];
        var placeholders = string.Join(",", list.Select(_ => "?"));
        return (await db.QueryAsync("SELECT json FROM products WHERE id IN (" + placeholders + ")", list.Cast<object?>().ToArray(), ct))
            .Select(D1Client.Decode<Product>).ToList();
    }

    public async Task<Product> CreateAsync(Product product, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(product.Id)) product.Id = MongoDB.Bson.ObjectId.GenerateNewId().ToString();
        await db.QueryAsync("INSERT INTO products (id,json,name,brand,category,stock,price,old_price,rating,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
            Values(product), ct);
        return product;
    }

    public async Task<bool> ReplaceAsync(Product product, CancellationToken ct = default)
    {
        if (await GetAsync(product.Id, ct) is null) return false;
        await db.QueryAsync("UPDATE products SET json=?,name=?,brand=?,category=?,stock=?,price=?,old_price=?,rating=?,created_at=? WHERE id=?",
            [D1Client.Encode(product), product.Name, product.Brand, product.Category, product.Stock, product.Price,
                product.OldPrice, product.Rating, product.CreatedAt.ToString("O"), product.Id], ct);
        return true;
    }

    public async Task<bool> DeleteAsync(string id, CancellationToken ct = default)
    {
        if (await GetAsync(id, ct) is null) return false;
        await db.QueryAsync("DELETE FROM products WHERE id=?", [id], ct);
        return true;
    }
    public async Task<bool> AnyAsync(CancellationToken ct = default) => await CountAsync(ct) > 0;
    public async Task<long> CountAsync(CancellationToken ct = default) =>
        D1Client.Long((await db.QueryAsync("SELECT COUNT(*) AS n FROM products", ct: ct))[0], "n");
    private static object?[] Values(Product p) => [p.Id, D1Client.Encode(p), p.Name, p.Brand, p.Category,
        p.Stock, p.Price, p.OldPrice, p.Rating, p.CreatedAt.ToString("O")];
}

public sealed class D1OrderRepository(D1Client db) : IOrderRepository
{
    public async Task<Order> CreateAsync(Order order, CancellationToken ct = default)
    {
        await db.QueryAsync("INSERT INTO orders (id,json,order_no,phone,customer_name,status,total,created_at) VALUES (?,?,?,?,?,?,?,?)",
            [order.Id, D1Client.Encode(order), order.OrderNo, order.Customer.Phone, order.Customer.Name,
                order.Status, order.Total, order.CreatedAt.ToString("O")], ct);
        return order;
    }
    public async Task<Order?> GetAsync(string id, CancellationToken ct = default) =>
        DecodeFirst(await db.QueryAsync("SELECT json FROM orders WHERE id=?", [id], ct));
    public async Task<Order?> FindAsync(string orderNo, string phone, CancellationToken ct = default)
    {
        var order = await FindByOrderNoAsync(orderNo, ct);
        return order is not null && order.Customer.Phone.EndsWith(phone.Trim(), StringComparison.Ordinal)
            ? order : null;
    }
    public async Task<Order?> FindByOrderNoAsync(string orderNo, CancellationToken ct = default) =>
        DecodeFirst(await db.QueryAsync("SELECT json FROM orders WHERE order_no=?", [orderNo.Trim().ToUpperInvariant()], ct));
    public async Task<PagedResult<Order>> SearchAsync(OrderQuery q, CancellationToken ct = default)
    {
        var where = new List<string>(); var args = new List<object?>();
        if (!string.IsNullOrWhiteSpace(q.Status)) { where.Add("status=?"); args.Add(q.Status); }
        if (!string.IsNullOrWhiteSpace(q.Q))
        {
            where.Add("(order_no LIKE ? OR phone LIKE ? OR customer_name LIKE ?)");
            var term = "%" + q.Q.Trim() + "%";
            args.Add(term); args.Add(term); args.Add(term);
        }
        var filter = where.Count == 0 ? "" : " WHERE " + string.Join(" AND ", where);
        var count = await db.QueryAsync("SELECT COUNT(*) AS n FROM orders" + filter, args.ToArray(), ct);
        var page = Math.Max(1, q.Page); var size = Math.Clamp(q.PageSize, 1, 100);
        var rows = await db.QueryAsync("SELECT json FROM orders" + filter + " ORDER BY created_at DESC LIMIT ? OFFSET ?",
            args.Concat([size, (page - 1) * size]).ToArray(), ct);
        return new PagedResult<Order> { Items = rows.Select(D1Client.Decode<Order>).ToList(),
            Total = D1Client.Long(count[0], "n"), Page = page, PageSize = size };
    }
    public async Task<bool> UpdateAsync(Order order, CancellationToken ct = default)
    {
        if (await GetAsync(order.Id, ct) is null) return false;
        order.UpdatedAt = DateTime.UtcNow;
        await db.QueryAsync("UPDATE orders SET json=?,status=?,total=? WHERE id=?",
            [D1Client.Encode(order), order.Status, order.Total, order.Id], ct);
        return true;
    }
    public async Task<long> CountAsync(CancellationToken ct = default) =>
        D1Client.Long((await db.QueryAsync("SELECT COUNT(*) AS n FROM orders", ct: ct))[0], "n");
    public async Task<long> CountByStatusAsync(string status, CancellationToken ct = default) =>
        D1Client.Long((await db.QueryAsync("SELECT COUNT(*) AS n FROM orders WHERE status=?", [status], ct))[0], "n");
    public async Task<decimal> RevenueAsync(CancellationToken ct = default)
    {
        var rows = await db.QueryAsync("SELECT COALESCE(SUM(total),0) AS n FROM orders WHERE status IN ('confirmed','shipped','delivered')", ct: ct);
        return rows[0].GetProperty("n").GetDecimal();
    }
    private static Order? DecodeFirst(List<JsonElement> rows) => rows.Count == 0 ? null : D1Client.Decode<Order>(rows[0]);
}

public sealed class D1UserRepository(D1Client db) : IUserRepository
{
    public async Task<AppUser?> GetByEmailAsync(string email, CancellationToken ct = default) =>
        First(await db.QueryAsync("SELECT json FROM users WHERE email=?", [email.Trim().ToLowerInvariant()], ct));
    public async Task<AppUser?> GetByGoogleSubjectAsync(string googleSubject, CancellationToken ct = default) =>
        First(await db.QueryAsync("SELECT json FROM users WHERE google_subject=?", [googleSubject], ct));
    public async Task<AppUser?> GetAsync(string id, CancellationToken ct = default) =>
        First(await db.QueryAsync("SELECT json FROM users WHERE id=?", [id], ct));
    public async Task<AppUser> CreateAsync(AppUser user, CancellationToken ct = default)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        await db.QueryAsync("INSERT INTO users (id,json,email,google_subject) VALUES (?,?,?,?)",
            [user.Id, D1Client.Encode(user), user.Email, user.GoogleSubject], ct);
        return user;
    }
    public async Task<bool> LinkGoogleSubjectAsync(string id, string googleSubject, string? name,
        CancellationToken ct = default)
    {
        var user = await GetAsync(id, ct);
        if (user is null || user.GoogleSubject is not null) return false;
        user.GoogleSubject = googleSubject;
        if (!string.IsNullOrWhiteSpace(name)) user.Name = name;
        await db.QueryAsync("UPDATE users SET json=?,google_subject=? WHERE id=? AND google_subject IS NULL",
            [D1Client.Encode(user), googleSubject, id], ct);
        return true;
    }
    public async Task<bool> AnyAsync(CancellationToken ct = default) =>
        D1Client.Long((await db.QueryAsync("SELECT COUNT(*) AS n FROM users", ct: ct))[0], "n") > 0;
    private static AppUser? First(List<JsonElement> rows) => rows.Count == 0 ? null : D1Client.Decode<AppUser>(rows[0]);
}

public sealed class D1WishlistRepository(D1Client db) : IWishlistRepository
{
    public async Task<List<WishlistItem>> GetForUserAsync(string userId, CancellationToken ct = default) =>
        (await db.QueryAsync("SELECT json FROM wishlists WHERE user_id=? ORDER BY created_at DESC", [userId], ct))
            .Select(D1Client.Decode<WishlistItem>).ToList();
    public async Task<bool> AnyAsync(string userId, string productId, CancellationToken ct = default) =>
        D1Client.Long((await db.QueryAsync("SELECT COUNT(*) AS n FROM wishlists WHERE user_id=? AND product_id=?",
            [userId, productId], ct))[0], "n") > 0;
    public async Task<WishlistItem?> AddAsync(string userId, string productId, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(userId) || string.IsNullOrWhiteSpace(productId) || await AnyAsync(userId, productId, ct)) return null;
        var item = new WishlistItem { UserId = userId, ProductId = productId };
        await db.QueryAsync("INSERT INTO wishlists (id,json,user_id,product_id,created_at) VALUES (?,?,?,?,?)",
            [item.Id, D1Client.Encode(item), userId, productId, item.CreatedAt.ToString("O")], ct);
        return item;
    }
    public async Task<bool> RemoveAsync(string userId, string productId, CancellationToken ct = default)
    {
        if (!await AnyAsync(userId, productId, ct)) return false;
        await db.QueryAsync("DELETE FROM wishlists WHERE user_id=? AND product_id=?", [userId, productId], ct);
        return true;
    }
}
