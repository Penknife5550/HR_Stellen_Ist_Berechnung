"use client";

import { useState, useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Webhook, Plus, Trash2, Power, Send, X, Copy, Check,
  ArrowDownCircle, ArrowUpCircle, AlertTriangle, CheckCircle2,
  Clock, RefreshCw, Pencil,
} from "lucide-react";
import {
  createWebhookConfigAction,
  toggleWebhookConfigAktivAction,
  deleteWebhookConfigAction,
  createNotificationTargetAction,
  updateNotificationTargetAction,
  toggleNotificationTargetAktivAction,
  deleteNotificationTargetAction,
  testNotificationTargetAction,
  listRecentNotifications,
} from "./actions";

// ============================================================
// TYPES
// ============================================================

interface WebhookConfig {
  id: number;
  name: string;
  endpointTyp: string;
  apiKeyPrefix: string;
  aktiv: boolean;
  beschreibung: string | null;
  lastUsedAt: Date | null;
  erstelltVon: string | null;
  createdAt: Date;
}

interface NotificationTarget {
  id: number;
  name: string;
  url: string;
  secret: string | null;
  eventTypes: unknown;
  headers: unknown;
  aktiv: boolean;
  beschreibung: string | null;
  erstelltVon: string | null;
  createdAt: Date;
  updatedAt: Date;
}

interface SyncLog {
  id: number;
  syncDatum: Date;
  schuljahrText: string | null;
  termId: number | null;
  anzahlLehrer: number | null;
  anzahlAenderungen: number | null;
  status: string;
  fehlerDetails: string | null;
}

interface NotifLog {
  id: number;
  targetId: number | null;
  targetName: string | null;
  eventType: string;
  status: string;
  attemptCount: number;
  lastError: string | null;
  lastAttemptAt: Date | null;
  nextRetryAt: Date | null;
  httpStatus: number | null;
  createdAt: Date;
}

interface Props {
  initialConfigs: WebhookConfig[];
  initialTargets: NotificationTarget[];
  initialSyncLogs: SyncLog[];
  initialNotifLogs: NotifLog[];
}

const EVENT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "sync.completed", label: "Sync erfolgreich" },
  { value: "sync.failed", label: "Sync fehlgeschlagen" },
  { value: "lehrer.created", label: "Neuer Lehrer" },
  { value: "hauptdeputat.changed", label: "Hauptdeputat geaendert" },
];

