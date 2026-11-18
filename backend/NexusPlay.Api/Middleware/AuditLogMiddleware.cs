using System.Text;
using Microsoft.AspNetCore.Http;

namespace NexusPlay.Api.Middleware;

/// <summary>
/// Lightweight request audit logger.
/// Logs: timestamp, HTTP method, path, status code, response duration, user identity.
/// Used for security monitoring and debugging.
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
        var startTime = DateTime.UtcNow;
        var method = context.Request.Method;
        var path = context.Request.Path;
        var queryString = context.Request.QueryString.ToUriComponent();
        var user = context.User.Identity?.IsAuthenticated == true
            ? context.User.Identity.Name ?? "anonymous"
            : "anonymous";

        // Buffer response to capture status code
        var originalBody = context.Response.Body;
        using var responseBody = new MemoryStream();
        context.Response.Body = responseBody;

        try
        {
            await _next(context);
        }
        finally
        {
            context.Response.Body.Seek(0, SeekOrigin.Begin);
            await context.Response.Body.CopyToAsync(originalBody);
            context.Response.Body.Position = 0;

            var elapsedMs = DateTime.UtcNow.Subtract(startTime).TotalMilliseconds;
            var status = context.Response.StatusCode;

            // Only log warnings/errors or slow requests (>500ms)
            if (status >= 400 || elapsedMs > 500)
            {
                _logger.LogWarning("AUDIT | {Method} {Path}{Query} | User: {User} | Status: {Status} | Duration: {Duration:F0}ms",
                    method, path, queryString, user, status, elapsedMs);
            }
            else if (status >= 300)
            {
                _logger.LogInformation("AUDIT | {Method} {Path}{Query} | User: {User} | Status: {Status} | Duration: {Duration:F0}ms",
                    method, path, queryString, user, status, elapsedMs);
            }
        }
    }
}

public static class AuditLogMiddlewareExtensions
{
    public static IApplicationBuilder UseAuditLogging(this IApplicationBuilder app)
    {
        return app.UseMiddleware<AuditLogMiddleware>();
    }
}