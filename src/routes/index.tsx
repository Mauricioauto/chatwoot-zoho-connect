import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Webhook } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "CRM Panel — Chatwoot × Zoho CRM" },
      {
        name: "description",
        content:
          "Painel embutido no Chatwoot que mostra dados reais do contato vindos do Zoho CRM via webhook.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-sky-50 text-slate-800 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-sky-400 text-white grid place-items-center font-bold">
            C
          </div>
          <div>
            <h1 className="text-lg font-semibold">CRM Panel</h1>
            <p className="text-xs text-slate-500">
              Integração Chatwoot × Zoho CRM via webhook
            </p>
          </div>
        </div>

        <p className="text-sm text-slate-600">
          Abra o painel e use como iframe dentro do Chatwoot. O webhook recebe os
          eventos automaticamente e o painel busca os dados reais do contato.
        </p>

        <div className="flex gap-2">
          <Link
            to="/crm-panel"
            className="flex-1 bg-sky-500 hover:bg-sky-600 text-white text-sm font-medium py-2.5 rounded-lg flex items-center justify-center gap-2"
          >
            Abrir CRM Panel <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="text-[11px] text-slate-500 bg-sky-50 border border-sky-100 rounded-lg p-3 flex gap-2">
          <Webhook className="h-4 w-4 shrink-0 text-sky-500" />
          <div>
            <div className="font-medium text-slate-700">Webhook</div>
            <code className="break-all">/api/public/chatwoot-webhook</code>
          </div>
        </div>
      </div>
    </div>
  );
}
