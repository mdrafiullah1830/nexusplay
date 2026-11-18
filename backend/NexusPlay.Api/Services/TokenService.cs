using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using NexusPlay.Core.Models;

namespace NexusPlay.Api.Services;

public class TokenService
{
    private readonly string _issuer;
    private readonly string _audience;
    private readonly string _secret;
    private readonly int _expiryMinutes;

    public TokenService(IConfiguration config)
    {
        _issuer = config["Jwt:Issuer"] ?? "nexusplay";
        _audience = config["Jwt:Audience"] ?? "nexusplay-app";
        _secret = config["Jwt:Secret"] ?? "nexusplay-dev-secret-key-change-in-production-0123456789";
        _expiryMinutes = int.TryParse(config["Jwt:ExpiryMinutes"], out var m) ? m : 60 * 24 * 7;
    }

    public string CreateToken(AppUser user)
    {
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id),
            new(JwtRegisteredClaimNames.Email, user.Email),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new("name", user.Name),
            new("role", user.Role),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var now = DateTime.UtcNow;

        var token = new JwtSecurityToken(
            issuer: _issuer,
            audience: _audience,
            claims: claims,
            notBefore: now,
            expires: now.AddMinutes(_expiryMinutes),
            signingCredentials: creds);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
