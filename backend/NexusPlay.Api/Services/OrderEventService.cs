using System.Collections.Concurrent;
using System.Runtime.CompilerServices;

namespace NexusPlay.Api.Services;

/// <summary>
/// In-memory SSE broadcast hub for real-time order tracking updates.
/// Maintains one channel per order number; clients subscribe via EventSource.
/// </summary>
public class OrderEventService
{
    /// <summary>Order number → queue of pending SSE events</summary>
    private readonly ConcurrentDictionary<string, ConcurrentQueue<string>> _events =
        new();

    /// <summary>Order number → count of active subscribers</summary>
    private readonly ConcurrentDictionary<string, int> _subscribers = new();

    /// <summary>Subscribe to events for an order. Returns an async enumerable of SSE payloads.</summary>
    public async IAsyncEnumerable<string> SubscribeAsync(
        string orderNo,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var queue = _events.GetOrAdd(orderNo, _ => new ConcurrentQueue<string>());
        _subscribers.AddOrUpdate(orderNo, 1, (_, c) => c + 1);

        try
        {
            while (!ct.IsCancellationRequested)
            {
                // Wait for an event or cancellation
                while (queue.IsEmpty && !ct.IsCancellationRequested)
                {
                    await Task.Delay(200, ct);
                }

                if (ct.IsCancellationRequested) break;

                if (queue.TryDequeue(out var evt))
                {
                    yield return evt;
                }
            }
        }
        finally
        {
            _subscribers.AddOrUpdate(orderNo, 0, (_, c) => c - 1);
        }
    }

    /// <summary>Publish an event to all subscribers of an order.</summary>
    public void Publish(string orderNo, string status, string? note = null)
    {
        if (!_events.TryGetValue(orderNo, out var queue)) return;

        var at = DateTime.UtcNow.ToString("o");
        var payload = $$"""
        {
          "status": "{{status}}",
          "note": "{{note ?? string.Empty}}",
          "at": "{{at}}"
        }
        """;

        var sse = $"event: order-status\ndata: {payload}\n\n";
        queue.Enqueue(sse);
    }

    /// <summary>Returns the number of active subscribers for an order (for diagnostics).</summary>
    public int SubscriberCount(string orderNo) =>
        _subscribers.TryGetValue(orderNo, out var c) ? c : 0;
}
