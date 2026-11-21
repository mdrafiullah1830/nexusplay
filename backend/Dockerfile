# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["NexusPlay.Core/NexusPlay.Core.csproj", "NexusPlay.Core/"]
COPY ["NexusPlay.Data/NexusPlay.Data.csproj", "NexusPlay.Data/"]
COPY ["NexusPlay.Api/NexusPlay.Api.csproj", "NexusPlay.Api/"]
RUN dotnet restore "NexusPlay.Api/NexusPlay.Api.csproj"

COPY . .
RUN dotnet publish "NexusPlay.Api/NexusPlay.Api.csproj" \
    --configuration Release \
    --no-restore \
    --output /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app

COPY --from=build --chown=app:app /app/publish .
USER app

ENV ASPNETCORE_ENVIRONMENT=Production
EXPOSE 10000

# Render provides PORT (default 10000). Bind to all interfaces.
ENTRYPOINT ["sh", "-c", "dotnet NexusPlay.Api.dll --urls http://0.0.0.0:${PORT:-10000}"]