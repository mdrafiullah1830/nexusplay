using System.Net.Mail;
using Microsoft.Extensions.Configuration;

namespace NexusPlay.Api.Services;

public interface IEmailService
{
    Task SendAsync(string to, string subject, string body, CancellationToken ct = default);
}

public class EmailService : IEmailService
{
    private readonly IConfiguration _config;
    private readonly string? _smtpHost;
    private readonly int _smtpPort;
    private readonly string? _smtpUser;
    private readonly string? _smtpPass;
    private readonly string? _fromEmail;
    private readonly string? _fromName;

    public EmailService(IConfiguration config)
    {
        _config = config;
        _smtpHost = config["Email:Smtp:Host"];
        _smtpPort = int.TryParse(config["Email:Smtp:Port"], out var p) ? p : 587;
        _smtpUser = config["Email:Smtp:User"];
        _smtpPass = config["Email:Smtp:Password"];
        _fromEmail = config["Email:From:Address"];
        _fromName = config["Email:From:Name"];
    }

    public async Task SendAsync(string to, string subject, string body, CancellationToken ct = default)
    {
        // Skip if not configured - log and continue (fail silently in dev)
        if (string.IsNullOrEmpty(_smtpHost) || string.IsNullOrEmpty(_fromEmail))
        {
            // In production, this should be logged or surfaced
            return;
        }

        var client = new SmtpClient(_smtpHost, _smtpPort)
        {
            EnableSsl = true,
            Credentials = new System.Net.NetworkCredential(_smtpUser, _smtpPass),
        };

        var mail = new MailMessage
        {
            From = new MailAddress(_fromEmail, _fromName ?? "NexusPlay"),
            Subject = subject,
            Body = body,
            IsBodyHtml = true,
        };
        mail.To.Add(to);

        await client.SendMailAsync(mail);
    }
}
