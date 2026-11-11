import type { EventStore, EventId, StreamId } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { JSONRPCMessage } from "@modelcontextprotocol/sdk/types.js";

/**
 * Simple in-memory EventStore for Streamable HTTP resumability.
 * Suitable for single-instance deployments; use persistent storage for multi-node.
 *
 * Bounded: every stored event retains its full JSON-RPC message (tool results
 * can be entire documents), so an unbounded store grows process memory for
 * the lifetime of every session. Keep only the most recent MAX_EVENTS —
 * resumability only needs a short replay window; older events are evicted
 * and a client replaying from an evicted id simply gets no replay.
 */
export class InMemoryEventStore implements EventStore {
  private static readonly MAX_EVENTS = 500;
  private events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();

  private generateEventId(streamId: StreamId): EventId {
    return `${streamId}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  private getStreamIdFromEventId(eventId: EventId): StreamId {
    return eventId.split("_")[0] ?? "";
  }

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const eventId = this.generateEventId(streamId);
    this.events.set(eventId, { streamId, message });
    // Map iteration order is insertion order — evict oldest first.
    while (this.events.size > InMemoryEventStore.MAX_EVENTS) {
      const oldest = this.events.keys().next().value;
      if (oldest === undefined) break;
      this.events.delete(oldest);
    }
    return eventId;
  }

  async replayEventsAfter(
    lastEventId: EventId,
    { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> },
  ): Promise<StreamId> {
    if (!lastEventId || !this.events.has(lastEventId)) {
      return "";
    }

    const streamId = this.getStreamIdFromEventId(lastEventId);
    if (!streamId) {
      return "";
    }

    let foundLastEvent = false;
    const sortedEvents = [...this.events.entries()].sort(([a], [b]) => a.localeCompare(b));

    for (const [eventId, { streamId: eventStreamId, message }] of sortedEvents) {
      if (eventStreamId !== streamId) {
        continue;
      }
      if (eventId === lastEventId) {
        foundLastEvent = true;
        continue;
      }
      if (foundLastEvent) {
        await send(eventId, message);
      }
    }

    return streamId;
  }
}
