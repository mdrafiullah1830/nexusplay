using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using NexusPlay.Api.Dtos;
using NexusPlay.Api.Services;
using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly IUserRepository _users;
    private readonly TokenService _tokens;
    private readonly GoogleAuthService _google;
    private readonly IWebHostEnvironment _environment;

    public AuthController(
        IUserRepository users,
        TokenService tokens,
        GoogleAuthService google,
        IWebHostEnvironment environment)
    {
        _users = users;
        _tokens = tokens;
        _google = google;
        _environment = environment;
    }

    [HttpPost("register")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Name, email and password are required" });

        if (req.Password.Length < 6)
            return BadRequest(new { message = "Password must be at least 6 characters" });

        if (await _users.GetByEmailAsync(req.Email, ct) is not null)
            return Conflict(new { message = "An account with this email already exists" });

        var user = new AppUser
        {
            Name = req.Name.Trim(),
            Email = req.Email.Trim(),
            Phone = req.Phone?.Trim(),
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.Password),
            Role = "user",
        };

        await _users.CreateAsync(user, ct);

        return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));
    }

    [HttpPost("login")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req, CancellationToken ct)
    {
        var user = await _users.GetByEmailAsync(req.Email ?? "", ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password ?? "", user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

        return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));
    }

    [HttpGet("google/config")]
    public ActionResult<object> GoogleConfig()
    {
        if (!_google.IsConfigured)
            return Ok(new { enabled = false, clientId = (string?)null });

        // Keep the CSRF cookie scoped to the API path. The frontend sends the
        // same value in the X-CSRF-Token header when exchanging the credential.
        var csrfToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        Response.Cookies.Append("nexusplay_google_csrf", csrfToken, new CookieOptions
        {
            HttpOnly = true,
            Secure = Request.IsHttps || !_environment.IsDevelopment(),
            SameSite = SameSiteMode.Strict,
            Expires = DateTimeOffset.UtcNow.AddMinutes(10),
            Path = "/api/auth/google",
        });

        return Ok(new { enabled = true, clientId = _google.ClientId, csrfToken });
    }

    [HttpPost("google")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> GoogleLogin(
        GoogleLoginRequest req,
        CancellationToken ct)
    {
        if (!_google.IsConfigured)
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Google Sign-In is not configured" });

        if (!Request.Cookies.TryGetValue("nexusplay_google_csrf", out var csrfCookie) ||
            string.IsNullOrWhiteSpace(req.CsrfToken) ||
            csrfCookie.Length != req.CsrfToken.Length ||
            !CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(csrfCookie),
                Encoding.UTF8.GetBytes(req.CsrfToken)))
        {
            return BadRequest(new { message = "Invalid or expired CSRF token" });
        }

        GoogleIdentity identity;
        try
        {
            identity = await _google.VerifyCredentialAsync(req.Credential ?? "", ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return Unauthorized(new { message = "Invalid or expired Google credential" });
        }

        var user = await _users.GetByGoogleSubjectAsync(identity.Subject, ct);
        if (user is not null)
            return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));

        // A Google account may match an existing email/password account. Ask
        // for that account's password before linking the two identities.
        var existing = await _users.GetByEmailAsync(identity.Email, ct);
        if (existing is not null)
        {
            if (existing.GoogleSubject is not null && existing.GoogleSubject != identity.Subject)
                return Conflict(new { message = "This email is connected to a different Google account" });

            if (string.IsNullOrWhiteSpace(existing.GoogleSubject))
            {
                if (string.IsNullOrWhiteSpace(req.Password))
                    return Conflict(new
                    {
                        message = "An account already exists for this email. Enter your password to connect Google.",
                        code = "password_required",
                    });

                if (string.IsNullOrWhiteSpace(existing.PasswordHash) ||
                    !BCrypt.Net.BCrypt.Verify(req.Password, existing.PasswordHash))
                    return Unauthorized(new { message = "Invalid password" });

                var name = string.IsNullOrWhiteSpace(existing.Name) ? identity.Name : null;
                if (!await _users.LinkGoogleSubjectAsync(existing.Id, identity.Subject, name, ct))
                    return Conflict(new { message = "This account was connected to another Google account" });

                existing.GoogleSubject = identity.Subject;
                if (name is not null) existing.Name = name;
            }

            return Ok(new AuthResponse(_tokens.CreateToken(existing), ToDto(existing)));
        }

        user = new AppUser
        {
            Name = identity.Name,
            Email = identity.Email,
            GoogleSubject = identity.Subject,
            // Google-only accounts do not have a password. Store a random hash
            // so they can never be mistaken for password-based accounts.
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString()),
            Role = "user",
        };

        try
        {
            await _users.CreateAsync(user, ct);
        }
        catch (MongoDB.Driver.MongoWriteException ex) when (
            ex.WriteError?.Category == MongoDB.Driver.ServerErrorCategory.DuplicateKey)
        {
            // Another request may have created/linked the same account while
            // this request was verifying the Google credential.
            user = await _users.GetByGoogleSubjectAsync(identity.Subject, ct);
            if (user is null)
                return Conflict(new { message = "This email is connected to a different Google account" });
        }

        return Ok(new AuthResponse(_tokens.CreateToken(user), ToDto(user)));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> Me(CancellationToken ct)
    {
        var userId = User.FindFirstValue("sub") ?? User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrEmpty(userId)) return Unauthorized();

        var user = await _users.GetAsync(userId, ct);
        return user is null ? Unauthorized() : Ok(ToDto(user));
    }

    private static UserDto ToDto(AppUser u) => new(u.Id, u.Name, u.Email, u.Phone, u.Role);
}
