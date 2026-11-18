using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;

namespace NexusPlay.Core.Models;

public class Product
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string Name { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Category { get; set; } = "controllers";
    public decimal Price { get; set; }
    public decimal OldPrice { get; set; }
    public string? Image { get; set; }
    public List<string>? Colours { get; set; }
    public List<string> Compatibility { get; set; } = new();
    public string? Connectivity { get; set; }
    public string? Cooling { get; set; }
    public string? Charging { get; set; }
    public string? Controller { get; set; }
    public string? Dock { get; set; }

    /// <summary>in-stock | pre-order | out-of-stock</summary>
    public string Stock { get; set; } = "in-stock";

    public decimal? Advance { get; set; }
    public string? Description { get; set; }
    public double Rating { get; set; }
    public List<string> Reviews { get; set; } = new();

    /// <summary>List of image URLs for the product gallery.</summary>
    public List<string> ImageUrls { get; set; } = new();

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
