FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY NexusPlay.Core/NexusPlay.Core.csproj NexusPlay.Core/
COPY NexusPlay.Data/NexusPlay.Data.csproj NexusPlay.Data/
COPY NexusPlay.Api/NexusPlay.Api.csproj NexusPlay.Api/
RUN dotnet restore NexusPlay.Api/NexusPlay.Api.csproj
COPY . .
RUN dotnet publish NexusPlay.Api/NexusPlay.Api.csproj -c Release --no-restore -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://0.0.0.0:10000
EXPOSE 10000
ENTRYPOINT ["dotnet", "NexusPlay.Api.dll"]
