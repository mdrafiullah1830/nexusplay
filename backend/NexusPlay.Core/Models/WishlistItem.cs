using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NexusPlay.Core.Models;

/// <summary>A product saved by a user, keyed per account.</summary>
public class WishlistItem
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string UserId { get; set; } = string.Empty;

    public string ProductId { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
