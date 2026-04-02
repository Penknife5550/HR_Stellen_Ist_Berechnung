"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  STELLENANTEIL_STATUS_FARBEN,
  STELLENANTEIL_STATUS_LABELS,
  ZEITRAUM_OPTIONS,
  STELLENART_TYP_KURZ,
  STELLENART_TYP_FARBEN,
  WAHLRECHT_OPTIONS,
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
  stellenartKuerzel: string | null;
  stellenartTyp: string;
  bindungstyp: string;
  istIsoliert: boolean;
  anlage2a: boolean;
  erhoehtPauschale: boolean;
  rechtsgrundlage: string | null;
  lehrerId: number | null;
  lehrerName: string | null;
  lehrerPersonalnr: string | null;
  wert: string;
  eurBetrag: string | null;
  wahlrecht: string | null;
  zeitraum: string;
  status: string;
  befristetBis: string | null;
  antragsdatum: string | null;
  aktenzeichen: string | null;
  dmsDokumentennummer: string | null;
  bemerkung: string | null;
};

type StellenartOption = {
  id: number;
  bezeichnung: string;
  kurzbezeichnung: string | null;
  kuerzel: string | null;
  typ: string;
  bindungstyp: string;
  rechtsgrundlage: string | null;
};

type Props = {
  schulen: Array<{ id: number; kurzname: string; name: string; farbe: string }>;
  stellenanteileBySchule: Record<number, StellenanteilRow[]>;
  stellenarten: StellenartOption[];
  lehrerBySchule: Record<number, Array<{ id: number; vollname: string; personalnummer: string | null }>>;
  defaultSchuleId: number;
  haushaltsjahrId: number;
};

const ZEITRAUM_LABELS: Record<string, string> = {};
for (const z of ZEITRAUM_OPTIONS) {
  ZEITRAUM_LABELS[z.value] = z.label;
}

// Gruppen-Reihenfolge und Konfiguration
const TYP_GRUPPEN = [
  {
    key: "A",
    title: "Abschnitt 2 \u2013 Standardzuschl\u00E4ge",
    subtitle: "Deputatswirksam, erhoehen Personalbedarfspauschale",
    einheit: "Stellen",
  },
  {
    key: "A_106",
    title: "Abschnitt 4 \u2013 Sonderbedarfe \u00A7 106 Abs. 10",
    subtitle: "Deputatswirksam, isoliert (ohne Pauschalen-Wirkung)",
    einheit: "Stellen",
  },
  {
    key: "B",
    title: "Wahlleistungen (Geld oder Stelle)",
    subtitle: "Traeger waehlt fuer das Schuljahr: Stelle oder EUR-Betrag",
    einheit: "Stellen / EUR",
  },
  {
    key: "C",
    title: "Geldleistungen",
    subtitle: "Reine EUR-Zuwendung, keine Stellenwirkung",
    einheit: "EUR",
  },
] as const;

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

