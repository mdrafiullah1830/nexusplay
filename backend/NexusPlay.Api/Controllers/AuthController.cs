using System.Security.Claims;
using BCrypt.Net;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
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
    public async Task<ActionResult<AuthResponse>> Login(LoginRequest req, CancellationToken ct)
    {
        var user = await _users.GetByEmailAsync(req.Email ?? "", ct);
        if (user is null || !BCrypt.Net.BCrypt.Verify(req.Password ?? "", user.PasswordHash))
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

    private static UserDto ToDto(AppUser u) => new(u.Id, u.Name, u.Email, u.Phone, u.Role);
}
