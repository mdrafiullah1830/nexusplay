using System.Net;
using System.Text;
using System.Text.Json;
using MongoDB.Bson;
using NexusPlay.Core.Models;
using NexusPlay.Data.D1;

namespace NexusPlay.Api.Tests;

public class D1IdempotencyMigrationTests
{
    [Fact]
    public async Task MigrationAddsNullableIdempotencyColumnsAndUniqueIndex()
    {
        var handler = new RecordingHandler();
        using var http = new HttpClient(handler);
        var client = new D1Client(http, "https://gateway.example", "test-token");

        await client.InitializeAsync();

        Assert.Contains(handler.Statements, sql => sql == "ALTER TABLE orders ADD COLUMN idempotency_key TEXT");
        Assert.Contains(handler.Statements, sql => sql == "ALTER TABLE orders ADD COLUMN request_fingerprint TEXT");
        Assert.Contains(handler.Statements, sql =>
            sql == "CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_idempotency_key ON orders(idempotency_key)");
    }

    [Fact]
    public async Task CreateOrGetReturnsTheStoredOrderWhenInsertConflicts()
    {
        var storedOrder = new Order
        {
            OrderNo = "NP260101ABCDEF",
            IdempotencyKey = "idempotency-hash",
            RequestFingerprint = "request-fingerprint",
        };
        using var http = new HttpClient(new DuplicateInsertHandler(storedOrder));
        var repository = new D1OrderRepository(new D1Client(http, "https://gateway.example", "test-token"));

        var result = await repository.CreateOrGetAsync(new Order
        {
            OrderNo = "NP260101NEW123",
            IdempotencyKey = storedOrder.IdempotencyKey,
            RequestFingerprint = storedOrder.RequestFingerprint,
        });

        Assert.False(result.Created);
        Assert.Equal(storedOrder.OrderNo, result.Order.OrderNo);
        Assert.Equal(storedOrder.IdempotencyKey, result.Order.IdempotencyKey);
        Assert.Equal(storedOrder.RequestFingerprint, result.Order.RequestFingerprint);
    }

    [Fact]
    public void IdempotencyMetadataPersistsWithoutAppearingInOrderJson()
    {
        var order = new Order
        {
            IdempotencyKey = "idempotency-hash",
            RequestFingerprint = "request-fingerprint",
        };

        var mongoDocument = order.ToBsonDocument();
        var d1Json = D1Client.Encode(order);

        Assert.Equal("idempotency-hash", mongoDocument["IdempotencyKey"].AsString);
        Assert.Equal("request-fingerprint", mongoDocument["RequestFingerprint"].AsString);
        Assert.DoesNotContain("IdempotencyKey", d1Json, StringComparison.Ordinal);
        Assert.DoesNotContain("RequestFingerprint", d1Json, StringComparison.Ordinal);
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        public List<string> Statements { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            using var body = await JsonDocument.ParseAsync(
                await request.Content!.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            var sql = body.RootElement.GetProperty("sql").GetString()!;
            Statements.Add(sql);

            var results = sql switch
            {
                "PRAGMA table_info(orders)" =>
                    """[{"name":"id"},{"name":"json"},{"name":"order_no"},{"name":"phone"},{"name":"customer_name"},{"name":"status"},{"name":"total"},{"name":"created_at"}]""",
                _ => "[]",
            };
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(
                    $$"""{"success":true,"results":{{results}}}""",
                    Encoding.UTF8,
                    "application/json"),
            };
        }
    }

    private sealed class DuplicateInsertHandler(Order storedOrder) : HttpMessageHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(
            HttpRequestMessage request,
            CancellationToken cancellationToken)
        {
            using var body = await JsonDocument.ParseAsync(
                await request.Content!.ReadAsStreamAsync(cancellationToken),
                cancellationToken: cancellationToken);
            var sql = body.RootElement.GetProperty("sql").GetString()!;
            if (sql.StartsWith("INSERT INTO orders", StringComparison.Ordinal))
                return new HttpResponseMessage(HttpStatusCode.InternalServerError);

            var result = new
            {
                success = true,
                results = new[]
                {
                    new
                    {
                        json = D1Client.Encode(storedOrder),
                        idempotency_key = storedOrder.IdempotencyKey,
                        request_fingerprint = storedOrder.RequestFingerprint,
                    },
                },
            };
            return new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent(JsonSerializer.Serialize(result), Encoding.UTF8, "application/json"),
            };
        }
    }
}
