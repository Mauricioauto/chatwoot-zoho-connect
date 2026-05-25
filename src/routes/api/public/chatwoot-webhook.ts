import { createFileRoute } from "@tanstack/react-router";
import { addEvent, listEvents } from "@/lib/webhook-store.server";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export const Route = createFileRoute("/api/public/chatwoot-webhook")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      GET: async ({ request }) => {
        const url = new URL(request.url);
        const since = Number(url.searchParams.get("since") ?? "0");
        const events = listEvents(since);
        return new Response(
          JSON.stringify({ count: events.length, events }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      },

      POST: async ({ request }) => {
        let body: any = {};
        try {
          body = await request.json();
        } catch {
          try {
            const text = await request.text();
            body = { raw: text };
          } catch {
            body = {};
          }
        }
        const evt = addEvent(body);
        return new Response(
          JSON.stringify({ ok: true, id: evt.id }),
          {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      },
    },
  },
});
