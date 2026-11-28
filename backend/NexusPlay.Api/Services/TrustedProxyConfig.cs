using System.Net;
using Microsoft.AspNetCore.HttpOverrides;

namespace NexusPlay.Api.Services;

public static class TrustedProxyConfig
{
    public static IPAddress[] Parse(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return [];

        return value.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries)
            .Select(entry => IPAddress.TryParse(entry, out var address)
                ? address
                : throw new InvalidOperationException("Proxy:KnownProxies must contain only IP addresses."))
            .Distinct()
            .ToArray();
    }

    public static ForwardedHeadersOptions CreateOptions(IEnumerable<IPAddress> trustedProxies)
    {
        var addresses = trustedProxies.ToArray();
        if (addresses.Length == 0)
            throw new ArgumentException("At least one trusted proxy is required.", nameof(trustedProxies));

        var options = new ForwardedHeadersOptions
        {
            ForwardedHeaders = ForwardedHeaders.XForwardedFor,
            ForwardLimit = 1,
        };
        options.KnownNetworks.Clear();
        options.KnownProxies.Clear();
        foreach (var proxy in addresses)
            options.KnownProxies.Add(proxy);
        return options;
    }
}
