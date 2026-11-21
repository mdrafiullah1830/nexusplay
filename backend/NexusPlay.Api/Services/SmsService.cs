using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace NexusPlay.Api.Services;

public interface ISmsService
{
    Task SendAsync(string to, string message, CancellationToken ct = default);
}

/// <summary>
/// Optional Twilio SMS integration. It is disabled unless all credentials
/// are provided through environment variables.
/// </summary>
public class SmsService : ISmsService
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;
    private readonly ILogger<SmsService> _logger;

    public SmsService(IConfiguration config, HttpClient http, ILogger<SmsService> logger)
    {
        _config = config;
        _http = http;
        _logger = logger;
    }

    public async Task SendAsync(string to, string message, CancellationToken ct = default)
    {
        var provider = _config["Sms:Provider"]?.Trim().ToLowerInvariant() ?? "disabled";
        if (provider == "disabled")
            return;

        if (provider != "twilio")
        {
            _logger.LogWarning("SMS was not sent because provider {Provider} is unsupported.", provider);
            return;
        }

        var accountSid = _config["Sms:AccountSid"];
        var authToken = _config["Sms:AuthToken"];
        var from = _config["Sms:From"];
        if (string.IsNullOrWhiteSpace(accountSid) ||
            string.IsNullOrWhiteSpace(authToken) ||
            string.IsNullOrWhiteSpace(from))
        {
            _logger.LogWarning("SMS was not sent because Twilio credentials are incomplete.");
            return;
        }

        var destination = NormalizeDestination(to);
        var endpoint = $"https://api.twilio.com/2010-04-01/Accounts/{Uri.EscapeDataString(accountSid)}/Messages.json";
        using var request = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["From"] = from,
                ["To"] = destination,
                ["Body"] = message,
            }),
        };

        var auth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{authToken}"));
        request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);

        try
        {
            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                _logger.LogWarning("Twilio rejected an order notification (HTTP {StatusCode}).", (int)response.StatusCode);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send order confirmation SMS.");
        }
    }

    private static string NormalizeDestination(string phone)
    {
        var trimmed = phone.Trim();
        if (trimmed.StartsWith('+')) return trimmed;

        var digits = new string(trimmed.Where(char.IsDigit).ToArray());
        if (digits.StartsWith("880", StringComparison.Ordinal) && digits.Length == 13)
            return $"+{digits}";
        if (digits.StartsWith("01", StringComparison.Ordinal) && digits.Length == 11)
            return $"+88{digits}";

        return trimmed;
    }
}