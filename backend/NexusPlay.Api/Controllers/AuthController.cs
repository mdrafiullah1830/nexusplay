using System.ComponentModel.DataAnnotations;
using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
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

    public AuthController(IUserRepository users, TokenService tokens)
    {
        _users = users;
        _tokens = tokens;
    }

    [HttpPost("register")]
    [EnableRateLimiting("AuthPolicy")]
    public async Task<ActionResult<AuthResponse>> Register(RegisterRequest req, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(req.Name) || string.IsNullOrWhiteSpace(req.Email) ||
            string.IsNullOrWhiteSpace(req.Password))
            return BadRequest(new { message = "Name, email and password are required" });

        var email = req.Email.Trim().ToLowerInvariant();
        if (!new EmailAddressAttribute().IsValid(email))
            return BadRequest(new { message = "A valid email address is required" });

        if (req.Password.Length < 8)
            return BadRequest(new { message = "Password must be at least 8 characters" });

        if (await _users.GetByEmailAsync(email, ct) is not null)
            return Conflict(new { message = "An account with this email already exists" });

        var user = new AppUser
        {
            Name = req.Name.Trim(),
            Email = email,
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
        var email = req.Email?.Trim().ToLowerInvariant() ?? string.Empty;
        var user = await _users.GetByEmailAsync(email, ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password ?? string.Empty, user.PasswordHash))
            return Unauthorized(new { message = "Invalid email or password" });

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

    private static UserDto ToDto(AppUser user) =>
        new(user.Id, user.Name, user.Email, user.Phone, user.Role);
}