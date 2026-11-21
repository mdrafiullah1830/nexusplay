using NexusPlay.Core.Models;

namespace NexusPlay.Core.Interfaces;

public interface IProductRepository
{
    Task<PagedResult<Product>> SearchAsync(ProductQuery query, CancellationToken ct = default);
    Task<Product?> GetAsync(string id, CancellationToken ct = default);
    Task<List<Product>> GetByIdsAsync(IEnumerable<string> ids, CancellationToken ct = default);
    Task<Product> CreateAsync(Product product, CancellationToken ct = default);
    Task<bool> ReplaceAsync(Product product, CancellationToken ct = default);
    Task<bool> DeleteAsync(string id, CancellationToken ct = default);
    Task<bool> AnyAsync(CancellationToken ct = default);
    Task<long> CountAsync(CancellationToken ct = default);
}

public interface IOrderRepository
{
    Task<Order> CreateAsync(Order order, CancellationToken ct = default);
    Task<Order?> GetAsync(string id, CancellationToken ct = default);
    Task<Order?> FindAsync(string orderNo, string phone, CancellationToken ct = default);
    Task<Order?> FindByOrderNoAsync(string orderNo, CancellationToken ct = default);
    Task<PagedResult<Order>> SearchAsync(OrderQuery query, CancellationToken ct = default);
    Task<PagedResult<Order>> SearchForUserAsync(string userId, int page, int pageSize, CancellationToken ct = default);
    Task<bool> UpdateAsync(Order order, CancellationToken ct = default);
    Task<long> CountAsync(CancellationToken ct = default);
    Task<long> CountByStatusAsync(string status, CancellationToken ct = default);
    Task<decimal> RevenueAsync(CancellationToken ct = default);
}

public interface IWishlistRepository
{
    Task<List<WishlistItem>> GetForUserAsync(string userId, CancellationToken ct = default);
    Task<bool> AnyAsync(string userId, string productId, CancellationToken ct = default);
    Task<WishlistItem?> AddAsync(string userId, string productId, CancellationToken ct = default);
    Task<bool> RemoveAsync(string userId, string productId, CancellationToken ct = default);
}

public interface IUserRepository
{
    Task<AppUser?> GetByEmailAsync(string email, CancellationToken ct = default);
    Task<AppUser?> GetAsync(string id, CancellationToken ct = default);
    Task<AppUser> CreateAsync(AppUser user, CancellationToken ct = default);
    Task<bool> AnyAsync(CancellationToken ct = default);
}