using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NexusPlay.Core.Models;

public class AppUser
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>user | admin</summary>
    public string Role { get; set; } = "user";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
