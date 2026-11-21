using System.Collections.Concurrent;
using System.Runtime.CompilerServices;
using System.Text.Json;

namespace NexusPlay.Api.Services;

/// <summary>
/// In-memory SSE broadcast hub for real-time order tracking updates.
/// </summary>
public class OrderEventService
{
    private readonly ConcurrentDictionary<string, ConcurrentQueue<string>> _events = new();
    private readonly ConcurrentDictionary<string, int> _subscribers = new();

    public async IAsyncEnumerable<string> SubscribeAsync(
        string orderNo,
        [EnumeratorCancellation] CancellationToken ct = default)
    {
        var queue = _events.GetOrAdd(orderNo, _ => new ConcurrentQueue<string>());
        _subscribers.AddOrUpdate(orderNo, 1, (_, count) => count + 1);

        try
        {
            while (!ct.IsCancellationRequested)
            {
                while (queue.IsEmpty && !ct.IsCancellationRequested)
                    await Task.Delay(200, ct);

                if (ct.IsCancellationRequested) break;
                if (queue.TryDequeue(out var evt))
                    yield return evt;
            }
        }
        finally
        {
            _subscribers.AddOrUpdate(orderNo, 0, (_, count) => Math.Max(0, count - 1));
        }
    }

    public void Publish(string orderNo, string status, string? note = null)
    {
        if (!_events.TryGetValue(orderNo, out var queue)) return;

        var payload = JsonSerializer.Serialize(new
        {
            status,
            note = note ?? string.Empty,
            at = DateTime.UtcNow,
        });

        queue.Enqueue($"event: order-status\ndata: {payload}\n\n");
    }

    public int SubscriberCount(string orderNo) =>
        _subscribers.TryGetValue(orderNo, out var count) ? count : 0;
}