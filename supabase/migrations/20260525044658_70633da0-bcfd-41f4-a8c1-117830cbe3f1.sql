
CREATE TABLE public.chatwoot_events (
  id BIGSERIAL PRIMARY KEY,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT,
  conversation_id TEXT,
  contact_id TEXT,
  account_id TEXT,
  payload JSONB NOT NULL
);

CREATE INDEX idx_chatwoot_events_received_at ON public.chatwoot_events(received_at DESC);

ALTER TABLE public.chatwoot_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read chatwoot_events"
ON public.chatwoot_events FOR SELECT
USING (true);

CREATE POLICY "public insert chatwoot_events"
ON public.chatwoot_events FOR INSERT
WITH CHECK (true);