function formatEur(val: string | number | null): string {
  if (val === null || val === undefined || val === "") return "\u2014";
  return Number(val).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
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
  const [selectedWahlrecht, setSelectedWahlrecht] = useState<string>("");
  const [editStellenartId, setEditStellenartId] = useState<number>(0);
  const [editWahlrecht, setEditWahlrecht] = useState<string>("");

  const activeSchule = schulen.find((s) => s.id === activeSchuleId);
  const rows = stellenanteileBySchule[activeSchuleId] ?? [];
  const lehrerList = lehrerBySchule[activeSchuleId] ?? [];

  // Ausgewaehlte Stellenart (Add)
  const selectedStellenart = stellenarten.find((sa) => sa.id === selectedStellenartId);
  const showLehrerDropdown = selectedStellenart?.bindungstyp === "person" || selectedStellenart?.bindungstyp === "beides";
  const isTypB = selectedStellenart?.typ === "B";
  const isTypC = selectedStellenart?.typ === "C";
  const showEurFeld = isTypB || isTypC;
  const showWahlrecht = isTypB;
  const showWertFeld = !isTypC && !(isTypB && selectedWahlrecht === "geld");

  // Editierte Stellenart
  const editStellenart = stellenarten.find((sa) => sa.id === editStellenartId);
  const showEditLehrerDropdown = editStellenart?.bindungstyp === "person" || editStellenart?.bindungstyp === "beides";
  const editIsTypB = editStellenart?.typ === "B";
  const editIsTypC = editStellenart?.typ === "C";
  const showEditEurFeld = editIsTypB || editIsTypC;
  const showEditWahlrecht = editIsTypB;
  const showEditWertFeld = !editIsTypC && !(editIsTypB && editWahlrecht === "geld");

  // Gruppierung nach Typ
  const gruppiertRows = TYP_GRUPPEN.map((g) => ({
    ...g,
    rows: rows.filter((r) => r.stellenartTyp === g.key),
  })).filter((g) => g.rows.length > 0);

  // Summen
  const summeStellen = rows
    .filter((r) => r.status === "genehmigt")
    .filter((r) => {
      if (r.stellenartTyp === "A" || r.stellenartTyp === "A_106") return true;
      if (r.stellenartTyp === "B" && r.wahlrecht === "stelle") return true;
      return false;
    })
    .reduce((acc, r) => acc + Number(r.wert), 0);

  const summeEur = rows
    .filter((r) => r.status === "genehmigt")
    .filter((r) => r.eurBetrag && Number(r.eurBetrag) > 0)
    .reduce((acc, r) => acc + Number(r.eurBetrag), 0);

  // Stellenarten nach Typ gruppiert im Dropdown
  const stellenartenGrouped: Record<string, StellenartOption[]> = {};
  for (const sa of stellenarten) {
    const g = stellenartenGrouped[sa.typ] ?? [];
    g.push(sa);
    stellenartenGrouped[sa.typ] = g;
  }

  async function handleCreate(formData: FormData) {
    // Bei Typ C: Wert = 0 setzen
    if (isTypC) formData.set("wert", "0");
    if (isTypB && selectedWahlrecht === "geld") formData.set("wert", "0");
    if (!showEurFeld) formData.delete("eurBetrag");
    if (!showWahlrecht) formData.delete("wahlrecht");

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
      setSelectedWahlrecht("");
      router.refresh();
    }
  }

  async function handleUpdate(formData: FormData) {
    if (editIsTypC) formData.set("wert", "0");
    if (editIsTypB && editWahlrecht === "geld") formData.set("wert", "0");
    if (!showEditEurFeld) formData.delete("eurBetrag");
    if (!showEditWahlrecht) formData.delete("wahlrecht");

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
      setEditWahlrecht("");
      router.refresh();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Stellenanteil wirklich loeschen?")) return;
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("id", String(id));
    const result = await deleteStellenanteilAction(fd);
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
    const fd = new FormData();
    fd.set("id", String(id));
    fd.set("status", newStatus);
    const result = await updateStellenanteilStatusAction(fd);
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
    setEditWahlrecht(row.wahlrecht ?? "");
    setShowAdd(false);
    setMessage(null);
  }

  // ============================================================
  // RENDER: Stellenart-Dropdown mit Gruppen
  // ============================================================
  function renderStellenartSelect(name: string, value: number, onChange: (v: number) => void, required = true) {
    return (
      <select
        name={name}
        required={required}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white"
      >
        <option value="0">-- Bitte waehlen --</option>
        {["A", "A_106", "B", "C"].map((typ) => {
          const group = stellenartenGrouped[typ];
          if (!group || group.length === 0) return null;
          return (
            <optgroup key={typ} label={STELLENART_TYP_KURZ[typ] ?? typ}>
              {group.map((sa) => (
                <option key={sa.id} value={sa.id}>
                  {sa.kuerzel ? `${sa.kuerzel} \u2013 ` : ""}{sa.bezeichnung}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    );
  }

  // ============================================================
  // RENDER: Add Form
  // ============================================================
  function renderAddForm() {
    if (!showAdd) return null;
    return (
      <Card className="mb-4">
        <form action={handleCreate}>
          <input type="hidden" name="schuleId" value={activeSchuleId} />
          <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

          <h4 className="text-[15px] font-bold text-[#1A1A1A] mb-3">Neuen Stellenanteil anlegen</h4>

          {/* Row 1: Stellenart + Wahlrecht + Wert/EUR + Zeitraum + Status */}
          <div className="grid grid-cols-5 gap-3 mb-3">
            <div className="col-span-2">
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellenart</label>
              {renderStellenartSelect("stellenartTypId", selectedStellenartId, (v) => {
                setSelectedStellenartId(v);
                setSelectedWahlrecht("");
              })}
              {selectedStellenart && (
                <div className="text-xs text-[#6B7280] mt-1">
                  {STELLENART_TYP_KURZ[selectedStellenart.typ] ?? selectedStellenart.typ}
                  {selectedStellenart.rechtsgrundlage && ` \u2013 ${selectedStellenart.rechtsgrundlage}`}
                </div>
              )}
            </div>

            {showWahlrecht && (
              <div>
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Wahlrecht</label>
                <select
                  name="wahlrecht"
                  required
                  value={selectedWahlrecht}
                  onChange={(e) => setSelectedWahlrecht(e.target.value)}
                  className="w-full border border-orange-300 rounded px-3 py-2 text-[15px] min-h-[44px] bg-orange-50"
                >
                  <option value="">-- Waehlen --</option>
                  {WAHLRECHT_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>{w.label}</option>
                  ))}
                </select>
              </div>
            )}

            {showWertFeld && (
              <div>
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellen (VZE)</label>
                <input
                  type="number"
                  step="0.0001"
                  name="wert"
                  required
                  placeholder="z.B. 0,5"
                  className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums"
                />
              </div>
            )}

            {showEurFeld && (
              <div>
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">EUR-Betrag</label>
                <input
                  type="number"
                  step="0.01"
                  name="eurBetrag"
                  placeholder="z.B. 20200"
                  required={isTypC || (isTypB && selectedWahlrecht === "geld")}
                  className="w-full border border-emerald-300 rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums bg-emerald-50"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Zeitraum</label>
              <select name="zeitraum" defaultValue="ganzjahr" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white">
                {ZEITRAUM_OPTIONS.map((z) => (
                  <option key={z.value} value={z.value}>{z.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Status</label>
              <select name="status" defaultValue="beantragt" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white">
                {Object.entries(STELLENANTEIL_STATUS_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Lehrkraft */}
          {showLehrerDropdown && (
            <div className="mb-3">
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Lehrkraft</label>
              <select name="lehrerId" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white max-w-md">
                <option value="">-- Keine Zuordnung --</option>
                {lehrerList.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.vollname} {l.personalnummer ? `(${l.personalnummer})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Row 3: Daten */}
          <div className="grid grid-cols-4 gap-3 mb-3">
            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Antragsdatum</label>
              <input type="date" name="antragsdatum" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Befristung bis</label>
              <input type="date" name="befristetBis" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Aktenzeichen</label>
              <input type="text" name="aktenzeichen" placeholder="Optional" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
            </div>
            <div>
              <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">DMS-Nr.</label>
              <input type="text" name="dmsDokumentennummer" placeholder="Optional" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Bemerkung</label>
            <input type="text" name="bemerkung" placeholder="Optional" className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]" />
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>{saving ? "Speichere..." : "Speichern"}</Button>
            <Button type="button" variant="secondary" onClick={() => { setShowAdd(false); setSelectedStellenartId(0); setSelectedWahlrecht(""); }}>Abbrechen</Button>
          </div>
        </form>
      </Card>
    );
  }

  // ============================================================
  // RENDER: Inline Edit Row
  // ============================================================
  function renderEditRow(row: StellenanteilRow) {
    return (
      <tr key={row.id} className="bg-blue-50 border-b border-[#E5E7EB]">
        <td colSpan={8} className="py-3 px-3">
          <form action={handleUpdate}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="schuleId" value={activeSchuleId} />
            <input type="hidden" name="haushaltsjahrId" value={haushaltsjahrId} />

            <div className="grid grid-cols-5 gap-3 mb-3">
              <div className="col-span-2">
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellenart</label>
                {renderStellenartSelect("stellenartTypId", editStellenartId, (v) => {
                  setEditStellenartId(v);
                  const sa = stellenarten.find((s) => s.id === v);
                  if (sa?.typ !== "B") setEditWahlrecht("");
                })}
              </div>

              {showEditWahlrecht && (
                <div>
                  <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Wahlrecht</label>
                  <select name="wahlrecht" required value={editWahlrecht} onChange={(e) => setEditWahlrecht(e.target.value)} className="w-full border border-orange-300 rounded px-3 py-2 text-[15px] min-h-[44px] bg-orange-50">
                    <option value="">-- Waehlen --</option>
                    {WAHLRECHT_OPTIONS.map((w) => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {showEditWertFeld && (
                <div>
                  <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Stellen (VZE)</label>
                  <input type="number" step="0.0001" name="wert" required defaultValue={Number(row.wert)} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums" />
                </div>
              )}

              {showEditEurFeld && (
                <div>
                  <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">EUR-Betrag</label>
                  <input type="number" step="0.01" name="eurBetrag" defaultValue={row.eurBetrag ? Number(row.eurBetrag) : ""} required={editIsTypC || (editIsTypB && editWahlrecht === "geld")} className="w-full border border-emerald-300 rounded px-3 py-2 text-[15px] min-h-[44px] text-right tabular-nums bg-emerald-50" />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Zeitraum</label>
                <select name="zeitraum" defaultValue={row.zeitraum} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white">
                  {ZEITRAUM_OPTIONS.map((z) => (
                    <option key={z.value} value={z.value}>{z.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Status</label>
                <select name="status" defaultValue={row.status} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white">
                  {Object.entries(STELLENANTEIL_STATUS_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {showEditLehrerDropdown && (
              <div className="mb-3">
                <label className="block text-xs font-bold text-[#575756] mb-1 uppercase tracking-wider">Lehrkraft</label>
                <select name="lehrerId" defaultValue={row.lehrerId ?? ""} className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px] bg-white max-w-md">
                  <option value="">-- Keine Zuordnung --</option>
                  {lehrerList.map((l) => (
                    <option key={l.id} value={l.id}>{l.vollname} {l.personalnummer ? `(${l.personalnummer})` : ""}</option>
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
              <Button type="submit" disabled={saving}>{saving ? "Speichere..." : "Speichern"}</Button>
              <Button type="button" variant="secondary" onClick={() => { setEditingId(null); setEditStellenartId(0); setEditWahlrecht(""); }}>Abbrechen</Button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  // ============================================================
  // RENDER: Data Row
  // ============================================================
  function renderDataRow(row: StellenanteilRow, idx: number) {
    const befristungStatus = getBefristungWarning(row.befristetBis);
    const statusFarben = STELLENANTEIL_STATUS_FARBEN[row.status];
    const isB = row.stellenartTyp === "B";
    const isC = row.stellenartTyp === "C";

    return (
      <tr key={row.id} className={`border-b border-[#E5E7EB] ${idx % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}`}>
        <td className="py-3 px-3">
          <div className="flex items-center gap-2">
            {row.stellenartKuerzel && (
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-gray-100 text-gray-600">
                {row.stellenartKuerzel}
              </span>
            )}
            <span className="font-medium">{row.stellenartBezeichnung}</span>
          </div>
          {row.rechtsgrundlage && (
            <div className="text-xs text-[#6B7280] mt-0.5 ml-[calc(0.375rem+3ch+0.5rem)]">{row.rechtsgrundlage}</div>
          )}
        </td>
        <td className="py-3 px-3 text-right tabular-nums">
          {isC || (isB && row.wahlrecht === "geld") ? (
            <span className="text-[#6B7280]">{"\u2014"}</span>
          ) : (
            <span className="font-bold">
              {Number(row.wert).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
            </span>
          )}
        </td>
        <td className="py-3 px-3 text-right tabular-nums">
          {row.eurBetrag && Number(row.eurBetrag) > 0 ? (
            <span className="font-bold text-emerald-700">{formatEur(row.eurBetrag)}</span>
          ) : (
            <span className="text-[#6B7280]">{"\u2014"}</span>
          )}
        </td>
        <td className="py-3 px-3">
          {isB && row.wahlrecht ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${
              row.wahlrecht === "stelle" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"
            }`}>
              {row.wahlrecht === "stelle" ? "Stelle" : "Geld"}
            </span>
          ) : (
            <span className="text-[#6B7280]">{ZEITRAUM_LABELS[row.zeitraum] ?? row.zeitraum}</span>
          )}
        </td>
        <td className="py-3 px-3">
          {row.lehrerName ? (
            <div>
              <span className="font-medium">{row.lehrerName}</span>
              {row.lehrerPersonalnr && <span className="text-xs text-[#6B7280] ml-1">({row.lehrerPersonalnr})</span>}
            </div>
          ) : (
            <span className="text-[#6B7280]">{"\u2014"}</span>
          )}
        </td>
        <td className="py-3 px-3 text-center">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold border ${statusFarben?.bg ?? "bg-gray-50 border-gray-300"} ${statusFarben?.text ?? "text-gray-600"}`}>
            {STELLENANTEIL_STATUS_LABELS[row.status] ?? row.status}
          </span>
        </td>
        <td className="py-3 px-3 tabular-nums text-sm">
          {row.befristetBis ? (
            <span className={`inline-flex items-center px-2 py-0.5 rounded ${
              befristungStatus === "expired" ? "bg-red-100 text-red-800" : befristungStatus === "warning" ? "bg-amber-100 text-amber-800" : ""
            }`}>
              {formatDate(row.befristetBis)}
            </span>
          ) : (
            <span className="text-[#6B7280]">{"\u2014"}</span>
          )}
        </td>
        <td className="py-3 px-3">
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {row.status === "beantragt" && (
              <>
                <a
                  href={`/api/export/stellenanteil-antrag?id=${row.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                  title="Antrag als Word-Dokument"
                >
                  Antrag
                </a>
                <button onClick={() => handleStatusChange(row.id, "genehmigt")} disabled={saving} className="px-2 py-1 text-xs font-medium rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors disabled:opacity-50 cursor-pointer">
                  Genehmigen
                </button>
                <button onClick={() => handleStatusChange(row.id, "abgelehnt")} disabled={saving} className="px-2 py-1 text-xs font-medium rounded bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 transition-colors disabled:opacity-50 cursor-pointer">
                  Ablehnen
                </button>
              </>
            )}
            {row.status === "genehmigt" && (
              <button onClick={() => handleStatusChange(row.id, "zurueckgezogen")} disabled={saving} className="px-2 py-1 text-xs font-medium rounded bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer">
                Zurueckziehen
              </button>
            )}
            {(row.status === "abgelehnt" || row.status === "zurueckgezogen") && (
              <button onClick={() => handleStatusChange(row.id, "beantragt")} disabled={saving} className="px-2 py-1 text-xs font-medium rounded bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 transition-colors disabled:opacity-50 cursor-pointer">
                Erneut beantragen
              </button>
            )}
            <Button size="sm" variant="secondary" onClick={() => startEdit(row)} disabled={saving}>Bearb.</Button>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)} disabled={saving}>Loeschen</Button>
          </div>
        </td>
      </tr>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================
  return (
    <>
      {/* School Tabs */}
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {schulen.map((schule) => {
          const isActive = schule.id === activeSchuleId;
          return (
            <button
              key={schule.id}
              onClick={() => { setActiveSchuleId(schule.id); setShowAdd(false); setEditingId(null); setMessage(null); }}
              className={`px-5 py-3 text-[15px] font-medium transition-colors -mb-px ${isActive ? "text-[#1A1A1A] font-bold" : "text-[#6B7280] hover:text-[#1A1A1A]"}`}
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
              <span className="text-sm text-[#6B7280]">{rows.length} {rows.length === 1 ? "Eintrag" : "Eintraege"}</span>
            </div>
            <Button onClick={() => { setShowAdd(!showAdd); setEditingId(null); setSelectedStellenartId(0); setSelectedWahlrecht(""); }} disabled={saving}>
              {showAdd ? "Abbrechen" : "Neuer Stellenanteil"}
            </Button>
          </div>

          {/* Summen-Banner */}
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider">Stellensoll-Wirkung (genehmigt)</div>
              <div className="text-2xl font-bold text-blue-800 tabular-nums mt-1">
                {summeStellen.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} Stellen
              </div>
              <div className="text-xs text-blue-600 mt-0.5">Typ A + A {"§"}106 + Typ B (Stellenwahl)</div>
            </div>
            {summeEur > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Geldleistungen (genehmigt)</div>
                <div className="text-2xl font-bold text-emerald-800 tabular-nums mt-1">{formatEur(summeEur)}</div>
                <div className="text-xs text-emerald-600 mt-0.5">Typ B (Geldwahl) + Typ C</div>
              </div>
            )}
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
              message.type === "success" ? "bg-green-50 text-green-800 border border-green-200" : "bg-red-50 text-red-800 border border-red-200"
            }`}>
              {message.text}
            </div>
          )}

          {/* Add Form */}
          {renderAddForm()}

          {/* Grouped Tables */}
          {rows.length === 0 ? (
            <Card>
              <div className="text-center py-12 text-[#6B7280]">
                <p className="text-lg font-medium">Keine Stellenanteile vorhanden.</p>
                <p className="text-sm mt-1">Klicken Sie auf &quot;Neuer Stellenanteil&quot; um einen anzulegen.</p>
              </div>
            </Card>
          ) : (
            gruppiertRows.map((gruppe) => {
              const farben = STELLENART_TYP_FARBEN[gruppe.key] ?? { bg: "bg-gray-50", text: "text-gray-800", border: "border-gray-200" };
              const gruppenSummeStellen = gruppe.rows
                .filter((r) => r.status === "genehmigt")
                .filter((r) => {
                  if (gruppe.key === "C") return false;
                  if (gruppe.key === "B" && r.wahlrecht === "geld") return false;
                  return true;
                })
                .reduce((acc, r) => acc + Number(r.wert), 0);
              const gruppenSummeEur = gruppe.rows
                .filter((r) => r.status === "genehmigt" && r.eurBetrag)
                .reduce((acc, r) => acc + Number(r.eurBetrag), 0);

              return (
                <Card key={gruppe.key} className={`mb-4 border ${farben.border}`}>
                  {/* Group Header */}
                  <div className={`${farben.bg} -mx-6 -mt-6 px-6 py-3 mb-4 rounded-t-xl border-b ${farben.border}`}>
                    <h4 className={`text-[15px] font-bold ${farben.text}`}>{gruppe.title}</h4>
                    <p className="text-xs text-[#6B7280] mt-0.5">{gruppe.subtitle}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-[15px]">
                      <thead>
                        <tr className="border-b-2 border-[#575756]">
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Stellenart</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[100px]">Stellen</th>
                          <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[120px]">EUR</th>
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[100px]">
                            {gruppe.key === "B" ? "Wahl" : "Zeitraum"}
                          </th>
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Lehrkraft</th>
                          <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Status</th>
                          <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[100px]">Befristung</th>
                          <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold w-[140px]">Aktionen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gruppe.rows.map((row, i) =>
                          editingId === row.id ? renderEditRow(row) : renderDataRow(row, i)
                        )}
                      </tbody>
                      <tfoot>
                        <tr className={`border-t-2 ${farben.border}`}>
                          <td className={`py-2 px-3 font-bold text-sm ${farben.text}`}>Summe (genehmigt)</td>
                          <td className={`py-2 px-3 text-right font-bold tabular-nums ${farben.text}`}>
                            {gruppenSummeStellen > 0
                              ? gruppenSummeStellen.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
                              : "\u2014"}
                          </td>
                          <td className="py-2 px-3 text-right font-bold tabular-nums text-emerald-700">
                            {gruppenSummeEur > 0 ? formatEur(gruppenSummeEur) : "\u2014"}
                          </td>
                          <td colSpan={5} />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              );
            })
          )}
        </>
      )}
    </>
  );
}
