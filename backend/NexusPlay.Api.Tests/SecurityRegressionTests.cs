using System.Reflection;
using System.Net;
using System.Text;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Moq;
using NexusPlay.Api.Controllers;
using NexusPlay.Api.Middleware;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;

namespace NexusPlay.Api.Tests;

public class SecurityRegressionTests
{
    [Theory]
    [InlineData(nameof(AuthController.Register))]
    [InlineData(nameof(AuthController.Login))]
    [InlineData(nameof(AuthController.GoogleLogin))]
    public void AuthEndpointsUseTheAuthRateLimit(string actionName)
    {
        var action = typeof(AuthController).GetMethod(actionName);
        Assert.NotNull(action);
        Assert.Equal("AuthPolicy", action.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
    }

    [Fact]
    public void OrderPlacementUsesTheOrderConcurrencyLimit()
    {
        var action = typeof(OrdersController).GetMethod(nameof(OrdersController.Place));

        Assert.NotNull(action);
        Assert.Equal("OrderPolicy", action.GetCustomAttribute<EnableRateLimitingAttribute>()?.PolicyName);
    }

    [Fact]
    public void ForwardedClientIpRequiresAnExplicitSingleTrustedProxyHop()
    {
        var proxy = IPAddress.Parse("10.2.3.4");
        var options = TrustedProxyConfig.CreateOptions([proxy]);

        Assert.Equal(1, options.ForwardLimit);
        Assert.Equal(Microsoft.AspNetCore.HttpOverrides.ForwardedHeaders.XForwardedFor, options.ForwardedHeaders);
        Assert.Equal(proxy, Assert.Single(options.KnownProxies));
        Assert.Empty(options.KnownNetworks);
        Assert.Throws<ArgumentException>(() => TrustedProxyConfig.CreateOptions([]));
        Assert.Throws<InvalidOperationException>(() => TrustedProxyConfig.Parse("10.2.3.4,any"));
    }

    [Theory]
    [InlineData("10.2.3.4", "203.0.113.9")]
    [InlineData("10.2.3.5", "10.2.3.5")]
    public async Task ForwardedHeaderOnlyChangesIpForTheTrustedPeer(string peer, string expected)
    {
        var services = new ServiceCollection().AddLogging().BuildServiceProvider();
        var pipeline = new ApplicationBuilder(services);
        pipeline.UseForwardedHeaders(TrustedProxyConfig.CreateOptions([IPAddress.Parse("10.2.3.4")]));
        pipeline.Run(_ => Task.CompletedTask);

        var context = new DefaultHttpContext { RequestServices = services };
        context.Connection.RemoteIpAddress = IPAddress.Parse(peer);
        context.Request.Headers["X-Forwarded-For"] = "203.0.113.9";
        await pipeline.Build()(context);

        Assert.Equal(IPAddress.Parse(expected), context.Connection.RemoteIpAddress);
    }

    [Fact]
    public void GoogleCsrfCookieIsSecureOutsideDevelopmentBehindTlsTerminatingProxy()
    {
        var config = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?> { ["Google:ClientId"] = "test-client" })
            .Build();
        var environment = Mock.Of<IWebHostEnvironment>(env => env.EnvironmentName == "Production");
        var controller = new AuthController(
            Mock.Of<IUserRepository>(),
            new TokenService(config),
            new GoogleAuthService(config),
            environment)
        {
            ControllerContext = new Microsoft.AspNetCore.Mvc.ControllerContext
            {
                HttpContext = new DefaultHttpContext(),
            },
        };

        controller.GoogleConfig();

        Assert.Contains("nexusplay_google_csrf=", controller.Response.Headers.SetCookie.ToString());
        Assert.Contains("secure", controller.Response.Headers.SetCookie.ToString(), StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task AuditLoggingPreservesStreamingAndOmitsQueryValues()
    {
        var responseBody = new MemoryStream();
        var logger = new CapturingLogger<AuditLogMiddleware>();
        var context = new DefaultHttpContext();
        context.Response.Body = responseBody;
        context.Request.Method = "GET";
        context.Request.Path = "/api/orders/track";
        context.Request.QueryString = new QueryString("?phone=01712345678");

        var middleware = new AuditLogMiddleware(async httpContext =>
        {
            Assert.Same(responseBody, httpContext.Response.Body);
            httpContext.Response.StatusCode = StatusCodes.Status404NotFound;
            await httpContext.Response.WriteAsync("not found");
        }, logger);

        await middleware.InvokeAsync(context);

        Assert.Equal("not found", Encoding.UTF8.GetString(responseBody.ToArray()));
        var auditMessage = Assert.Single(logger.Messages);
        Assert.Contains("/api/orders/track", auditMessage);
        Assert.DoesNotContain("01712345678", auditMessage);
    }

    private sealed class CapturingLogger<T> : ILogger<T>
    {
        public List<string> Messages { get; } = [];

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(
            LogLevel logLevel,
            EventId eventId,
            TState state,
            Exception? exception,
            Func<TState, Exception?, string> formatter) =>
            Messages.Add(formatter(state, exception));
    }
}
