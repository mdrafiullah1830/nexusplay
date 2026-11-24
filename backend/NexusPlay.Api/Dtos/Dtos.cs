namespace NexusPlay.Api.Dtos;

// -- Auth ------------------------------------------------------
public record RegisterRequest(string Name, string Email, string? Phone, string Password);
public record LoginRequest(string Email, string Password);
public record GoogleLoginRequest(string Credential, string CsrfToken, string? Password = null);
public record AuthResponse(string Token, UserDto User);
public record UserDto(string Id, string Name, string Email, string? Phone, string Role);

// -- Orders ----------------------------------------------------
public record CustomerDto(
    string Name, string Phone, string? Email,
    string Address, string? City, string? Area, string? Note);

public record PlaceItemDto(string ProductId, int Qty, string? Colour);

public record PlaceOrderRequest(
    CustomerDto Customer,
    List<PlaceItemDto> Items,
    string PaymentMethod,
    string? BkashTrxId,
    string? PaymentGateway);

public record TrackRequest(string OrderNo, string Phone);
public record StatusUpdateRequest(string Status, string? Note);
