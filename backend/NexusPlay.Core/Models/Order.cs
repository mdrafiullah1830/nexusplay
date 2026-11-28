using MongoDB.Bson;
using MongoDB.Bson.Serialization.Attributes;
using System.Text.Json.Serialization;

namespace NexusPlay.Core.Models;

public class Order
{
    [BsonId]
    [BsonRepresentation(BsonType.String)]
    public string Id { get; set; } = ObjectId.GenerateNewId().ToString();

    public string OrderNo { get; set; } = string.Empty;
    public string? UserId { get; set; }
    [BsonIgnoreIfNull]
    [JsonIgnore]
    public string? IdempotencyKey { get; set; }
    [BsonIgnoreIfNull]
    [JsonIgnore]
    public string? RequestFingerprint { get; set; }
    public CustomerInfo Customer { get; set; } = new();
    public List<OrderItem> Items { get; set; } = new();

    public decimal Subtotal { get; set; }
    public decimal DeliveryFee { get; set; }
    public decimal Total { get; set; }

    /// <summary>cod | bkash | card | gateway</summary>
    public string PaymentMethod { get; set; } = "cod";

    public string? BkashTrxId { get; set; }

    /// <summary>sslcommerz | stripe | null for non-gateway payments</summary>
    public string? PaymentGateway { get; set; }

    /// <summary>Transaction ID returned by the payment gateway</summary>
    public string? GatewayTransactionId { get; set; }

    /// <summary>payment-initiated | paid | failed | refunded</summary>
    public string PaymentStatus { get; set; } = "pending";

    /// <summary>
    /// pending | awaiting-verification | confirmed | shipped | delivered | cancelled
    /// </summary>
    public string Status { get; set; } = "pending";

    public List<TrackingEvent> Tracking { get; set; } = new();
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public class CustomerInfo
{
    public string Name { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string Address { get; set; } = string.Empty;
    public string? City { get; set; }
    public string? Area { get; set; }
    public string? Note { get; set; }
}

public class OrderItem
{
    public string ProductId { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string Brand { get; set; } = string.Empty;
    public string Category { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Qty { get; set; }
    public string? Colour { get; set; }
}

public class TrackingEvent
{
    public string Status { get; set; } = string.Empty;
    public string? Note { get; set; }
    public DateTime At { get; set; } = DateTime.UtcNow;
}
