using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Services;

/// <summary>
/// Payment gateway abstraction.
/// Currently wired for SSLCOMMERZ (Bangladesh) with sandbox support.
/// Set SslCommerz:Mode=sandbox in appsettings for test mode.
/// </summary>
public interface IPaymentService
{
    Task<PaymentInitiationResult> InitiateAsync(Order order, string callbackUrl, string cancelUrl, string ipnUrl, CancellationToken ct = default);
    Task<bool> ProcessIpnAsync(Dictionary<string, string> payload, CancellationToken ct = default);
    Task<PaymentVerificationResult> VerifyAsync(string transactionId, CancellationToken ct = default);
}

public record PaymentInitiationResult(bool Success, string? GatewayUrl, string? Error, string? SessionId);

public record PaymentVerificationResult(bool Success, string Status, string TransactionId, decimal Amount, string? Error);

public class PaymentService : IPaymentService
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public PaymentService(IConfiguration config, HttpClient http)
    {
        _config = config;
        _http = http;
    }

    private string StoreId => _config["SslCommerz:StoreId"] ?? "nexusplay_demo";
    private string StorePassword => _config["SslCommerz:StorePassword"] ?? "demo_password";
    private bool IsSandbox => string.Equals(_config["SslCommerz:Mode"], "sandbox", StringComparison.OrdinalIgnoreCase);
    private string BaseUrl => IsSandbox
        ? "https://sandbox.sslcommerz.com"
        : "https://securepay.sslcommerz.com";

    public async Task<PaymentInitiationResult> InitiateAsync(Order order, string callbackUrl, string cancelUrl, string ipnUrl, CancellationToken ct = default)
    {
        var payload = new Dictionary<string, string>
        {
            ["store_id"] = StoreId,
            ["store_passwd"] = StorePassword,
            ["total_amount"] = order.Total.ToString("F2"),
            ["currency"] = "BDT",
            ["tran_id"] = order.OrderNo,
            ["success_url"] = callbackUrl,
            ["fail_url"] = cancelUrl,
            ["cancel_url"] = cancelUrl,
            ["ipn_url"] = ipnUrl,
            ["cus_name"] = order.Customer.Name,
            ["cus_email"] = order.Customer.Email ?? string.Empty,
            ["cus_phone"] = order.Customer.Phone,
            ["cus_add1"] = order.Customer.Address,
            ["cus_city"] = order.Customer.City ?? string.Empty,
            ["cus_country"] = "Bangladesh",
            ["shipping_method"] = "YES",
            ["product_name"] = $"NexusPlay Order {order.OrderNo}",
            ["product_category"] = "Gaming Controllers",
            ["product_profile"] = "physical-goods",
        };

        var content = new FormUrlEncodedContent(payload);
        var response = await _http.PostAsync($"{BaseUrl}/gwprocess/v3/api.php", content, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);

        var result = ParseInitiationResponse(responseBody);

        if (!result.Success)
        {
            return new PaymentInitiationResult(false, null, result.Error, null);
        }

        return new PaymentInitiationResult(true, result.GatewayUrl, null, result.SessionId);
    }

    public async Task<bool> ProcessIpnAsync(Dictionary<string, string> payload, CancellationToken ct = default)
    {
        if (!payload.TryGetValue("tran_id", out var _) ||
            !payload.TryGetValue("status", out var _) ||
            !payload.TryGetValue("val_id", out var _))
        {
            return false;
        }

        if (IsSandbox)
        {
            var verify = await VerifyAsync(payload["val_id"]!, ct);
            if (!verify.Success) return false;
        }

        return true;
    }

    public async Task<PaymentVerificationResult> VerifyAsync(string transactionId, CancellationToken ct = default)
    {
        var payload = new Dictionary<string, string>
        {
            ["store_id"] = StoreId,
            ["store_passwd"] = StorePassword,
            ["val_id"] = transactionId,
            ["format"] = "json",
        };

        var content = new FormUrlEncodedContent(payload);
        var response = await _http.PostAsync($"{BaseUrl}/gwprocess/v3/api.php", content, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);

        try
        {
            using var doc = JsonDocument.Parse(responseBody);
            var root = doc.RootElement;

            var status = root.TryGetProperty("status", out var s) ? s.GetString() ?? "failed" : "failed";
            var amount = root.TryGetProperty("amount", out var a) ? a.GetDecimal() : 0;
            var storeId = root.TryGetProperty("store_id", out var sid) ? sid.GetString() ?? string.Empty : string.Empty;

            if (!string.Equals(storeId, StoreId, StringComparison.OrdinalIgnoreCase))
            {
                return new PaymentVerificationResult(false, "failed", transactionId, 0, "Store ID mismatch");
            }

            var success = string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase) ||
                          string.Equals(status, "completed", StringComparison.OrdinalIgnoreCase);

            return new PaymentVerificationResult(
                success,
                success ? "paid" : "failed",
                transactionId,
                amount,
                success ? null : "Payment verification failed");
        }
        catch (Exception ex)
        {
            return new PaymentVerificationResult(false, "error", transactionId, 0, ex.Message);
        }
    }

    private static PaymentInitiationResult ParseInitiationResponse(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            var root = doc.RootElement;

            var status = root.TryGetProperty("status", out var s) ? s.GetString() ?? string.Empty : string.Empty;
            var gatewayUrl = root.TryGetProperty("GatewayPageURL", out var u) ? u.GetString() : null;
            var sessionId = root.TryGetProperty("sessionkey", out var k) ? k.GetString() : null;
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;

            if (string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase) && gatewayUrl != null)
            {
                return new PaymentInitiationResult(true, gatewayUrl, null, sessionId);
            }

            return new PaymentInitiationResult(false, null, error ?? "Initiation failed", null);
        }
        catch
        {
            if (body.Contains("GatewayPageURL") || body.Contains("https://"))
            {
                return new PaymentInitiationResult(true, body.Trim(), null, null);
            }
            return new PaymentInitiationResult(false, null, "Invalid gateway response", null);
        }
    }

    public static string GenerateSignature(string data, string secret)
    {
        using var hmac = new HMACSHA256(Encoding.UTF8.GetBytes(secret));
        var hash = hmac.ComputeHash(Encoding.UTF8.GetBytes(data));
        return Convert.ToHexString(hash).ToLowerInvariant();
    }
}