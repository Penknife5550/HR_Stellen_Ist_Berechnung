"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  STELLENANTEIL_STATUS_FARBEN,
  STELLENANTEIL_STATUS_LABELS,
  ZEITRAUM_OPTIONS,
  SCHULFORM_CONFIG,
} from "@/lib/constants";
import {
  createStellenanteilAction,
  updateStellenanteilAction,
  deleteStellenanteilAction,
  updateStellenanteilStatusAction,
} from "./actions";

type StellenanteilRow = {
  id: number;
  stellenartTypId: number;
  stellenartBezeichnung: string;
  stellenartKurz: string | null;
  bindungstyp: string;
  istIsoliert: boolean;
  rechtsgrundlage: string | null;
  lehrerId: number | null;
  lehrerName: string | null;
  lehrerPersonalnr: string | null;
  wert: string;
  zeitraum: string;
  status: string;
  befristetBis: string | null;
  antragsdatum: string | null;
  aktenzeichen: string | null;
  dmsDokumentennummer: string | null;
  bemerkung: string | null;
};

type Props = {
  schulen: Array<{ id: number; kurzname: string; name: string; farbe: string }>;
  stellenanteileBySchule: Record<number, StellenanteilRow[]>;
  stellenarten: Array<{
    id: number;
    bezeichnung: string;
    kurzbezeichnung: string | null;
    bindungstyp: string;
    rechtsgrundlage: string | null;
  }>;
  lehrerBySchule: Record<number, Array<{ id: number; vollname: string; personalnummer: string | null }>>;
  defaultSchuleId: number;
  haushaltsjahrId: number;
};

const ZEITRAUM_LABELS: Record<string, string> = {};
for (const z of ZEITRAUM_OPTIONS) {
  ZEITRAUM_LABELS[z.value] = z.label;
}

