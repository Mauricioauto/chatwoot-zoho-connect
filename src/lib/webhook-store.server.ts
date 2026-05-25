// In-memory store for Chatwoot webhook events (per worker instance).
// Note: Cloudflare Workers can recycle isolates, so this is best-effort
// ephemeral storage suitable for testing.

export type WebhookEvent = {
  id: string;
  receivedAt: number;
  event?: string;
  conversation_id?: number | string;
  contact_id?: number | string;
  account_id?: number | string;
  payload: unknown;
};

const MAX_EVENTS = 200;

declare global {
  // eslint-disable-next-line no-var
  var __chatwoot_events__: WebhookEvent[] | undefined;
}

function store(): WebhookEvent[] {
  if (!globalThis.__chatwoot_events__) {
    globalThis.__chatwoot_events__ = [];
  }
  return globalThis.__chatwoot_events__;
}

export function addEvent(payload: any): WebhookEvent {
  const evt: WebhookEvent = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    receivedAt: Date.now(),
    event: payload?.event,
    conversation_id:
      payload?.conversation?.id ??
      payload?.id ??
      payload?.conversation_id,
    contact_id:
      payload?.sender?.id ??
      payload?.contact?.id ??
      payload?.meta?.sender?.id ??
      payload?.contact_id,
    account_id: payload?.account?.id ?? payload?.account_id,
    payload,
  };
  const s = store();
  s.unshift(evt);
  if (s.length > MAX_EVENTS) s.length = MAX_EVENTS;
  return evt;
}

export function listEvents(sinceTs?: number): WebhookEvent[] {
  const s = store();
  if (!sinceTs) return s;
  return s.filter((e) => e.receivedAt > sinceTs);
}

export function clearEvents() {
  globalThis.__chatwoot_events__ = [];
}
