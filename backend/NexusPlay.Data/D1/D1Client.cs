using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;

namespace NexusPlay.Data.D1;

public sealed class D1Client
{
    private readonly HttpClient _http;
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    public D1Client(HttpClient http, string gatewayUrl, string token)
    {
        _http = http;
        _http.BaseAddress = new Uri(gatewayUrl.TrimEnd('/') + "/");
        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
    }

    public async Task<List<JsonElement>> QueryAsync(string sql, object?[]? parameters = null,
        CancellationToken ct = default)
    {
        using var response = await _http.PostAsJsonAsync("query", new { sql, @params = parameters ?? [] }, Json, ct);
        response.EnsureSuccessStatusCode();
        using var data = await response.Content.ReadFromJsonAsync<JsonDocument>(cancellationToken: ct)
            ?? throw new InvalidOperationException("Empty D1 response");
        var root = data.RootElement;
        if (!root.TryGetProperty("success", out var success) || !success.GetBoolean())
            throw new InvalidOperationException("D1 query failed");
        return root.GetProperty("results").EnumerateArray().Select(x => x.Clone()).ToList();
    }

    public async Task InitializeAsync(CancellationToken ct = default)
    {
        await QueryAsync(
            "CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)",
            ct: ct);
        var applied = (await QueryAsync("SELECT version FROM schema_migrations", ct: ct))
            .Select(row => row.GetProperty("version").GetInt32())
            .ToHashSet();

        // Each migration runs once on API startup. Keep statements in a migration
        // safe to retry if the process stops before its version is recorded.
        string[] initialSchema =
        [
            "CREATE TABLE IF NOT EXISTS products (id TEXT PRIMARY KEY, json TEXT NOT NULL, name TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL, stock TEXT NOT NULL, price REAL NOT NULL, old_price REAL NOT NULL, rating REAL NOT NULL, created_at TEXT NOT NULL)",
            "CREATE INDEX IF NOT EXISTS idx_products_category ON products(category)",
            "CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, json TEXT NOT NULL, order_no TEXT NOT NULL UNIQUE, phone TEXT NOT NULL, customer_name TEXT NOT NULL, status TEXT NOT NULL, total REAL NOT NULL, created_at TEXT NOT NULL)",
            "CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at)",
            "CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, json TEXT NOT NULL, email TEXT NOT NULL UNIQUE, google_subject TEXT UNIQUE)",
            "CREATE TABLE IF NOT EXISTS wishlists (id TEXT PRIMARY KEY, json TEXT NOT NULL, user_id TEXT NOT NULL, product_id TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(user_id, product_id))",
        ];
        var migrations = new (int Version, string[] Statements)[]
        {
            (1, initialSchema),
        };

        foreach (var (version, statements) in migrations)
        {
            if (applied.Contains(version)) continue;
            foreach (var statement in statements) await QueryAsync(statement, ct: ct);
            await QueryAsync(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                [version, DateTime.UtcNow.ToString("O")], ct);
        }

        if (!applied.Contains(2))
        {
            var columns = await QueryAsync("PRAGMA table_info(orders)", ct: ct);
            var columnNames = columns
                .Select(row => row.GetProperty("name").GetString())
                .ToHashSet(StringComparer.Ordinal);
            if (!columnNames.Contains("idempotency_key"))
                await QueryAsync("ALTER TABLE orders ADD COLUMN idempotency_key TEXT", ct: ct);
            if (!columnNames.Contains("request_fingerprint"))
                await QueryAsync("ALTER TABLE orders ADD COLUMN request_fingerprint TEXT", ct: ct);
            await QueryAsync(
                "CREATE UNIQUE INDEX IF NOT EXISTS ux_orders_idempotency_key ON orders(idempotency_key)",
                ct: ct);
            await QueryAsync(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)",
                [2, DateTime.UtcNow.ToString("O")], ct);
        }
    }

    public static string Encode<T>(T value) => JsonSerializer.Serialize(value, Json);
    public static T Decode<T>(JsonElement row) => JsonSerializer.Deserialize<T>(row.GetProperty("json").GetString()!, Json)!;
    public static long Long(JsonElement row, string name) => row.GetProperty(name).GetInt64();
}
