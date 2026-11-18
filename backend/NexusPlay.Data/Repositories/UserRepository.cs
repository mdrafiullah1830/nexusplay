using MongoDB.Driver;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data.Repositories;

public class UserRepository : IUserRepository
{
    private readonly IMongoCollection<AppUser> _users;

    public UserRepository(MongoContext context)
    {
        _users = context.Users;
    }

    public async Task<AppUser?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        var normalized = email.Trim().ToLowerInvariant();
        return await _users.Find(u => u.Email == normalized).FirstOrDefaultAsync(ct);
    }

    public async Task<AppUser?> GetAsync(string id, CancellationToken ct = default) =>
        await _users.Find(u => u.Id == id).FirstOrDefaultAsync(ct);

    public async Task<AppUser> CreateAsync(AppUser user, CancellationToken ct = default)
    {
        user.Email = user.Email.Trim().ToLowerInvariant();
        await _users.InsertOneAsync(user, cancellationToken: ct);
        return user;
    }

    public async Task<bool> AnyAsync(CancellationToken ct = default) =>
        await _users.Find(Builders<AppUser>.Filter.Empty).AnyAsync(ct);
}
