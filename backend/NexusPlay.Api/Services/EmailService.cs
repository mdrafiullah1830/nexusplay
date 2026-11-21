using System.Net.Mail;

namespace NexusPlay.Api.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct = default);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly ILogger<EmailService> _logger;

    public EmailService(IConfiguration config, ILogger<EmailService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        var host = _config["Email:Smtp:Host"];
        var fromAddress = _config["Email:From:Address"];
        if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(fromAddress))
        {
            _logger.LogWarning("Order email skipped because SMTP is not configured.");
            return;
        }

        if (!MailAddress.TryCreate(to, out _) || !MailAddress.TryCreate(fromAddress, out _))
        {
            _logger.LogWarning("Order email skipped because the sender or recipient address is invalid.");
            return;
        }

        var port = int.TryParse(_config["Email:Smtp:Port"], out var configuredPort)
            ? Math.Clamp(configuredPort, 1, 65535)
            : 587;

        using var client = new SmtpClient(host, port)
        {
            EnableSsl = true,
            Credentials = new System.Net.NetworkCredential(
                _config["Email:Smtp:User"],
                _config["Email:Smtp:Password"]),
        };

        using var mail = new MailMessage
        {
            From = new MailAddress(fromAddress, _config["Email:From:Name"] ?? "NexusPlay"),
            Subject = subject,
            Body = body,
            IsBodyHtml = true,
        };
        mail.To.Add(to);

        try
        {
            ct.ThrowIfCancellationRequested();
            await client.SendMailAsync(mail);
        }
        catch (OperationCanceledException) when (ct.IsCancellationRequested)
        {
            throw;
        }
        catch (Exception ex)
        {
            // Notifications must not make an already-saved order look like it
            // failed. Keep the error server-side and let the order persist.
            _logger.LogError(ex, "Failed to send order confirmation email.");
        }
    }
}