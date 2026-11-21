using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.FileProviders;
using Microsoft.IdentityModel.Tokens;
using NexusPlay.Api.Middleware;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Data;
using NexusPlay.Data.Repositories;

var builder = WebApplication.CreateBuilder(args);
var isDevelopment = builder.Environment.IsDevelopment();

var mongoConnection = builder.Configuration["Mongo:ConnectionString"];
if (string.IsNullOrWhiteSpace(mongoConnection))
{
    if (!isDevelopment)
        throw new InvalidOperationException("Mongo:ConnectionString must be configured.");
    mongoConnection = "mongodb://localhost:27017";
}

var jwtSecret = builder.Configuration["Jwt:Secret"];
if (string.IsNullOrWhiteSpace(jwtSecret))
{
    if (!isDevelopment)
        throw new InvalidOperationException("Jwt:Secret must be configured in production.");
    jwtSecret = "NexusPlay-local-development-secret-only-not-for-production-2026";
    builder.Configuration["Jwt:Secret"] = jwtSecret;
}
if (Encoding.UTF8.GetByteCount(jwtSecret) < 32)
    throw new InvalidOperationException("Jwt:Secret must be at least 32 bytes long.");

var corsOrigins = builder.Configuration.GetSection("Cors:Origins").Get<string[]>()
    ?? (isDevelopment ? new[] { "http://localhost:5173" } : Array.Empty<string>());
if (corsOrigins.Length == 0)
    throw new InvalidOperationException("At least one Cors:Origins entry must be configured.");
if (!isDevelopment && corsOrigins.Any(origin =>
        origin.Contains("localhost", StringComparison.OrdinalIgnoreCase)))
    throw new InvalidOperationException("Production Cors:Origins must contain the deployed frontend origin, not localhost.");

if (!isDevelopment)
{
    var publicUrl = builder.Configuration["App:PublicUrl"];
    if (!Uri.TryCreate(publicUrl, UriKind.Absolute, out var parsedPublicUrl) ||
        parsedPublicUrl.Scheme != Uri.UriSchemeHttps)
        throw new InvalidOperationException("App:PublicUrl must be the public HTTPS URL of this API in production.");
}

builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("AuthPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    options.AddPolicy("OrderPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));

    options.OnRejected = static async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"message\":\"Too many requests. Please try again later.\"}", cancellationToken);
    };

    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 120,
                Window = TimeSpan.FromMinutes(1),
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0,
            }));
});

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var mongoDatabase = builder.Configuration["Mongo:Database"] ?? "nexusplay";
builder.Services.AddSingleton(new MongoContext(mongoConnection, mongoDatabase));
builder.Services.AddSingleton<IProductRepository, ProductRepository>();
builder.Services.AddSingleton<IOrderRepository, OrderRepository>();
builder.Services.AddSingleton<IUserRepository, UserRepository>();
builder.Services.AddSingleton<IWishlistRepository, WishlistRepository>();

builder.Services.AddCors(options => options.AddPolicy("frontend", policy => policy
    .WithOrigins(corsOrigins)
    .AllowAnyHeader()
    .AllowAnyMethod()));

builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<OrderEventService>();
builder.Services.AddHttpClient<IPaymentService, PaymentService>(client =>
    client.Timeout = TimeSpan.FromSeconds(20));
builder.Services.AddHttpClient<ISmsService, SmsService>(client =>
    client.Timeout = TimeSpan.FromSeconds(15));
builder.Services.AddSingleton<IEmailService, EmailService>();

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
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
            RoleClaimType = "role",
            NameClaimType = "name",
            ClockSkew = TimeSpan.FromSeconds(30),
        };
    });
builder.Services.AddAuthorization();

var app = builder.Build();

app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
    context.Response.Headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()";
    await next();
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();
app.UseCors("frontend");
app.UseAuthentication();
app.UseAuthorization();
app.UseAuditLogging();
app.UseRateLimiter();

var uploadsDirectory = builder.Configuration["Storage:UploadsPath"];
if (!string.IsNullOrWhiteSpace(uploadsDirectory))
{
    var fullUploadsDirectory = Path.GetFullPath(uploadsDirectory);
    Directory.CreateDirectory(fullUploadsDirectory);
    app.UseStaticFiles();
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(fullUploadsDirectory),
        RequestPath = "/uploads/products",
    });
}
else
{
    app.UseStaticFiles();
}

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }))
    .AllowAnonymous();
app.MapControllers();

var context = app.Services.GetRequiredService<MongoContext>();
await context.EnsureIndexesAsync();
await ProductSeeder.SeedIfEmptyAsync(context);
await SeedAdminAsync(app.Services, app.Environment);

app.Run();

static async Task SeedAdminAsync(IServiceProvider services, IHostEnvironment environment)
{
    var users = services.GetRequiredService<IUserRepository>();
    var config = services.GetRequiredService<IConfiguration>();
    if (await users.AnyAsync()) return;

    var email = config["Admin:Email"]?.Trim();
    var password = config["Admin:Password"];
    if (string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(password))
    {
        if (!environment.IsDevelopment())
            throw new InvalidOperationException(
                "Admin:Email and Admin:Password are required to seed the first admin account.");
        Console.WriteLine("[seed] Admin seed skipped: configure Admin:Email and Admin:Password to create an admin.");
        return;
    }

    if (password.Length < 12)
        throw new InvalidOperationException("Admin:Password must be at least 12 characters.");

    await users.CreateAsync(new NexusPlay.Core.Models.AppUser
    {
        Name = "NexusPlay Admin",
        Email = email,
        PasswordHash = BCrypt.Net.BCrypt.HashPassword(password),
        Role = "admin",
    });
    Console.WriteLine("[seed] Initial admin account created from environment configuration.");
}