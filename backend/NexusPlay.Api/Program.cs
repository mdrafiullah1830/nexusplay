
using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using NexusPlay.Api.Middleware;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Data;
using NexusPlay.Data.Repositories;

var builder = WebApplication.CreateBuilder(args);

// -- Rate Limiting ---------------------------------------------------------
builder.Services.AddRateLimiter(options =>
{
    // Policy: Throttle login/register to prevent brute force
    options.AddPolicy("AuthPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 2,
            }));

    // Policy: Loose per-IP API throttle
    options.AddPolicy("ApiPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10,
            }));

    // Policy: Concurrency cap for order placement
    options.AddPolicy("OrderPolicy", httpContext =>
        RateLimitPartition.GetConcurrencyLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new ConcurrencyLimiterOptions
            {
                PermitLimit = 5,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10,
            }));

    options.OnRejected = static async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = 429;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"error\": \"Too many requests\"}", cancellationToken);
    };

    // Global API throttle applied to every request. Swagger/docs requests are
    // placed in their own partition with no practical cap (replaces
    // RateLimiterOptions.GlobalFilters, which does not exist in .NET 8).
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
    {
        var isDocs = httpContext.Request.Path.StartsWithSegments(
            "/swagger", StringComparison.OrdinalIgnoreCase);

        return RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: isDocs
                ? "swagger"
                : httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = isDocs ? int.MaxValue : 100,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 10,
            });
    });
});

// -- MVC + JSON -----------------------------------------------------
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// -- MongoDB -----------------------------------------------------
var mongoConn = builder.Configuration["Mongo:ConnectionString"] ?? "mongodb://localhost:27017";
var mongoDb = builder.Configuration["Mongo:Database"] ?? "nexusplay";
builder.Services.AddSingleton(new MongoContext(mongoConn, mongoDb));
builder.Services.AddSingleton<IProductRepository, ProductRepository>();
builder.Services.AddSingleton<IOrderRepository, OrderRepository>();
builder.Services.AddSingleton<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IWishlistRepository, WishlistRepository>();

// -- CORS -------------------------------------------------------
var origins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
              ?? new[] { "http://localhost:5173" };
builder.Services.AddCors(o => o.AddPolicy("frontend", p => p
    .WithOrigins(origins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

// -- Services ---------------------------------------------------
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<OrderEventService>();

builder.Services.AddHttpClient<IPaymentService, PaymentService>();
builder.Services.AddSingleton<IPaymentService>(sp =>
{
    var clientFactory = sp.GetRequiredService<IHttpClientFactory>();
    return new PaymentService(sp.GetRequiredService<IConfiguration>(), clientFactory.CreateClient());
});

builder.Services.AddHttpClient<ISmsService, SmsService>();
builder.Services.AddSingleton<ISmsService>(sp =>
{
    var clientFactory = sp.GetRequiredService<IHttpClientFactory>();
    return new SmsService(sp.GetRequiredService<IConfiguration>(), clientFactory.CreateClient());
});

builder.Services.AddHttpClient<IEmailService, EmailService>();
builder.Services.AddSingleton<IEmailService>(sp =>
{
    var clientFactory = sp.GetRequiredService<IHttpClientFactory>();
    return new EmailService(sp.GetRequiredService<IConfiguration>());
});

// -- JWT auth -----------------------------------------------------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"] ?? "nexusplay",
            ValidAudience = builder.Configuration["Jwt:Audience"] ?? "nexusplay-app",
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:Secret"]
                    ?? "nexusplay-dev-secret-key-change-in-production-0123456789")),
            RoleClaimType = "role",
            NameClaimType = "name",
        };
    });
builder.Services.AddAuthorization();

// NOTE: everything registered on builder.Services must happen BEFORE Build().
var app = builder.Build();

// -- Security Headers -----------------------------------------------
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "SAMEORIGIN");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    context.Response.Headers.Append("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuditLogging();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();

// -- Rate Limiting -------------------------------------------------
app.UseRateLimiter();

// Serve uploaded product images (no-op when wwwroot is absent).
app.UseStaticFiles();

// Serve the built SPA from wwwroot when it exists (production hosting).
// In dev the frontend is served by Vite on :5173.
var spaIndex = Path.Combine(
    app.Environment.WebRootPath ?? Path.Combine(app.Environment.ContentRootPath, "wwwroot"),
    "index.html");
if (File.Exists(spaIndex))
{
    app.MapFallbackToFile("index.html");
}

app.MapControllers();

// -- Database bootstrap + seed ----------------------------------
var ctx = app.Services.GetRequiredService<MongoContext>();
await ctx.EnsureIndexesAsync();
await ProductSeeder.SeedIfEmptyAsync(ctx);
await SeedAdminAsync(app.Services);

app.Run();
return;

static async Task SeedAdminAsync(IServiceProvider services)
{
    var users = services.GetRequiredService<IUserRepository>();
    var config = services.GetRequiredService<IConfiguration>();
    if (await users.AnyAsync()) return;

    var email = config["Admin:Email"] ?? "admin@nexusplay.com";
    var password = config["Admin:Password"] ?? "Admin@123";

    await users.CreateAsync(new NexusPlay.Core.Models.AppUser
    {
        Name = "NexusPlay Admin",
        Email = email,
        Phone = "01782577251",
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        Role = "admin",
    });

    Console.WriteLine($"[seed] Admin account created: {email}");
}
