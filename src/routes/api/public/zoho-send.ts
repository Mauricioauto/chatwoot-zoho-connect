import { createFileRoute } from "@tanstack/react-router";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Server-side proxy for Zoho CRM API calls (avoids CORS).
// Body: { accessToken, method, path, body?, dataCenter? }
// dataCenter examples: "com" (default), "eu", "in", "com.au", "jp"
export const Route = createFileRoute("/api/public/zoho-send")({
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

        const {
          accessToken,
          method = "GET",
          path,
          body,
          dataCenter = "com",
        } = input ?? {};

        if (!accessToken || !path) {
          return new Response(
            JSON.stringify({ error: "Missing required fields: accessToken, path" }),
            { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }

        const cleanPath = String(path).startsWith("/") ? path : `/${path}`;
        const target = `https://www.zohoapis.${dataCenter}${cleanPath}`;

        try {
          const res = await fetch(target, {
            method,
            headers: {
              Authorization: `Zoho-oauthtoken ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: body ? JSON.stringify(body) : undefined,
          });

          const text = await res.text();
          let data: any = text;
          try {
            data = JSON.parse(text);
          } catch {
            // keep raw
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
            JSON.stringify({ error: err?.message ?? "Zoho request failed" }),
            { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders } },
          );
        }
      },
    },
  },
});
