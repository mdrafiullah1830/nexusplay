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

public class SmsService(IConfiguration config, HttpClient http) : ISmsService
{
    public async Task SendAsync(string to, string message, CancellationToken ct = default)
    {
        var senderId = config["Sms:SenderId"];
        if (string.IsNullOrWhiteSpace(senderId)) return;

        var provider = config["Sms:Provider"]?.ToLowerInvariant();
        var endpoint = config["Sms:Endpoint"];
        if (provider == "twilio")
        {
            var accountSid = config["Sms:AccountSid"];
            var apiKey = config["Sms:ApiKey"];
            if (string.IsNullOrWhiteSpace(accountSid) || string.IsNullOrWhiteSpace(apiKey)) return;
            endpoint ??= $"https://api.twilio.com/2010-04-01/Accounts/{accountSid}/Messages.json";
            using var request = new HttpRequestMessage(HttpMethod.Post, endpoint);
            var auth = Convert.ToBase64String(Encoding.ASCII.GetBytes($"{accountSid}:{apiKey}"));
            request.Headers.Authorization = new AuthenticationHeaderValue("Basic", auth);
            request.Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["From"] = senderId, ["To"] = to, ["Body"] = message,
            });
            using var response = await http.SendAsync(request, ct);
            response.EnsureSuccessStatusCode();
            return;
        }

        // Generic providers are opt-in and require a configured endpoint.
        if (string.IsNullOrWhiteSpace(endpoint)) return;
        using var genericRequest = new HttpRequestMessage(HttpMethod.Post, endpoint)
        {
            Content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["from"] = senderId, ["to"] = to, ["message"] = message,
            }),
        };
        using var genericResponse = await http.SendAsync(genericRequest, ct);
        genericResponse.EnsureSuccessStatusCode();
    }
}
