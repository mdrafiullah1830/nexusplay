using NexusPlay.Core.Interfaces;
using NexusPlay.Core.Models;

namespace NexusPlay.Data;

/// <summary>Seeds the catalogue on first run (source: GamersGRIP product list).</summary>
public static class ProductSeeder
{
    public static async Task SeedIfEmptyAsync(IProductRepository products, CancellationToken ct = default)
    {
        if (await products.AnyAsync(ct)) return;

        var now = DateTime.UtcNow;
        var seed = new List<Product>
        {
            new() { Name = "8BitDo Ultimate 2c", Brand = "8BitDo", Category = "controllers",
                Price = 3099, OldPrice = 3500, Colours = new() { "Black", "White" },
                Compatibility = new() { "Windows 10+", "Android 9+" },
                Connectivity = "2.4G/wired on Windows; Bluetooth on Android",
                Stock = "in-stock", Rating = 4.6, CreatedAt = now.AddDays(-30) },

            new() { Name = "GameSir G7 Pro 8K PC × Phantom Blade Zero | Limited Edition", Brand = "GameSir",
                Category = "controllers", Price = 13499, OldPrice = 14200,
                Compatibility = new() { "PC", "Steam", "Switch", "Switch 2", "Android" },
                Connectivity = "Bluetooth, 2.4 GHz USB receiver, wired USB (3 m USB-C included)",
                Stock = "pre-order", Advance = 1000, Rating = 4.9, CreatedAt = now.AddDays(-2) },

            new() { Name = "Flydigi Apex 6 Pro", Brand = "Flydigi", Category = "controllers",
                Price = 15099, OldPrice = 17099,
                Compatibility = new() { "Windows 10/11", "Switch 1 & 2", "Android", "iOS" },
                Connectivity = "2.4GHz USB, Bluetooth, Wired",
                Stock = "pre-order", Advance = 1500, Rating = 4.8, CreatedAt = now.AddDays(-5) },

            new() { Name = "Flydigi Apex 6 Pro Shadow Blade Zero Limited Edition", Brand = "Flydigi",
                Category = "controllers", Price = 19499, OldPrice = 20500,
                Compatibility = new() { "Windows 10/11", "Switch 1 & 2", "Android", "iOS" },
                Connectivity = "2.4GHz USB, Bluetooth, Wired",
                Stock = "pre-order", Advance = 1500, Rating = 4.9, CreatedAt = now.AddDays(-4) },

            new() { Name = "GameSir Cyclone 2", Brand = "GameSir", Category = "controllers",
                Price = 5499, OldPrice = 6000, Colours = new() { "Black", "White" },
                Compatibility = new() { "PC/Steam", "Switch", "Android", "iOS" },
                Connectivity = "Bluetooth, 2.4G, USB wired",
                Stock = "pre-order", Rating = 4.7, CreatedAt = now.AddDays(-12) },

            new() { Name = "GameSir G7 pro", Brand = "GameSir", Category = "controllers",
                Price = 8300, OldPrice = 8700, Colours = new() { "Black", "White" },
                Compatibility = new() { "Xbox Series X|S/One", "PC", "Android" },
                Connectivity = "Xbox wired; PC 2.4G/wired; Android Bluetooth",
                Stock = "pre-order", Rating = 4.7, CreatedAt = now.AddDays(-20) },

            new() { Name = "GameSir G7 pro Wuchang Limited Edition", Brand = "GameSir",
                Category = "controllers", Price = 10499, OldPrice = 11000,
                Compatibility = new() { "Xbox Series X|S/One", "PC", "Android" },
                Connectivity = "2.4G/wired for Xbox & PC; Bluetooth for Android",
                Stock = "pre-order", Rating = 4.8, CreatedAt = now.AddDays(-8) },

            new() { Name = "GameSir G7 Pro 8k PC Black Edition", Brand = "GameSir",
                Category = "controllers", Price = 8699, OldPrice = 9300,
                Compatibility = new() { "PC" }, Connectivity = "2.4G + USB-C wired",
                Stock = "pre-order", Rating = 4.7, CreatedAt = now.AddDays(-7) },

            new() { Name = "GameSir G7 Pro 8k PC Aimlabs Edition", Brand = "GameSir",
                Category = "controllers", Price = 9999, OldPrice = 10500,
                Compatibility = new() { "PC" }, Connectivity = "2.4G + USB-C wired",
                Stock = "pre-order", Rating = 4.8, CreatedAt = now.AddDays(-6) },

            new() { Name = "GameSir Tarantula 8k PC", Brand = "GameSir", Category = "controllers",
                Price = 7499, OldPrice = 8000, Compatibility = new() { "PC" },
                Connectivity = "USB wired only",
                Stock = "pre-order", Rating = 4.5, CreatedAt = now.AddDays(-9) },

            new() { Name = "Flydigi Vader 5 Pro", Brand = "Flydigi", Category = "controllers",
                Price = 8499, OldPrice = 9000,
                Compatibility = new() { "PC", "Switch", "Android", "iOS" },
                Connectivity = "2.4G, Bluetooth, USB wired",
                Stock = "pre-order", Rating = 4.8, CreatedAt = now.AddDays(-11) },

            new() { Name = "Flydigi Apex 5", Brand = "Flydigi", Category = "controllers",
                Price = 12999, OldPrice = 14000,
                Compatibility = new() { "PC", "Switch/Switch 2", "Android", "iOS" },
                Connectivity = "2.4G, Bluetooth, USB wired",
                Stock = "pre-order", Rating = 4.7, CreatedAt = now.AddDays(-14) },

            new() { Name = "Dock 2 Pro", Brand = "Flydigi", Category = "other",
                Price = 3000, OldPrice = 3500, Colours = new() { "Black" },
                Compatibility = new() { "Apex 5", "Vader 5 Pro" },
                Charging = "Wireless fast charging; 150 FPS full-color display; RGB pixel base",
                Stock = "pre-order", Rating = 4.6, CreatedAt = now.AddDays(-15) },

            new() { Name = "Flydigi BS2 Pro Cooling Pad", Brand = "Flydigi", Category = "other",
                Price = 11999, OldPrice = 13000, Compatibility = new() { "Gaming laptops 15.6\"+" },
                Cooling = "27-blade high-pressure fan; up to 4000 RPM; Smart Fan 2.0",
                Stock = "pre-order", Rating = 4.5, CreatedAt = now.AddDays(-16) },

            new() { Name = "Flydigi BS3 Pro Cooling Pad", Brand = "Flydigi", Category = "other",
                Price = 14999, OldPrice = 15000, Compatibility = new() { "Gaming laptops 15.6\"+" },
                Cooling = "27-blade turbine fan; up to 4000 RPM; triple-sided intake; Smart 3.0",
                Stock = "pre-order", Rating = 4.6, CreatedAt = now.AddDays(-10) },

            new() { Name = "8BitDo Ultimate 2", Brand = "8BitDo", Category = "controllers",
                Price = 5900, OldPrice = 6200, Colours = new() { "Black", "White" },
                Compatibility = new() { "Windows 10+", "Android 13+", "SteamOS 3.7.13+", "Apple OS" },
                Connectivity = "2.4G/wired on Windows; Bluetooth on Android/Apple",
                Stock = "out-of-stock", Rating = 4.7, CreatedAt = now.AddDays(-25) },

            new() { Name = "GameSir Nova 2 lite", Brand = "GameSir", Category = "controllers",
                Price = 2900, OldPrice = 3200, Colours = new() { "Black", "White" },
                Compatibility = new() { "Switch", "PC/Steam", "Android", "iOS" },
                Connectivity = "Bluetooth, 2.4G, USB wired",
                Stock = "out-of-stock", Rating = 4.4, CreatedAt = now.AddDays(-26) },

            new() { Name = "Flydigi Vader 5 Pro with Dock", Brand = "Flydigi", Category = "controllers",
                Price = 10999, OldPrice = 11500,
                Compatibility = new() { "PC", "Switch", "Android", "iOS" },
                Controller = "FORCEFLEX Hall sticks, FORCESWITCH triggers, 8 extra buttons, 4-motor vibration",
                Dock = "Wireless charging; 150 FPS color display; RGB pixel base; 3x USB + 1x USB-C",
                Stock = "out-of-stock", Rating = 4.8, CreatedAt = now.AddDays(-18) },

            new() { Name = "Flydigi Apex 5 With Dock", Brand = "Flydigi", Category = "controllers",
                Price = 15900, OldPrice = 16700,
                Compatibility = new() { "PC", "Switch/Switch 2", "Android", "iOS" },
                Controller = "FORCEFLEX Hall sticks, FORCEADAPT triggers, 6 extra buttons, up to 1000 Hz, 6-axis gyro",
                Dock = "Wireless charging; 150 FPS color display; RGB pixel base; 3x USB + 1x USB-C",
                Stock = "out-of-stock", Rating = 4.7, CreatedAt = now.AddDays(-17) },

            new() { Name = "Flydigi Direwolf 4", Brand = "Flydigi", Category = "controllers",
                Price = 4199, OldPrice = 4500,
                Compatibility = new() { "PC", "Switch", "Android", "iOS" },
                Connectivity = "2.4G, Bluetooth, USB wired",
                Stock = "out-of-stock", Rating = 4.5, CreatedAt = now.AddDays(-22) },

            new() { Name = "EasySMX XO5 Pro", Brand = "EasySMX", Category = "controllers",
                Price = 3099, OldPrice = 3300, Colours = new() { "Black", "White" },
                Compatibility = new() { "Switch family", "Windows 7-11", "Android", "iOS" },
                Connectivity = "2.4G, Bluetooth, USB wired",
                Stock = "out-of-stock", Rating = 4.3, CreatedAt = now.AddDays(-24) },

            new() { Name = "EasySMX D10", Brand = "EasySMX", Category = "controllers",
                Price = 5099, OldPrice = 5500, Colours = new() { "Black", "White" },
                Compatibility = new() { "Switch family", "Windows 7-11", "Android", "iOS", "Steam Deck" },
                Connectivity = "2.4G, Bluetooth, USB wired",
                Stock = "out-of-stock", Rating = 4.4, CreatedAt = now.AddDays(-23) },
        };

        // Keep API product links in step with the storefront's catalogue. The
        // gateway imports the public source assets into R2 on first request.
        const string imageRoot = "https://ctrlzonebd-data.2251081204.workers.dev/images/product_images/";
        (string Id, string? ImagePath)[] identity =
        [
            ("8bitdo-ultimate-2c", "8BitDo_Ultimate_2c/01_angle.png"),
            ("gamesir-g7-pro-8k-phantom-blade", "GameSir_G7_Pro_8K_PC_Phantom_Blade_Zero_Limited_Edition/01_angle.webp"),
            ("flydigi-apex-6-pro", "Flydigi_Apex_6_Pro/01_angle.webp"),
            ("flydigi-apex-6-pro-shadow-blade", "Flydigi_Apex_6_Pro_Shadow_Blade_Zero_Limited_Edition/01_angle.webp"),
            ("gamesir-cyclone-2", "GameSir_Cyclone_2/01_angle.png"),
            ("gamesir-g7-pro", "GameSir_G7_pro/01_angle.png"),
            ("gamesir-g7-pro-wuchang", "GameSir_G7_pro_Wuchang_Limited_edition/01_angle.png"),
            ("gamesir-g7-pro-8k-black", "GameSir_G7_Pro_8k_PC_Black_Edition/01_angle.png"),
            ("gamesir-g7-pro-8k-aimlabs", "GameSir_G7_pro_8k_pc_Aimlabs_edition/01_angle.png"),
            ("gamesir-tarantula-8k", "GameSir_Tarantula_8k_pc/01_angle.png"),
            ("flydigi-vader-5-pro", "Flydigi_Vader_5_pro/01_angle.png"),
            ("flydigi-apex-5", "Flydigi_Apex_5/01_angle.png"),
            ("dock-2-pro", "Flydigi_Dock_2_Pro/01_angle.png"),
            ("flydigi-bs2-pro", "Flydigi_BS2_Pro/01_angle.png"),
            ("flydigi-bs3-pro", "Flydigi_BS3_Pro/01_angle.png"),
            ("8bitdo-ultimate-2", "8BitDo_Ultimate_2/01_angle.png"),
            ("gamesir-nova-2-lite", "GameSir_Nova_2_lite/01_angle.png"),
            ("flydigi-vader-5-pro-with-dock", "Flydigi_Vader_5_pro_with_Dock/01_angle.png"),
            ("flydigi-apex-5-with-dock", "Flydigi_Apex_5_With_Dock/01_angle.png"),
            ("flydigi-direwolf-4", "Flydigi_Direwolf_4/01_angle.png"),
            ("easysmx-xo5-pro", "EasySMX_XO5_Pro/01_angle.png"),
            ("easysmx-d10", null),
        ];

        if (seed.Count != identity.Length)
            throw new InvalidOperationException("Product catalogue identity count mismatch");

        for (var i = 0; i < seed.Count; i++)
        {
            seed[i].Id = identity[i].Id;
            if (identity[i].ImagePath is { } imagePath)
                seed[i].ImageUrls = [imageRoot + imagePath];
            await products.CreateAsync(seed[i], ct);
        }
    }
}