function formatDatum(date: Date | null): string {
  if (!date) return "–";
  return new Date(date).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

// ============================================================
// MAIN COMPONENT
// ============================================================

type Tab = "incoming" | "outgoing" | "logs";

export function N8nWebhooksClient({
  initialConfigs, initialTargets, initialSyncLogs, initialNotifLogs,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("incoming");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [newKeyDialog, setNewKeyDialog] = useState<{ name: string; key: string } | null>(null);

  const [modal, setModal] = useState<null | "createConfig" | "createTarget" | "editTarget">(null);
  const [selectedTarget, setSelectedTarget] = useState<NotificationTarget | null>(null);

  // Auto-clear der Message nach 6s
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(null), 6000);
    return () => clearTimeout(t);
  }, [message]);

  // ----- Actions
  const [createConfigState, createConfigAction, creatingConfig] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createWebhookConfigAction(formData);
      if (result.success && result.plainKey) {
        setModal(null);
        setNewKeyDialog({
          name: String(formData.get("name") ?? ""),
          key: result.plainKey,
        });
        router.refresh();
      }
      return result;
    }, null
  );

  const [createTargetState, createTargetAction, creatingTarget] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await createNotificationTargetAction(formData);
      if (result.success) {
        setModal(null);
        setMessage({ type: "success", text: result.message ?? "Ziel angelegt." });
        router.refresh();
      }
      return result;
    }, null
  );

  const [updateTargetState, updateTargetAction, updatingTarget] = useActionState(
    async (_prev: unknown, formData: FormData) => {
      const result = await updateNotificationTargetAction(formData);
      if (result.success) {
        setModal(null);
        setSelectedTarget(null);
        setMessage({ type: "success", text: result.message ?? "Ziel aktualisiert." });
        router.refresh();
      }
      return result;
    }, null
  );

  // ----- Helpers
  const toggleConfig = async (c: WebhookConfig) => {
    const fd = new FormData();
    fd.set("id", String(c.id));
    fd.set("aktiv", String(!c.aktiv));
    const result = await toggleWebhookConfigAktivAction(fd);
    if (result.success) setMessage({ type: "success", text: result.message ?? "Geaendert." });
    else setMessage({ type: "error", text: result.error ?? "Fehler." });
    router.refresh();
  };

  const deleteConfig = async (c: WebhookConfig) => {
    if (!confirm(`Webhook "${c.name}" wirklich loeschen? Danach funktioniert der Key nicht mehr.`)) return;
    const fd = new FormData();
    fd.set("id", String(c.id));
    const result = await deleteWebhookConfigAction(fd);
    if (result.success) setMessage({ type: "success", text: result.message ?? "Geloescht." });
    else setMessage({ type: "error", text: result.error ?? "Fehler." });
    router.refresh();
  };

  const toggleTarget = async (t: NotificationTarget) => {
    const fd = new FormData();
    fd.set("id", String(t.id));
    fd.set("aktiv", String(!t.aktiv));
    const result = await toggleNotificationTargetAktivAction(fd);
    if (result.success) setMessage({ type: "success", text: result.message ?? "Geaendert." });
    else setMessage({ type: "error", text: result.error ?? "Fehler." });
    router.refresh();
  };

  const deleteTarget = async (t: NotificationTarget) => {
    if (!confirm(`Ziel "${t.name}" wirklich loeschen?`)) return;
    const fd = new FormData();
    fd.set("id", String(t.id));
    const result = await deleteNotificationTargetAction(fd);
    if (result.success) setMessage({ type: "success", text: result.message ?? "Geloescht." });
    else setMessage({ type: "error", text: result.error ?? "Fehler." });
    router.refresh();
  };

  const testTarget = async (t: NotificationTarget) => {
    const fd = new FormData();
    fd.set("id", String(t.id));
    const result = await testNotificationTargetAction(fd);
    if (result.success) setMessage({ type: "success", text: result.message ?? "Test OK." });
    else setMessage({ type: "error", text: result.error ?? "Test fehlgeschlagen." });
  };

  return (
    <div className="ml-[280px] p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Webhook size={28} className="text-[#575756]" />
            <div>
              <h1 className="text-2xl font-bold text-gray-800">N8N-Webhooks</h1>
              <p className="text-sm text-gray-500 mt-1">
                Eingehende Sync-Endpoints und ausgehende Benachrichtigungen verwalten
              </p>
            </div>
          </div>
          <button
            onClick={() => router.refresh()}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg"
            title="Aktualisieren"
          >
            <RefreshCw size={18} />
          </button>
        </div>

        {/* Status-Meldung */}
        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between ${
              message.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)}><X size={16} /></button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          {([
            ["incoming", "Eingehend (Sync-Keys)", ArrowDownCircle],
            ["outgoing", "Ausgehend (Notifications)", ArrowUpCircle],
            ["logs", "Protokolle", Clock],
          ] as const).map(([key, label, Icon]) => (
            <button
              key={key}
              onClick={() => setTab(key as Tab)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
                tab === key
                  ? "text-[#575756] border-[#575756]"
                  : "text-gray-500 border-transparent hover:text-gray-700"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </div>

        {/* TAB: Incoming */}
        {tab === "incoming" && (
          <IncomingTab
            configs={initialConfigs}
            onCreate={() => setModal("createConfig")}
            onToggle={toggleConfig}
            onDelete={deleteConfig}
          />
        )}

        {/* TAB: Outgoing */}
        {tab === "outgoing" && (
          <OutgoingTab
            targets={initialTargets}
            onCreate={() => setModal("createTarget")}
            onEdit={(t) => { setSelectedTarget(t); setModal("editTarget"); }}
            onToggle={toggleTarget}
            onDelete={deleteTarget}
            onTest={testTarget}
          />
        )}

        {/* TAB: Logs */}
        {tab === "logs" && (
          <LogsTab syncLogs={initialSyncLogs} initialNotifLogs={initialNotifLogs} />
        )}
      </div>

      {/* MODALS */}
      {modal === "createConfig" && (
        <Modal title="Neuen Sync-Webhook anlegen" onClose={() => setModal(null)}>
          <form action={createConfigAction} className="space-y-4">
            {(createConfigState as { error?: string })?.error && (
              <ErrorBox msg={(createConfigState as { error: string }).error} />
            )}
            <FormField label="Name" name="name" required autoFocus placeholder="z.B. Untis-Sync Produktion" />
            <FormField label="Beschreibung (optional)" name="beschreibung" placeholder="Wozu wird dieser Key verwendet?" />
            <input type="hidden" name="endpointTyp" value="sync" />
            <p className="text-xs text-gray-500">
              Ein neuer API-Key wird generiert und einmalig angezeigt.
              Bewahre ihn sicher auf — er kann danach nicht mehr eingesehen werden.
            </p>
            <ModalButtons onCancel={() => setModal(null)} submitLabel={creatingConfig ? "Wird angelegt..." : "Key erzeugen"} submitting={creatingConfig} />
          </form>
        </Modal>
      )}

      {modal === "createTarget" && (
        <Modal title="Neues Notification-Ziel" onClose={() => setModal(null)}>
          <TargetForm
            action={createTargetAction}
            submitting={creatingTarget}
            errorState={createTargetState}
            onCancel={() => setModal(null)}
            submitLabel="Anlegen"
          />
        </Modal>
      )}

      {modal === "editTarget" && selectedTarget && (
        <Modal title={`Ziel bearbeiten: ${selectedTarget?.name ?? ""}`} onClose={() => { setModal(null); setSelectedTarget(null); }}>
          <TargetForm
            action={updateTargetAction}
            submitting={updatingTarget}
            errorState={updateTargetState}
            onCancel={() => { setModal(null); setSelectedTarget(null); }}
            submitLabel="Speichern"
            target={selectedTarget}
          />
        </Modal>
      )}

      {/* Neuer Key Dialog — NUR HIER sichtbar */}
      {newKeyDialog && (
        <NewKeyDialog info={newKeyDialog} onClose={() => setNewKeyDialog(null)} />
      )}
    </div>
  );
}

// ============================================================
// TAB: INCOMING
// ============================================================

function IncomingTab({
  configs, onCreate, onToggle, onDelete,
}: {
  configs: WebhookConfig[];
  onCreate: () => void;
  onToggle: (c: WebhookConfig) => void;
  onDelete: (c: WebhookConfig) => void;
}) {
  const syncUrl = typeof window !== "undefined"
    ? `${window.location.origin}/api/deputate/sync`
    : "/api/deputate/sync";

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">So richtest du den Sync in N8N ein</div>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Webhook anlegen, Namen vergeben und Key erzeugen</li>
          <li>In N8N einen HTTP-Request-Node (POST) anlegen mit URL: <code className="bg-white/60 px-1 rounded">{syncUrl}</code></li>
          <li>Den generierten Key im Body-Feld <code className="bg-white/60 px-1 rounded">api_key</code> uebergeben</li>
        </ol>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#575756] text-white rounded-lg hover:bg-[#474746] text-sm font-medium"
        >
          <Plus size={16} />
          Neuer Sync-Webhook
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th>Name</Th>
              <Th>Typ</Th>
              <Th>Key-Praefix</Th>
              <Th>Status</Th>
              <Th>Letzter Aufruf</Th>
              <Th className="text-right">Aktionen</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {configs.map((c) => (
              <tr key={c.id} className={`hover:bg-gray-50 ${!c.aktiv ? "opacity-50" : ""}`}>
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-800">{c.name}</div>
                  {c.beschreibung && <div className="text-xs text-gray-500 mt-0.5">{c.beschreibung}</div>}
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{c.endpointTyp}</td>
                <td className="px-6 py-4 text-sm font-mono text-gray-500">{c.apiKeyPrefix}…</td>
                <td className="px-6 py-4"><StatusBadge aktiv={c.aktiv} /></td>
                <td className="px-6 py-4 text-sm text-gray-500">{formatDatum(c.lastUsedAt)}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-1">
                    <IconButton onClick={() => onToggle(c)} title={c.aktiv ? "Deaktivieren" : "Aktivieren"} tone={c.aktiv ? "danger" : "success"}>
                      <Power size={16} />
                    </IconButton>
                    <IconButton onClick={() => onDelete(c)} title="Loeschen" tone="danger">
                      <Trash2 size={16} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Noch keine Sync-Webhooks eingerichtet.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: OUTGOING
// ============================================================

function OutgoingTab({
  targets, onCreate, onEdit, onToggle, onDelete, onTest,
}: {
  targets: NotificationTarget[];
  onCreate: () => void;
  onEdit: (t: NotificationTarget) => void;
  onToggle: (t: NotificationTarget) => void;
  onDelete: (t: NotificationTarget) => void;
  onTest: (t: NotificationTarget) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <div className="font-semibold mb-1">Ausgehende Benachrichtigungen</div>
        Die Anwendung POSTet ein JSON-Payload an die hinterlegte URL. Falls ein Secret gesetzt ist,
        wird der Header <code className="bg-white/60 px-1 rounded">X-Signature: sha256=&lt;hmac&gt;</code> mitgeschickt.
        Bei Fehlern (nicht-2xx oder Timeout) werden bis zu 3 Versuche durchgefuehrt (1min, 5min, 15min).
      </div>

      <div className="flex justify-end">
        <button
          onClick={onCreate}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#575756] text-white rounded-lg hover:bg-[#474746] text-sm font-medium"
        >
          <Plus size={16} />
          Neues Ziel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <Th>Name</Th>
              <Th>URL</Th>
              <Th>Events</Th>
              <Th>Status</Th>
              <Th className="text-right">Aktionen</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {targets.map((t) => {
              const events = Array.isArray(t.eventTypes) ? (t.eventTypes as string[]) : [];
              return (
                <tr key={t.id} className={`hover:bg-gray-50 ${!t.aktiv ? "opacity-50" : ""}`}>
                  <td className="px-6 py-4">
                    <div className="font-medium text-gray-800">{t.name}</div>
                    {t.beschreibung && <div className="text-xs text-gray-500 mt-0.5">{t.beschreibung}</div>}
                  </td>
                  <td className="px-6 py-4 text-xs font-mono text-gray-600 max-w-xs truncate" title={t.url}>
                    {t.url}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {events.map((e) => (
                        <span key={e} className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-medium">
                          {e}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4"><StatusBadge aktiv={t.aktiv} /></td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      <IconButton onClick={() => onTest(t)} title="Test senden">
                        <Send size={16} />
                      </IconButton>
                      <IconButton onClick={() => onEdit(t)} title="Bearbeiten">
                        <Pencil size={16} />
                      </IconButton>
                      <IconButton onClick={() => onToggle(t)} title={t.aktiv ? "Deaktivieren" : "Aktivieren"} tone={t.aktiv ? "danger" : "success"}>
                        <Power size={16} />
                      </IconButton>
                      <IconButton onClick={() => onDelete(t)} title="Loeschen" tone="danger">
                        <Trash2 size={16} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {targets.length === 0 && (
          <div className="text-center py-12 text-gray-400 text-sm">
            Noch keine Notification-Ziele eingerichtet.
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// TAB: LOGS
// ============================================================

function LogsTab({
  syncLogs, initialNotifLogs,
}: {
  syncLogs: SyncLog[];
  initialNotifLogs: NotifLog[];
}) {
  const [notifLogs, setNotifLogs] = useState(initialNotifLogs);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "success" | "failed">("all");
  const [loading, setLoading] = useState(false);

  async function applyFilter(next: typeof statusFilter) {
    setStatusFilter(next);
    setLoading(true);
    try {
      const fresh = await listRecentNotifications(
        next === "all" ? { limit: 100 } : { status: next, limit: 100 }
      );
      setNotifLogs(fresh as NotifLog[]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Sync-Log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-semibold text-gray-800 text-sm">Untis-Sync Historie</h3>
          <p className="text-xs text-gray-500 mt-0.5">Die letzten {syncLogs.length} Sync-Aufrufe</p>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Schuljahr</Th>
                <Th>Lehrer</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {syncLogs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2 text-xs text-gray-600">{formatDatum(l.syncDatum)}</td>
                  <td className="px-5 py-2 text-xs text-gray-600">{l.schuljahrText ?? "–"}</td>
                  <td className="px-5 py-2 text-xs text-gray-600">{l.anzahlLehrer ?? "–"}</td>
                  <td className="px-5 py-2"><SyncStatusBadge status={l.status} error={l.fehlerDetails} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          {syncLogs.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">Keine Eintraege.</div>}
        </div>
      </div>

      {/* Notification-Log */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">Ausgehende Notifications</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? "Lade..." : `${notifLogs.length} Versandversuche${statusFilter !== "all" ? ` (${statusFilter})` : ""}`}
            </p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => applyFilter(e.target.value as typeof statusFilter)}
            disabled={loading}
            className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
          >
            <option value="all">Alle</option>
            <option value="pending">Wartend</option>
            <option value="success">Erfolg</option>
            <option value="failed">Fehler</option>
          </select>
        </div>
        <div className="max-h-[600px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <Th>Zeitpunkt</Th>
                <Th>Event / Ziel</Th>
                <Th>Versuche</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {notifLogs.map((l) => (
                <tr key={l.id} className="hover:bg-gray-50">
                  <td className="px-5 py-2 text-xs text-gray-600">{formatDatum(l.createdAt)}</td>
                  <td className="px-5 py-2 text-xs">
                    <div className="font-medium text-gray-700">{l.eventType}</div>
                    <div className="text-gray-500">{l.targetName ?? `#${l.targetId ?? "?"}`}</div>
                  </td>
                  <td className="px-5 py-2 text-xs text-gray-600">
                    {l.attemptCount}/3{l.httpStatus ? ` · HTTP ${l.httpStatus}` : ""}
                  </td>
                  <td className="px-5 py-2">
                    <NotifStatusBadge status={l.status} error={l.lastError} nextRetry={l.nextRetryAt} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {notifLogs.length === 0 && <div className="text-center py-8 text-gray-400 text-xs">Keine Eintraege.</div>}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// SHARED COMPONENTS
// ============================================================

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th className={`text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

function StatusBadge({ aktiv }: { aktiv: boolean }) {
  return (
    <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-medium ${
      aktiv ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
    }`}>
      {aktiv ? "Aktiv" : "Inaktiv"}
    </span>
  );
}

function SyncStatusBadge({ status, error }: { status: string; error: string | null }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-green-700 text-xs">
      <CheckCircle2 size={12} /> Erfolg
    </span>
  );
  if (status === "partial") return (
    <span className="inline-flex items-center gap-1 text-amber-700 text-xs" title={error ?? ""}>
      <AlertTriangle size={12} /> Teilweise
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-red-700 text-xs" title={error ?? ""}>
      <AlertTriangle size={12} /> Fehler
    </span>
  );
}

function NotifStatusBadge({ status, error, nextRetry }: { status: string; error: string | null; nextRetry: Date | null }) {
  if (status === "success") return (
    <span className="inline-flex items-center gap-1 text-green-700 text-xs">
      <CheckCircle2 size={12} /> Gesendet
    </span>
  );
  if (status === "pending") return (
    <span className="inline-flex items-center gap-1 text-amber-700 text-xs" title={nextRetry ? `Retry um ${formatDatum(nextRetry)}` : ""}>
      <Clock size={12} /> Wartend
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-red-700 text-xs" title={error ?? ""}>
      <AlertTriangle size={12} /> Fehlgeschlagen
    </span>
  );
}

function IconButton({
  onClick, title, tone = "default", children,
}: {
  onClick: () => void;
  title: string;
  tone?: "default" | "danger" | "success";
  children: React.ReactNode;
}) {
  const color =
    tone === "danger" ? "text-gray-400 hover:text-red-600 hover:bg-red-50"
    : tone === "success" ? "text-gray-400 hover:text-green-600 hover:bg-green-50"
    : "text-gray-400 hover:text-gray-700 hover:bg-gray-100";
  return (
    <button onClick={onClick} title={title} className={`p-2 rounded-lg transition-colors ${color}`}>
      {children}
    </button>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl max-w-lg w-full mx-4 p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800">{title}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700 rounded">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function FormField({
  label, name, type = "text", required = false, defaultValue, placeholder, autoFocus = false,
}: {
  label: string; name: string; type?: string; required?: boolean;
  defaultValue?: string; placeholder?: string; autoFocus?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        name={name} type={type} required={required}
        defaultValue={defaultValue} placeholder={placeholder} autoFocus={autoFocus}
        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent placeholder:text-gray-400"
      />
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm">
      {msg}
    </div>
  );
}

function ModalButtons({
  onCancel, submitLabel, submitting,
}: { onCancel: () => void; submitLabel: string; submitting: boolean }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">
        Abbrechen
      </button>
      <button
        type="submit" disabled={submitting}
        className="px-4 py-2.5 bg-[#575756] text-white rounded-lg text-sm font-medium hover:bg-[#474746] disabled:opacity-50"
      >
        {submitLabel}
      </button>
    </div>
  );
}

function TargetForm({
  action, submitting, errorState, onCancel, submitLabel, target,
}: {
  action: (formData: FormData) => void;
  submitting: boolean;
  errorState: unknown;
  onCancel: () => void;
  submitLabel: string;
  target?: NotificationTarget;
}) {
  const defaultEvents = target && Array.isArray(target.eventTypes)
    ? (target.eventTypes as string[])
    : [];
  return (
    <form action={action} className="space-y-4">
      {(errorState as { error?: string })?.error && (
        <ErrorBox msg={(errorState as { error: string }).error} />
      )}
      {target && <input type="hidden" name="id" value={target.id} />}
      <FormField label="Name" name="name" required autoFocus defaultValue={target?.name} placeholder="z.B. N8N Benachrichtigungen" />
      <FormField label="URL" name="url" type="url" required defaultValue={target?.url} placeholder="https://n8n.example.com/webhook/..." />
      <FormField label="Secret (optional, fuer HMAC-Signatur)" name="secret" defaultValue={target?.secret ?? ""} placeholder="Shared Secret" />
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Abonnierte Events</label>
        <div className="space-y-1.5">
          {EVENT_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="eventTypes"
                value={opt.value}
                defaultChecked={defaultEvents.includes(opt.value)}
                className="rounded border-gray-300 text-[#575756] focus:ring-[#575756]"
              />
              <span className="font-mono text-xs text-gray-500 w-44">{opt.value}</span>
              <span className="text-gray-700">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
        <textarea
          name="beschreibung"
          defaultValue={target?.beschreibung ?? ""}
          rows={2}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#575756] focus:border-transparent"
        />
      </div>
      <ModalButtons onCancel={onCancel} submitLabel={submitting ? "Wird gespeichert..." : submitLabel} submitting={submitting} />
    </form>
  );
}

function NewKeyDialog({ info, onClose }: { info: { name: string; key: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(info.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="text-green-600" size={24} />
          <h2 className="text-lg font-bold text-gray-800">Webhook angelegt</h2>
        </div>
        <p className="text-sm text-gray-600 mb-3">
          Key fuer <strong>{info.name}</strong> wurde erzeugt. Kopiere ihn jetzt — er kann danach
          <strong> nicht mehr eingesehen werden</strong>.
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
          <div className="font-mono text-xs break-all text-gray-800">{info.key}</div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={copy}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#575756] text-white rounded-lg hover:bg-[#474746] text-sm font-medium"
          >
            {copied ? <Check size={16} /> : <Copy size={16} />}
            {copied ? "Kopiert!" : "Key kopieren"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 text-sm font-medium"
          >
            Schliessen
          </button>
        </div>
      </div>
    </div>
  );
}
