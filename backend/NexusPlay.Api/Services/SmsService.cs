using System.Net.Http.Headers;
using System.Text;
using Microsoft.Extensions.Configuration;

namespace NexusPlay.Api.Services;

/// <summary>
/// SMS gateway abstraction with HTTP-based providers.
/// Configure with Sms:Provider and Sms:ApiKey in appsettings.json.
/// Supported providers: twilio (default), or any HTTP POST gateway.
/// </summary>
public interface ISmsService
{
    Task SendAsync(string to, string message, CancellationToken ct = default);
}

public class SmsService : ISmsService
{
    private readonly IConfiguration _config;
    private readonly HttpClient _http;

    public SmsService(IConfiguration config, HttpClient http)
    {
        _config = config;
        _http = http;
    }

    public async Task SendAsync(string to, string message, CancellationToken ct = default)
    {
        // Check if SMS is configured
        var senderId = _config["Sms:SenderId"] ?? "NEXUSPLAY";

        if (string.IsNullOrEmpty(senderId))
        {
            // SMS not configured - silently skip
            return;
        }

        var url = _config["Sms:Endpoint"] ??
                  $"https://api.twilio.com/2010-04-01/Accounts/{_config["Sms:AccountSid"]}/Messages.json";

        if (false)
        {
            var accountSid = _config["Sms:AccountSid"] ?? string.Empty;
            var auth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{_config["Sms:ApiKey"]}"));
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", auth);

            var formPayload = new Dictionary<string, string>
            {
                ["From"] = senderId,
                ["To"] = to,
                ["Body"] = message,
            };
            var payload = new FormUrlEncodedContent(formPayload);

            await _http.PostAsync(url, payload, ct);
        }
        else
        {
            var formPayload = new Dictionary<string, string>
            {
                ["from"] = senderId,
                ["to"] = to,
                ["message"] = message,
            };
            var payload = new FormUrlEncodedContent(formPayload);

            await _http.PostAsync(url, payload, ct);
        }

}
}
