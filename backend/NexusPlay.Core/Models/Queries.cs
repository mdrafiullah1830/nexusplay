namespace NexusPlay.Core.Models;

/// <summary>Filter/query model for the product catalogue.</summary>
public class ProductQuery
{
    public string? Category { get; set; }
    public string? Brand { get; set; }
    public string? Stock { get; set; }
    public string? Q { get; set; }
    public decimal? Min { get; set; }
    public decimal? Max { get; set; }

    /// <summary>featured | price-asc | price-desc | newest | discount</summary>
    public string Sort { get; set; } = "featured";

    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 24;
}

public class OrderQuery
{
    public string? Status { get; set; }
    public string? Q { get; set; }
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 20;
}

public class PagedResult<T>
{
    public List<T> Items { get; set; } = new();
    public long Total { get; set; }
    public int Page { get; set; }
    public int PageSize { get; set; }
}
