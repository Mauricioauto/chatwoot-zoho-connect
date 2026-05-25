import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Server-side proxy to call Chatwoot APIs without CORS blocking.
// Body: { baseUrl, apiToken, method, path, body? }
export const Route = createFileRoute("/api/public/chatwoot-send")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, { status: 204, headers: corsHeaders }),

      POST: async ({ request }) => {
        let input: any;
        try {
          input = await request.json();
        } catch {
          return new Response(
            JSON.stringify({ error: "Invalid JSON body" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        const { baseUrl, apiToken, method = "GET", path, body } = input ?? {};
        if (!baseUrl || !apiToken || !path) {
          return new Response(
            JSON.stringify({
              error: "Missing required fields: baseUrl, apiToken, path",
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        const cleanBase = String(baseUrl).replace(/\/+$/, "");
        const cleanPath = String(path).startsWith("/") ? path : `/${path}`;
        const target = `${cleanBase}${cleanPath}`;

        try {
          const res = await fetch(target, {
            method,
            headers: {
              "Content-Type": "application/json",
              api_access_token: apiToken,
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          const text = await res.text();
          let data: any = text;
          try {
            data = JSON.parse(text);
          } catch {
            // keep as text
          }

          return new Response(
            JSON.stringify({ status: res.status, ok: res.ok, data }),
            {
              status: 200,
              headers: { "Content-Type": "application/json", ...corsHeaders },
            },
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: err?.message ?? "Request failed" }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      },
    },
  },
});