function getBefristungWarning(befristetBis: string | null): "expired" | "warning" | null {
  if (!befristetBis) return null;
  const now = new Date();
  const bis = new Date(befristetBis + "T00:00:00");
  if (bis < now) return "expired";
  const diffMs = bis.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays <= 90) return "warning";
  return null;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function StellenanteileClient({
  schulen,
  stellenanteileBySchule,
  stellenarten,
  lehrerBySchule,
  defaultSchuleId,
  haushaltsjahrId,
}: Props) {
  const router = useRouter();
  const [activeSchuleId, setActiveSchuleId] = useState(defaultSchuleId);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [selectedStellenartId, setSelectedStellenartId] = useState<number>(0);
  const [editStellenartId, setEditStellenartId] = useState<number>(0);

  const activeSchule = schulen.find((s) => s.id === activeSchuleId);
  const rows = stellenanteileBySchule[activeSchuleId] ?? [];
  const lehrerList = lehrerBySchule[activeSchuleId] ?? [];

  // Bindungstyp der ausgewaehlten Stellenart (fuer Add-Form)
  const selectedStellenart = stellenarten.find((sa) => sa.id === selectedStellenartId);
  const showLehrerDropdown = selectedStellenart?.bindungstyp === "person" || selectedStellenart?.bindungstyp === "beides";

  // Bindungstyp der editierten Stellenart
  const editStellenart = stellenarten.find((sa) => sa.id === editStellenartId);
  const showEditLehrerDropdown = editStellenart?.bindungstyp === "person" || editStellenart?.bindungstyp === "beides";

  // Summe genehmigter Stellen
  const summeGenehmigt = rows
    .filter((r) => r.status === "genehmigt")
    .reduce((acc, r) => acc + Number(r.wert), 0);

  async function handleCreate(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await createStellenanteilAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert." });
      setShowAdd(false);
      setSelectedStellenartId(0);
      router.refresh();
    }
  }

  async function handleUpdate(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await updateStellenanteilAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Aktualisiert." });
      setEditingId(null);
      setEditStellenartId(0);
      router.refresh();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Stellenanteil wirklich loeschen?")) return;
    setSaving(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    const result = await deleteStellenanteilAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Geloescht." });
      router.refresh();
    }
  }

  async function handleStatusChange(id: number, newStatus: string) {
    setSaving(true);
    setMessage(null);
    const formData = new FormData();
    formData.set("id", String(id));
    formData.set("status", newStatus);
    const result = await updateStellenanteilStatusAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Status geaendert." });
      router.refresh();
    }
  }

  function startEdit(row: StellenanteilRow) {
    setEditingId(row.id);
    setEditStellenartId(row.stellenartTypId);
    setShowAdd(false);
    setMessage(null);
  }

  return (
    <>
      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {schulen.map((schule) => {
          const isActive = schule.id === activeSchuleId;
          return (
            <button
              key={schule.id}
              onClick={() => {
                setActiveSchuleId(schule.id);
                setShowAdd(false);
                setEditingId(null);
                setMessage(null);
              }}
              className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${
                isActive ? "text-[#1A1A1A] font-bold" : "text-[#6B7280] hover:text-[#1A1A1A]"
              }`}
              style={{ borderBottom: `3px solid ${isActive ? schule.farbe : "transparent"}` }}
            >
              <span className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: schule.farbe }} />
                {schule.kurzname}
              </span>
            </button>
          );
        })}
      </div>

      {activeSchule && (
        <>
          {/* Action bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="w-4 h-4 rounded-full" style={{ backgroundColor: activeSchule.farbe }} />
              <h3 className="text-lg font-bold text-[#1A1A1A]">{activeSchule.name}</h3>
              <span className="text-sm text-[#6B7280]">
                {rows.length} {rows.length === 1 ? "Eintrag" : "Eintraege"}
              </span>
            </div>
            <Button
              onClick={() => {
                setShowAdd(!showAdd);
                setEditingId(null);
                setSelectedStellenartId(0);
              }}
              disabled={saving}
            >
              {showAdd ? "Abbrechen" : "Neuer Stellenanteil"}
            </Button>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`mb-4 p-3 rounded-lg text-sm font-medium ${
                message.type === "success"
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Add Form */}
          {showAdd && (
            <Card className="mb-4">
              <form action={handleCreate}>
                <input type="hidden" name="schuleId" value={activeSchuleId} />
                <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

                <h4 className="text-[15px] font-bold text-[#1A1A1A] mb-3">Neuen Stellenanteil anlegen</h4>

                {/* Row 1 */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellenart</label>
                    <select
                      name="stellenartTypId"
                      required
                      value={selectedStellenartId}
                      onChange={(e) => setSelectedStellenartId(Number(e.target.value))}
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                    >
                      <option value="0">-- Bitte waehlen --</option>
                      {stellenarten.map((sa) => (
                        <option key={sa.id} value={sa.id}>
                          {sa.bezeichnung}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Wert (FTE)</label>
                    <input
                      type="number"
                      step="0.0001"
                      name="wert"
                      required
                      placeholder="z.B. 0,5"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Zeitraum</label>
                    <select
                      name="zeitraum"
                      defaultValue="ganzjahr"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                    >
                      {ZEITRAUM_OPTIONS.map((z) => (
                        <option key={z.value} value={z.value}>{z.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Status</label>
                    <select
                      name="status"
                      defaultValue="beantragt"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                    >
                      {Object.entries(STELLENANTEIL_STATUS_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2 — Lehrkraft (conditional) */}
                {showLehrerDropdown && (
                  <div className="mb-3">
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Lehrkraft</label>
                    <select
                      name="lehrerId"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white max-w-md"
                    >
                      <option value="">-- Keine Zuordnung --</option>
                      {lehrerList.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.vollname} {l.personalnummer ? `(${l.personalnummer})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Row 3 */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Antragsdatum</label>
                    <input
                      type="date"
                      name="antragsdatum"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Befristung bis</label>
                    <input
                      type="date"
                      name="befristetBis"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Aktenzeichen</label>
                    <input
                      type="text"
                      name="aktenzeichen"
                      placeholder="Optional"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">DMS-Nr.</label>
                    <input
                      type="text"
                      name="dmsDokumentennummer"
                      placeholder="Optional"
                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                    />
                  </div>
                </div>

                {/* Row 4 */}
                <div className="mb-4">
                  <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Bemerkung</label>
                  <input
                    type="text"
                    name="bemerkung"
                    placeholder="Optional"
                    className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                  />
                </div>

                <div className="flex gap-2">
                  <Button type="submit" disabled={saving}>
                    {saving ? "Speichere..." : "Speichern"}
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => { setShowAdd(false); setSelectedStellenartId(0); }}
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </Card>
          )}

          {/* Main Table */}
          <Card>
            {rows.length === 0 ? (
              <div className="text-center py-12 text-[#6B7280]">
                <p className="text-lg font-medium">Keine Stellenanteile vorhanden.</p>
                <p className="text-sm mt-1">Klicken Sie auf &quot;Neuer Stellenanteil&quot; um einen anzulegen.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="border-b-2 border-[#575756]">
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Stellenart
                      </th>
                      <th className="text-right py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[100px]">
                        Wert
                      </th>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Zeitraum
                      </th>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Lehrkraft
                      </th>
                      <th className="text-center py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Status
                      </th>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Befristung
                      </th>
                      <th className="text-left py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">
                        Aktenzeichen
                      </th>
                      <th className="text-center py-3 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[120px]">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, i) => {
                      const befristungStatus = getBefristungWarning(row.befristetBis);
                      const statusFarben = STELLENANTEIL_STATUS_FARBEN[row.status];
                      const isEditing = editingId === row.id;

                      if (isEditing) {
                        return (
                          <tr key={row.id} className="bg-blue-50 border-b border-[#E5E7EB]">
                            <td colSpan={8} className="py-3 px-3">
                              <form action={handleUpdate}>
                                <input type="hidden" name="id" value={row.id} />
                                <input type="hidden" name="schuleId" value={activeSchuleId} />
                                <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

                                <div className="grid grid-cols-4 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellenart</label>
                                    <select
                                      name="stellenartTypId"
                                      required
                                      value={editStellenartId}
                                      onChange={(e) => setEditStellenartId(Number(e.target.value))}
                                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                                    >
                                      {stellenarten.map((sa) => (
                                        <option key={sa.id} value={sa.id}>{sa.bezeichnung}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Wert (FTE)</label>
                                    <input
                                      type="number"
                                      step="0.0001"
                                      name="wert"
                                      required
                                      defaultValue={Number(row.wert)}
                                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Zeitraum</label>
                                    <select
                                      name="zeitraum"
                                      defaultValue={row.zeitraum}
                                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                                    >
                                      {ZEITRAUM_OPTIONS.map((z) => (
                                        <option key={z.value} value={z.value}>{z.label}</option>
                                      ))}
                                    </select>
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Status</label>
                                    <select
                                      name="status"
                                      defaultValue={row.status}
                                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
                                    >
                                      {Object.entries(STELLENANTEIL_STATUS_LABELS).map(([val, label]) => (
                                        <option key={val} value={val}>{label}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                {showEditLehrerDropdown && (
                                  <div className="mb-3">
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Lehrkraft</label>
                                    <select
                                      name="lehrerId"
                                      defaultValue={row.lehrerId ?? ""}
                                      className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white max-w-md"
                                    >
                                      <option value="">-- Keine Zuordnung --</option>
                                      {lehrerList.map((l) => (
                                        <option key={l.id} value={l.id}>
                                          {l.vollname} {l.personalnummer ? `(${l.personalnummer})` : ""}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}

                                <div className="grid grid-cols-4 gap-3 mb-3">
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Antragsdatum</label>
                                    <input type="date" name="antragsdatum" defaultValue={row.antragsdatum ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Befristung bis</label>
                                    <input type="date" name="befristetBis" defaultValue={row.befristetBis ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Aktenzeichen</label>
                                    <input type="text" name="aktenzeichen" defaultValue={row.aktenzeichen ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
                                  </div>
                                  <div>
                                    <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">DMS-Nr.</label>
                                    <input type="text" name="dmsDokumentennummer" defaultValue={row.dmsDokumentennummer ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
                                  </div>
                                </div>

                                <div className="mb-4">
                                  <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Bemerkung</label>
                                  <input type="text" name="bemerkung" defaultValue={row.bemerkung ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
                                </div>

                                <div className="flex gap-2">
                                  <Button type="submit" disabled={saving}>
                                    {saving ? "Speichere..." : "Speichern"}
                                  </Button>
                                  <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setEditStellenartId(0); }}>
                                    Abbrechen
                                  </Button>
                                </div>
                              </form>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr
                          key={row.id}
                          className={`border-b border-[#E5E7EB] ${
                            i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"
                          }`}
                        >
                          <td className="py-3 px-3">
                            <div className="font-medium">{row.stellenartBezeichnung}</div>
                            {row.rechtsgrundlage && (
                              <div className="text-xs text-[#6B7280] mt-0.5">{row.rechtsgrundlage}</div>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right font-bold tabular-nums">
                            {Number(row.wert).toLocaleString("de-DE", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })}
                          </td>
                          <td className="py-3 px-3 text-[#575756]">
                            {ZEITRAUM_LABELS[row.zeitraum] ?? row.zeitraum}
                          </td>
                          <td className="py-3 px-3">
                            {row.lehrerName ? (
                              <div>
                                <span className="font-medium">{row.lehrerName}</span>
                                {row.lehrerPersonalnr && (
                                  <span className="text-xs text-[#6B7280] ml-1">({row.lehrerPersonalnr})</span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#6B7280]">{"\u2014"}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${
                                statusFarben?.bg ?? "bg-gray-50 border-gray-300"
                              } ${statusFarben?.text ?? "text-gray-600"}`}
                            >
                              {STELLENANTEIL_STATUS_LABELS[row.status] ?? row.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 tabular-nums">
                            {row.befristetBis ? (
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded text-sm ${
                                  befristungStatus === "expired"
                                    ? "bg-red-100 text-red-800"
                                    : befristungStatus === "warning"
                                    ? "bg-amber-100 text-amber-800"
                                    : ""
                                }`}
                              >
                                {formatDate(row.befristetBis)}
                              </span>
                            ) : (
                              <span className="text-[#6B7280]">{"\u2014"}</span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-sm text-[#575756]">
                            {row.aktenzeichen ?? "\u2014"}
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {row.status === "beantragt" && (
                                <>
                                  <a
                                    href={`/api/export/stellenanteil-antrag?id=${row.id}`}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                                    title="Antrag als Word-Dokument herunterladen"
                                  >
                                    Antrag
                                  </a>
                                  <button
                                    onClick={() => handleStatusChange(row.id, "genehmigt")}
                                    disabled={saving}
                                    className="px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Als genehmigt markieren"
                                  >
                                    Genehmigen
                                  </button>
                                  <button
                                    onClick={() => handleStatusChange(row.id, "abgelehnt")}
                                    disabled={saving}
                                    className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer"
                                    title="Als abgelehnt markieren"
                                  >
                                    Ablehnen
                                  </button>
                                </>
                              )}
                              {row.status === "genehmigt" && (
                                <button
                                  onClick={() => handleStatusChange(row.id, "zurueckgezogen")}
                                  disabled={saving}
                                  className="px-2 py-1 text-xs font-medium rounded bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Zurueckziehen"
                                >
                                  Zurueckziehen
                                </button>
                              )}
                              {(row.status === "abgelehnt" || row.status === "zurueckgezogen") && (
                                <button
                                  onClick={() => handleStatusChange(row.id, "beantragt")}
                                  disabled={saving}
                                  className="px-2 py-1 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer"
                                  title="Erneut beantragen"
                                >
                                  Erneut beantragen
                                </button>
                              )}
                              <Button
                                size="sm"
                                variant="secondary"
                                onClick={() => startEdit(row)}
                                disabled={saving}
                                title="Bearbeiten"
                              >
                                Bearb.
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(row.id)}
                                disabled={saving}
                                title="Loeschen"
                              >
                                Loeschen
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#575756]">
                      <td className="py-3 px-3 font-bold text-[15px]">
                        Summe genehmigte Stellen
                      </td>
                      <td
                        className="py-3 px-3 text-right text-lg tabular-nums font-bold"
                        style={{ color: activeSchule.farbe }}
                      >
                        {summeGenehmigt.toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 4,
                        })}
                      </td>
                      <td colSpan={6} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </>
  );
}
