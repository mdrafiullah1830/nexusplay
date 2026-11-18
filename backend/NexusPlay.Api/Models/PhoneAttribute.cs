using System.ComponentModel.DataAnnotations;
using System.Text.RegularExpressions;

namespace NexusPlay.Api.Models;

/// <summary>
/// Validation for Bangladeshi phone numbers.
/// Must match: 01[3-9][0-9]{8} (after stripping spaces/dashes)
/// </summary>
public class PhoneAttribute : ValidationAttribute
{
    protected override ValidationResult? IsValid(object? value, ValidationContext validationContext)
    {
        if (value is not string phone)
        {
            return new ValidationResult("Invalid phone number format");
        }

        // Strip spaces, dashes, and parentheses, then validate
        var cleaned = phone.Replace(" ", "").Replace("-", "").Replace("(", "").Replace(")", "");
        if (string.IsNullOrEmpty(cleaned) || !Regex.IsMatch(cleaned, @"^01[3-9]\d{8}$"))
        {
            return new ValidationResult("Phone number must be a valid Bangladeshi number (e.g., 01712345678)");
        }

        return ValidationResult.Success!;
    }
}