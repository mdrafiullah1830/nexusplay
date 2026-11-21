using Microsoft.AspNetCore.Http;

namespace NexusPlay.Api.Middleware;

/// <summary>
/// Pass-through audit logger. It deliberately does not buffer response bodies:
/// buffering would prevent Server-Sent Events from streaming and could consume
/// unbounded memory for long-lived connections.
/// </summary>
public class AuditLogMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<AuditLogMiddleware> _logger;

    public AuditLogMiddleware(RequestDelegate next, ILogger<AuditLogMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var startedAt = System.Diagnostics.Stopwatch.GetTimestamp();
        var method = context.Request.Method;
        var path = context.Request.Path;
        var user = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity.Name ?? "authenticated"
            : "anonymous";

        try
        {
            await _next(context);
        }
        finally
        {
            var elapsedMs = System.Diagnostics.Stopwatch.GetElapsedTime(startedAt).TotalMilliseconds;
            var status = context.Response.StatusCode;

            // Never write query strings: order tracking puts phone numbers and
            // order references there. The path alone is enough for diagnostics.
            if (status >= 400 || elapsedMs > 500)
            {
                _logger.LogWarning(
                    "AUDIT | {Method} {Path} | User: {User} | Status: {Status} | Duration: {Duration:F0}ms",
                    method, path, user, status, elapsedMs);
            }
            else if (status >= 300)
            {
                _logger.LogInformation(
                    "AUDIT | {Method} {Path} | User: {User} | Status: {Status} | Duration: {Duration:F0}ms",
                    method, path, user, status, elapsedMs);
            }
        }
    }
}

public static class AuditLogMiddlewareExtensions
{
    public static IApplicationBuilder UseAuditLogging(this IApplicationBuilder app) =>
        app.UseMiddleware<AuditLogMiddleware>();
}