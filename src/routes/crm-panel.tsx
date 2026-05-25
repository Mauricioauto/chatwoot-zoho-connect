import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  RefreshCcw,
  Settings,
  Lock,
  Unlock,
  Copy,
  Check,
  Phone,
  Mail,
  Building2,
  User,
  StickyNote,
  Briefcase,
  MessageSquare,
  Plus,
 import {
  // ... outros icones
  AlertCircle,
  Webhook,
  AlignLeft,      // <-- adicione esta linha
  Clock,          // <-- adicione esta linha
} from "lucide-react";

  Webhook,
} from "lucide-react";

export const Route = createFileRoute("/crm-panel")({
  head: () => ({
    meta: [
      { title: "CRM Panel — Chatwoot × Zoho" },
      {
        name: "description",
        content:
          "Painel embutido no Chatwoot que mostra dados reais do contato vindos do Zoho CRM via webhook.",
      },
    ],
  }),
  component: CrmPanelPage,
});

// ---------------- Types ----------------
type Config = {
  chatwootUrl: string;
  accountId: string;
  chatwootToken: string;
  zohoToken: string;
  zohoDc: string;
  unlockPassword: string;
};

const DEFAULT_CONFIG: Config = {
  chatwootUrl: "",
  accountId: "",
  chatwootToken: "",
  zohoToken: "",
  zohoDc: "com",
  unlockPassword: "1234",
};

const STORAGE_KEY = "crm-panel-config-v1";

// ---------------- Helpers ----------------
function loadConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: Config) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
}

function normalizePhone(p?: string | null) {
  if (!p) return "";
  return p.replace(/[^\d+]/g, "");
}

async function chatwootCall(
  cfg: Config,
  path: string,
  method = "GET",
  body?: any,
) {
  const res = await fetch("/api/public/chatwoot-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseUrl: cfg.chatwootUrl,
      apiToken: cfg.chatwootToken,
      method,
      path,
      body,
    }),
  });
  return res.json();
}

async function zohoCall(
  cfg: Config,
  path: string,
  method = "GET",
  body?: any,
) {
  const res = await fetch("/api/public/zoho-send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken: cfg.zohoToken,
      dataCenter: cfg.zohoDc || "com",
      method,
      path,
      body,
    }),
  });
  return res.json();
}

