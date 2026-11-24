using Google.Apis.Auth;

namespace NexusPlay.Api.Services;

public sealed class GoogleAuthService
{
    private readonly string? _clientId;

    public GoogleAuthService(IConfiguration config)
    {
        _clientId = config["Google:ClientId"]?.Trim();
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_clientId);

    public string? ClientId => _clientId;

    public async Task<GoogleIdentity> VerifyCredentialAsync(string credential, CancellationToken ct = default)
    {
        if (!IsConfigured)
            throw new InvalidOperationException("Google Sign-In is not configured");

        if (string.IsNullOrWhiteSpace(credential))
            throw new ArgumentException("Google credential is required", nameof(credential));

        var payload = await GoogleJsonWebSignature.ValidateAsync(
            credential,
            new GoogleJsonWebSignature.ValidationSettings
            {
                Audience = new[] { _clientId! },
            });

        if (!payload.EmailVerified ||
            string.IsNullOrWhiteSpace(payload.Email) ||
            string.IsNullOrWhiteSpace(payload.Subject))
        {
            throw new InvalidOperationException("Google did not provide a verified email address");
        }

        ct.ThrowIfCancellationRequested();

        return new GoogleIdentity(
            payload.Subject,
            payload.Email.Trim().ToLowerInvariant(),
            string.IsNullOrWhiteSpace(payload.Name) ? payload.Email : payload.Name.Trim());
    }
}

public sealed record GoogleIdentity(string Subject, string Email, string Name);
