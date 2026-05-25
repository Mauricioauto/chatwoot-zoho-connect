import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

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
        const sinceIso = since > 0 ? new Date(since).toISOString() : null;

        let query = supabaseAdmin
          .from("chatwoot_events")
          .select("*")
          .order("received_at", { ascending: false })
          .limit(50);

        if (sinceIso) query = query.gt("received_at", sinceIso);

        const { data, error } = await query;
        if (error) {
          return new Response(
            JSON.stringify({ count: 0, events: [], error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        const events = (data ?? []).map((r: any) => ({
          id: String(r.id),
          receivedAt: new Date(r.received_at).getTime(),
          event: r.event,
          conversation_id: r.conversation_id,
          contact_id: r.contact_id,
          account_id: r.account_id,
          payload: r.payload,
        }));

        return new Response(
          JSON.stringify({ count: events.length, events }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
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

        const row = {
          event: body?.event ?? null,
          conversation_id: String(
            body?.conversation?.id ?? body?.id ?? body?.conversation_id ?? "",
          ) || null,
          contact_id: String(
            body?.sender?.id ??
              body?.contact?.id ??
              body?.meta?.sender?.id ??
              body?.contact_id ??
              "",
          ) || null,
          account_id: String(body?.account?.id ?? body?.account_id ?? "") || null,
          payload: body,
        };

        const { data, error } = await supabaseAdmin
          .from("chatwoot_events")
          .insert(row)
          .select("id")
          .single();

        if (error) {
          return new Response(
            JSON.stringify({ ok: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        return new Response(
          JSON.stringify({ ok: true, id: data?.id }),
          { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
        );
      },
    },
  },
});