// ---------------- Component ----------------
function CrmPanelPage() {
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [draft, setDraft] = useState<Config>(DEFAULT_CONFIG);
  const [showSettings, setShowSettings] = useState(false);
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUnlocked, setWebhookUnlocked] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [copied, setCopied] = useState(false);
  const [webhookEventCount, setWebhookEventCount] = useState(0);

  const [conversationId, setConversationId] = useState<string | number | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [contact, setContact] = useState<any>(null);
  const [conversation, setConversation] = useState<any>(null);
  const [zohoContact, setZohoContact] = useState<any>(null);
  const [zohoDeals, setZohoDeals] = useState<any[]>([]);
  const [zohoNotes, setZohoNotes] = useState<any[]>([]);

  const [noteText, setNoteText] = useState("");
  const [dealName, setDealName] = useState("");
  const [dealAmount, setDealAmount] = useState("");
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const lastTsRef = useRef<number>(0);
  const baseOrigin = useMemo(
    () => (typeof window !== "undefined" ? window.location.origin : ""),
    [],
  );
  const webhookUrl = `${baseOrigin}/api/public/chatwoot-webhook`;

  // Load config + read conversation_id from URL/iframe param
  useEffect(() => {
    const cfg = loadConfig();
    setConfig(cfg);
    setDraft(cfg);

    const url = new URL(window.location.href);
    const fromQuery =
      url.searchParams.get("conversation_id") ||
      url.searchParams.get("id") ||
      url.searchParams.get("conversation");
    if (fromQuery) setConversationId(fromQuery);
  }, []);

  // Poll webhook for new conversation_ids
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/public/chatwoot-webhook?since=${lastTsRef.current}`,
        );
        const json = await res.json();
        const events: any[] = json?.events ?? [];
        if (events.length > 0) {
          setWebhookEventCount((c) => c + events.length);
          lastTsRef.current = Math.max(
            lastTsRef.current,
            ...events.map((e) => e.receivedAt),
          );
          // Latest event (events are newest first)
          const latest = events[0];
          const cid =
            latest.conversation_id ??
            latest.payload?.conversation?.id ??
            latest.payload?.id;
          if (cid) setConversationId(cid);
        }
      } catch {
        /* ignore */
      }
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // When conversation_id changes, fetch everything
  useEffect(() => {
    if (!conversationId) return;
    if (!config.chatwootUrl || !config.accountId || !config.chatwootToken) {
      setError("Configure Chatwoot URL, Account ID e Token nas configurações.");
      return;
    }
    fetchAll(conversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, config]);

  async function fetchAll(cid: string | number) {
    setLoading(true);
    setError(null);
    setZohoContact(null);
    setZohoDeals([]);
    setZohoNotes([]);
    try {
      const convRes = await chatwootCall(
        config,
        `/api/v1/accounts/${config.accountId}/conversations/${cid}`,
      );
      if (!convRes.ok) {
        throw new Error(
          `Chatwoot conversa: ${convRes.status} ${
            typeof convRes.data === "string"
              ? convRes.data
              : JSON.stringify(convRes.data).slice(0, 200)
          }`,
        );
      }
      setConversation(convRes.data);

      const contactId =
        convRes.data?.meta?.sender?.id ?? convRes.data?.contact?.id;
      if (!contactId) throw new Error("Contato não encontrado na conversa.");

      const contactRes = await chatwootCall(
        config,
        `/api/v1/accounts/${config.accountId}/contacts/${contactId}`,
      );
      if (!contactRes.ok) {
        throw new Error(
          `Chatwoot contato: ${contactRes.status}`,
        );
      }
      const ct = contactRes.data?.payload ?? contactRes.data;
      setContact(ct);

      const phone = normalizePhone(ct?.phone_number);
      if (phone && config.zohoToken) {
        await fetchZohoByPhone(phone);
      }
    } catch (e: any) {
      setError(e?.message ?? "Falha ao carregar dados.");
    } finally {
      setLoading(false);
    }
  }

  async function fetchZohoByPhone(phone: string) {
    // Zoho search by phone
    const search = await zohoCall(
      config,
      `/crm/v2/Contacts/search?phone=${encodeURIComponent(phone)}`,
    );
    const zc = search?.data?.data?.[0];
    if (zc) {
      setZohoContact(zc);
      const dealsRes = await zohoCall(
        config,
        `/crm/v2/Contacts/${zc.id}/Deals`,
      );
      setZohoDeals(dealsRes?.data?.data ?? []);
      const notesRes = await zohoCall(
        config,
        `/crm/v2/Contacts/${zc.id}/Notes`,
      );
      setZohoNotes(notesRes?.data?.data ?? []);
    }
  }

  function getLeadStatus(): { label: string; tone: string } {
    if (!zohoContact) return { label: "Lead", tone: "bg-amber-100 text-amber-800" };
    const status = (zohoContact.Lead_Status || zohoContact.Contact_Type || "").toString().toLowerCase();
    if (zohoDeals.some((d) => /won|ganho|cliente/i.test(d.Stage ?? "")))
      return { label: "Cliente", tone: "bg-emerald-100 text-emerald-800" };
    if (status.includes("prospect") || zohoDeals.length > 0)
      return { label: "Prospect", tone: "bg-sky-100 text-sky-800" };
    return { label: "Lead", tone: "bg-amber-100 text-amber-800" };
  }

  async function createZohoNote() {
    if (!zohoContact || !noteText.trim()) return;
    setActionMsg(null);
    const res = await zohoCall(config, `/crm/v2/Notes`, "POST", {
      data: [
        {
          Note_Title: "Chatwoot",
          Note_Content: noteText.trim(),
          Parent_Id: zohoContact.id,
          se_module: "Contacts",
        },
      ],
    });
    if (res.ok) {
      setNoteText("");
      setActionMsg("Nota criada com sucesso.");
      await fetchZohoByPhone(normalizePhone(contact?.phone_number));
    } else {
      setActionMsg(`Erro ao criar nota (${res.status}).`);
    }
  }

  async function createZohoDeal() {
    if (!zohoContact || !dealName.trim()) return;
    setActionMsg(null);
    const res = await zohoCall(config, `/crm/v2/Deals`, "POST", {
      data: [
        {
          Deal_Name: dealName.trim(),
          Amount: Number(dealAmount) || 0,
          Stage: "Qualification",
          Contact_Name: { id: zohoContact.id },
        },
      ],
    });
    if (res.ok) {
      setDealName("");
      setDealAmount("");
      setActionMsg("Deal criado com sucesso.");
      await fetchZohoByPhone(normalizePhone(contact?.phone_number));
    } else {
      setActionMsg(`Erro ao criar deal (${res.status}).`);
    }
  }

  function handleSaveSettings() {
    saveConfig(draft);
    setConfig(draft);
    setShowSettings(false);
  }

  function handleUnlock() {
    if (passwordInput === (config.unlockPassword || "1234")) {
      setWebhookUnlocked(true);
    } else {
      setActionMsg("Senha incorreta.");
    }
  }

  async function copyWebhook() {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const status = getLeadStatus();

  return (
    <div className="min-h-screen bg-sky-50 text-slate-800">
      <div className="mx-auto w-full max-w-[400px] p-3 space-y-3">
        {/* Header */}
        <header className="flex items-center justify-between bg-white rounded-xl shadow-sm px-3 py-2">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-sky-400 text-white grid place-items-center font-bold">
              C
            </div>
            <div>
              <h1 className="text-sm font-semibold leading-tight">CRM Panel</h1>
              <p className="text-[10px] text-slate-500 leading-tight">
                Chatwoot × Zoho CRM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => conversationId && fetchAll(conversationId)}
              disabled={!conversationId || loading}
              className="p-1.5 rounded-md hover:bg-sky-100 disabled:opacity-40"
              title="Atualizar"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
            <button
              onClick={() => setShowWebhookModal(true)}
              className="p-1.5 rounded-md hover:bg-sky-100"
              title="Integração Chatwoot"
            >
              <Webhook className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-1.5 rounded-md hover:bg-sky-100"
              title="Configurações"
            >
              <Settings className="h-4 w-4" />
            </button>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg p-2 flex gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Empty state */}
        {!conversationId && !loading && (
          <div className="bg-white rounded-xl shadow-sm p-4 text-center text-xs text-slate-500">
            Aguardando uma conversa do Chatwoot…
            <div className="mt-2 text-[11px] text-slate-400">
              O painel atualiza automaticamente quando o webhook recebe um
              evento.
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-2">
            <Skeleton h={80} />
            <Skeleton h={40} />
            <Skeleton h={100} />
          </div>
        )}

        {/* Contact card */}
        {!loading && contact && (
          <section className="bg-white rounded-xl shadow-sm p-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-full bg-sky-200 grid place-items-center text-sky-700 font-semibold">
                {(contact.name ?? "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm truncate flex items-center gap-1">
                  <User className="h-3.5 w-3.5 text-sky-500" />
                  {contact.name || "Sem nome"}
                </div>
                <span
                  className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full ${status.tone}`}
                >
                  {status.label}
                </span>
                     {/* Bloco existente da empresa */}
            <Row
              icon={<Building2 className="h-3.5 w-3.5" />}
              value={
                zohoContact?.Account_Name?.name ??
                contact.additional_attributes?.company_name
              }
            />
            
            {/* COPIE E COLE ESSES DOIS BLOCOS ABAIXO */}
            {zohoContact?.Description && (
              <Row
                icon={<AlignLeft className="h-3.5 w-3.5" />}
                value={`Descrição: ${zohoContact.Description}`}
              />
            )}
            
            {zohoContact?.Created_Time && (
              <Row
                icon={<Clock className="h-3.5 w-3.5" />}
                value={`Criado em: ${new Date(zohoContact.Created_Time).toLocaleString("pt-BR")}`}
              />
            )}

            </div>
            <Row icon={<Phone className="h-3.5 w-3.5" />} value={contact.phone_number} />
            <Row icon={<Mail className="h-3.5 w-3.5" />} value={contact.email} />
            <Row
              icon={<Building2 className="h-3.5 w-3.5" />}
              value={
                zohoContact?.Account_Name?.name ??
                contact.additional_attributes?.company_name
              }
            />
          </section>
        )}

        {/* Conversation info */}
        {!loading && conversation && (
          <section className="bg-white rounded-xl shadow-sm p-3">
            <h2 className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 text-sky-500" />
              Conversa #{conversation.id}
            </h2>
            <div className="text-[11px] text-slate-500 space-y-0.5">
              <div>Status: <b className="text-slate-700">{conversation.status}</b></div>
              {conversation.created_at && (
                <div>
                  Criada:{" "}
                  {new Date(
                    Number(conversation.created_at) * 1000,
                  ).toLocaleString("pt-BR")}
                </div>
              )}
              <div>
                Mensagens:{" "}
                <b className="text-slate-700">
                  {conversation.messages?.length ?? 0}
                </b>
              </div>
            </div>
          </section>
        )}

        {/* Zoho Deals */}
        {!loading && zohoContact && (
          <section className="bg-white rounded-xl shadow-sm p-3 space-y-2">
            <h2 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Briefcase className="h-3.5 w-3.5 text-sky-500" />
              Deals ({zohoDeals.length})
            </h2>
            {zohoDeals.length === 0 && (
              <p className="text-[11px] text-slate-400">Nenhum deal encontrado.</p>
            )}
            {zohoDeals.map((d) => (
              <div
                key={d.id}
                className="border border-sky-100 rounded-lg p-2 text-[11px] bg-sky-50/40"
              >
                <div className="font-medium text-slate-800 text-xs">
                  {d.Deal_Name}
                </div>
                <div className="flex justify-between text-slate-500 mt-1">
                  <span>{d.Stage}</span>
                  <span className="font-semibold text-sky-700">
                    R${" "}
                    {Number(d.Amount ?? 0).toLocaleString("pt-BR", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
                {d.Probability != null && (
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Probabilidade: {d.Probability}%
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Zoho Notes */}
        {!loading && zohoContact && (
          <section className="bg-white rounded-xl shadow-sm p-3 space-y-2">
            <h2 className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <StickyNote className="h-3.5 w-3.5 text-sky-500" />
              Notas ({zohoNotes.length})
            </h2>
            {zohoNotes.length === 0 && (
              <p className="text-[11px] text-slate-400">Sem notas.</p>
            )}
            {zohoNotes.slice(0, 5).map((n) => (
              <div
                key={n.id}
                className="text-[11px] border-l-2 border-sky-300 pl-2 py-0.5"
              >
                <div className="text-slate-700">{n.Note_Content}</div>
                <div className="text-[10px] text-slate-400">
                  {n.Created_Time
                    ? new Date(n.Created_Time).toLocaleString("pt-BR")
                    : ""}
                </div>
              </div>
            ))}
          </section>
        )}

        {/* Quick actions */}
        {!loading && zohoContact && (
          <section className="bg-white rounded-xl shadow-sm p-3 space-y-3">
            <h2 className="text-xs font-semibold text-slate-700">Ações rápidas</h2>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">Nova nota</label>
              <textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                rows={2}
                className="w-full text-xs border border-sky-200 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
                placeholder="Digite uma nota…"
              />
              <button
                onClick={createZohoNote}
                disabled={!noteText.trim()}
                className="w-full bg-sky-400 hover:bg-sky-500 text-white text-xs font-medium py-1.5 rounded-md flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Criar nota
              </button>
            </div>

            <div className="space-y-1 pt-2 border-t border-sky-100">
              <label className="text-[11px] text-slate-500">Novo deal</label>
              <input
                value={dealName}
                onChange={(e) => setDealName(e.target.value)}
                className="w-full text-xs border border-sky-200 rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                placeholder="Nome do deal"
              />
              <input
                value={dealAmount}
                onChange={(e) => setDealAmount(e.target.value)}
                type="number"
                className="w-full text-xs border border-sky-200 rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
                placeholder="Valor (R$)"
              />
              <button
                onClick={createZohoDeal}
                disabled={!dealName.trim()}
                className="w-full bg-sky-400 hover:bg-sky-500 text-white text-xs font-medium py-1.5 rounded-md flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <Plus className="h-3.5 w-3.5" /> Criar deal
              </button>
            </div>

            {actionMsg && (
              <p className="text-[11px] text-slate-600">{actionMsg}</p>
            )}
          </section>
        )}

        {/* Footer */}
        <p className="text-[10px] text-center text-slate-400 pt-2">
          Eventos recebidos no webhook: <b>{webhookEventCount}</b>
        </p>
      </div>

      {/* Settings modal */}
      {showSettings && (
        <Modal onClose={() => setShowSettings(false)} title="Configurações">
          <div className="space-y-2 text-xs">
            <Field
              label="Chatwoot URL"
              placeholder="https://app.chatwoot.com"
              value={draft.chatwootUrl}
              onChange={(v) => setDraft({ ...draft, chatwootUrl: v })}
            />
            <Field
              label="Account ID"
              value={draft.accountId}
              onChange={(v) => setDraft({ ...draft, accountId: v })}
            />
            <Field
              label="Chatwoot API Token"
              value={draft.chatwootToken}
              onChange={(v) => setDraft({ ...draft, chatwootToken: v })}
              type="password"
            />
            <Field
              label="Zoho Access Token"
              value={draft.zohoToken}
              onChange={(v) => setDraft({ ...draft, zohoToken: v })}
              type="password"
            />
            <Field
              label="Zoho Data Center (com, eu, in, com.au, jp)"
              value={draft.zohoDc}
              onChange={(v) => setDraft({ ...draft, zohoDc: v })}
            />
            <Field
              label="Senha para desbloquear webhook"
              value={draft.unlockPassword}
              onChange={(v) => setDraft({ ...draft, unlockPassword: v })}
              type="password"
            />
            <button
              onClick={handleSaveSettings}
              className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium py-2 rounded-md"
            >
              Salvar
            </button>
          </div>
        </Modal>
      )}

      {/* Webhook modal */}
      {showWebhookModal && (
        <Modal
          onClose={() => setShowWebhookModal(false)}
          title="Integração Chatwoot"
        >
          <div className="space-y-3 text-xs">
            <p className="text-slate-600">
              Cole esta URL em <b>Chatwoot › Settings › Integrations ›
              Webhooks</b>. O painel atualiza sozinho a cada novo evento.
            </p>

            <div className="space-y-1">
              <label className="text-[11px] text-slate-500">
                URL do Webhook
              </label>
              <div className="flex gap-1">
                <input
                  readOnly
                  value={
                    webhookUnlocked
                      ? webhookUrl
                      : "••••••••••••••••••••••••••••"
                  }
                  className="flex-1 text-[11px] border border-sky-200 rounded-md p-1.5 bg-sky-50 font-mono"
                />
                <button
                  onClick={copyWebhook}
                  disabled={!webhookUnlocked}
                  className="px-2 rounded-md bg-sky-400 text-white disabled:opacity-40"
                  title="Copiar"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>

            {!webhookUnlocked ? (
              <div className="space-y-2">
                <label className="text-[11px] text-slate-500 flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Senha
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full text-xs border border-sky-200 rounded-md p-1.5"
                  placeholder="Digite a senha"
                />
                <button
                  onClick={handleUnlock}
                  className="w-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium py-1.5 rounded-md flex items-center justify-center gap-1"
                >
                  <Unlock className="h-3.5 w-3.5" /> Desbloquear webhook
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-emerald-600 flex items-center gap-1">
                <Check className="h-3.5 w-3.5" /> Webhook desbloqueado
              </div>
            )}

            <div className="border-t border-sky-100 pt-2 text-[11px] text-slate-500">
              Eventos recebidos: <b>{webhookEventCount}</b>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ---------------- Subcomponents ----------------
function Row({ icon, value }: { icon: React.ReactNode; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-[11px] text-slate-600">
      <span className="text-sky-500">{icon}</span>
      <span className="truncate">{value}</span>
    </div>
  );
}

function Skeleton({ h }: { h: number }) {
  return (
    <div
      className="bg-white rounded-xl shadow-sm animate-pulse"
      style={{ height: h }}
    />
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full text-xs border border-sky-200 rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-sky-300"
      />
    </div>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-[380px] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-lg leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
