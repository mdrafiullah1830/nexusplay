using System.Globalization;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Services;

public interface IPaymentService
{
    Task<PaymentInitiationResult> InitiateAsync(
        Order order, string callbackUrl, string cancelUrl, string ipnUrl,
        CancellationToken ct = default);
    Task<PaymentVerificationResult> ProcessIpnAsync(
        Dictionary<string, string> payload, CancellationToken ct = default);
    Task<PaymentVerificationResult> VerifyAsync(string validationId, CancellationToken ct = default);
}

public record PaymentInitiationResult(
    bool Success, string? GatewayUrl, string? Error, string? SessionId);

public record PaymentVerificationResult(
    bool Success,
    string Status,
    string TransactionId,
    string OrderNo,
    decimal Amount,
    string Currency,
    string RiskLevel,
    string? Error);

public class PaymentService : IPaymentService
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public PaymentService(IConfiguration config, HttpClient http)
    {
        _config = config;
        _http = http;
    }

    private string StoreId => _config["SslCommerz:StoreId"] ?? string.Empty;
    private string StorePassword => _config["SslCommerz:StorePassword"] ?? string.Empty;
    private bool IsSandbox =>
        string.Equals(_config["SslCommerz:Mode"], "sandbox", StringComparison.OrdinalIgnoreCase);
    private string BaseUrl => IsSandbox
        ? "https://sandbox.sslcommerz.com"
        : "https://securepay.sslcommerz.com";

    private bool IsConfigured =>
        !string.IsNullOrWhiteSpace(StoreId) &&
        !string.IsNullOrWhiteSpace(StorePassword);

    public async Task<PaymentInitiationResult> InitiateAsync(
        Order order, string callbackUrl, string cancelUrl, string ipnUrl,
        CancellationToken ct = default)
    {
        if (!IsConfigured)
            return new PaymentInitiationResult(false, null,
                "SSLCOMMERZ credentials are not configured.", null);

        var payload = new Dictionary<string, string>
        {
            ["store_id"] = StoreId,
            ["store_passwd"] = StorePassword,
            ["total_amount"] = order.Total.ToString("F2", CultureInfo.InvariantCulture),
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

        try
        {
            using var response = await _http.PostAsync(
                $"{BaseUrl}/gwprocess/v4/api.php",
                new FormUrlEncodedContent(payload), ct);

            if (!response.IsSuccessStatusCode)
                return new PaymentInitiationResult(false, null,
                    "Payment gateway is temporarily unavailable.", null);

            var responseBody = await response.Content.ReadAsStringAsync(ct);
            return ParseInitiationResponse(responseBody);
        }
        catch (HttpRequestException)
        {
            return new PaymentInitiationResult(false, null,
                "Could not connect to the payment gateway.", null);
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return new PaymentInitiationResult(false, null,
                "Payment gateway request timed out.", null);
        }
    }

    public async Task<PaymentVerificationResult> ProcessIpnAsync(
        Dictionary<string, string> payload, CancellationToken ct = default)
    {
        if (!payload.TryGetValue("tran_id", out var postedOrderNo) ||
            !payload.TryGetValue("status", out var postedStatus) ||
            !payload.TryGetValue("val_id", out var validationId) ||
            !payload.TryGetValue("amount", out var postedAmount) ||
            !payload.TryGetValue("currency", out var postedCurrency) ||
            !IsSuccessStatus(postedStatus) ||
            !decimal.TryParse(postedAmount, NumberStyles.Number, CultureInfo.InvariantCulture, out var amount) ||
            !string.Equals(postedCurrency, "BDT", StringComparison.OrdinalIgnoreCase))
        {
            return Failed(ValidationIdOrEmpty(payload), "Invalid IPN payload.");
        }

        var verified = await VerifyAsync(validationId, ct);
        if (!verified.Success)
            return verified;

        if (!string.Equals(verified.OrderNo, postedOrderNo, StringComparison.Ordinal) ||
            Math.Abs(verified.Amount - amount) >= 0.01m ||
            !string.Equals(verified.Currency, "BDT", StringComparison.OrdinalIgnoreCase))
        {
            return Failed(validationId, "IPN data does not match the verified transaction.");
        }

        return verified;
    }

    public async Task<PaymentVerificationResult> VerifyAsync(
        string validationId, CancellationToken ct = default)
    {
        if (!IsConfigured)
            return Failed(validationId, "SSLCOMMERZ credentials are not configured.");
        if (string.IsNullOrWhiteSpace(validationId) || validationId.Length > 256)
            return Failed(validationId ?? string.Empty, "Invalid validation ID.");

        // SSLCOMMERZ's order-validation endpoint is a GET endpoint.
        var url = $"{BaseUrl}/validator/api/validationserverAPI.php" +
            $"?val_id={Uri.EscapeDataString(validationId)}" +
            $"&store_id={Uri.EscapeDataString(StoreId)}" +
            $"&store_passwd={Uri.EscapeDataString(StorePassword)}&format=json";

        try
        {
            using var response = await _http.GetAsync(url, ct);
            if (!response.IsSuccessStatusCode)
                return Failed(validationId, "Payment validation service returned an error.");

            var body = await response.Content.ReadAsStringAsync(ct);
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;

            var status = ReadString(root, "status");
            var responseValidationId = ReadString(root, "val_id");
            var storeId = ReadString(root, "store_id");
            var orderNo = ReadString(root, "tran_id");
            var currency = ReadString(root, "currency");
            var currencyType = ReadString(root, "currency_type");
            var amount = ReadDecimal(root, "amount");
            var riskLevel = ReadString(root, "risk_level");

            var valid = IsSuccessStatus(status) &&
                string.Equals(storeId, StoreId, StringComparison.Ordinal) &&
                string.Equals(responseValidationId, validationId, StringComparison.Ordinal) &&
                !string.IsNullOrWhiteSpace(orderNo) &&
                amount > 0 &&
                string.Equals(currency, "BDT", StringComparison.OrdinalIgnoreCase) &&
                (string.IsNullOrEmpty(currencyType) ||
                 string.Equals(currencyType, "BDT", StringComparison.OrdinalIgnoreCase)) &&
                riskLevel == "0";

            return new PaymentVerificationResult(
                valid,
                valid ? "paid" : "failed",
                validationId,
                orderNo,
                amount,
                currency,
                riskLevel,
                valid ? null : "Payment validation failed or transaction requires manual risk review.");
        }
        catch (HttpRequestException)
        {
            return Failed(validationId, "Could not connect to the payment validation service.");
        }
        catch (TaskCanceledException) when (!ct.IsCancellationRequested)
        {
            return Failed(validationId, "Payment validation request timed out.");
        }
        catch (JsonException)
        {
            return Failed(validationId, "Payment validation returned an invalid response.");
        }
        catch (InvalidOperationException)
        {
            return Failed(validationId, "Payment validation response is incomplete.");
        }
    }

    private static PaymentInitiationResult ParseInitiationResponse(string body)
    {
        try
        {
            using var document = JsonDocument.Parse(body);
            var root = document.RootElement;
            var status = ReadString(root, "status");
            var gatewayUrl = ReadString(root, "GatewayPageURL");
            var sessionId = ReadString(root, "sessionkey");

            if (!string.Equals(status, "SUCCESS", StringComparison.OrdinalIgnoreCase) ||
                !Uri.TryCreate(gatewayUrl, UriKind.Absolute, out var uri) ||
                uri.Scheme != Uri.UriSchemeHttps ||
                !(uri.Host.Equals("sslcommerz.com", StringComparison.OrdinalIgnoreCase) ||
                  uri.Host.EndsWith(".sslcommerz.com", StringComparison.OrdinalIgnoreCase)))
            {
                return new PaymentInitiationResult(false, null,
                    "Payment gateway could not create a secure checkout session.", null);
            }

            return new PaymentInitiationResult(true, uri.ToString(), null, sessionId);
        }
        catch (JsonException)
        {
            return new PaymentInitiationResult(false, null,
                "Payment gateway returned an invalid response.", null);
        }
    }

    private static bool IsSuccessStatus(string? status) =>
        string.Equals(status, "VALID", StringComparison.OrdinalIgnoreCase) ||
        string.Equals(status, "VALIDATED", StringComparison.OrdinalIgnoreCase);

    private static string ReadString(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value)) return string.Empty;
        return value.ValueKind == JsonValueKind.String
            ? value.GetString() ?? string.Empty
            : value.ToString();
    }

    private static decimal ReadDecimal(JsonElement root, string name)
    {
        if (!root.TryGetProperty(name, out var value)) return 0m;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number))
            return number;
        return decimal.TryParse(value.ToString(), NumberStyles.Number,
            CultureInfo.InvariantCulture, out var parsed) ? parsed : 0m;
    }

    private static string ValidationIdOrEmpty(Dictionary<string, string> payload) =>
        payload.TryGetValue("val_id", out var value) ? value : string.Empty;

    private static PaymentVerificationResult Failed(string validationId, string error) =>
        new(false, "failed", validationId, string.Empty, 0m, string.Empty, string.Empty, error);
}