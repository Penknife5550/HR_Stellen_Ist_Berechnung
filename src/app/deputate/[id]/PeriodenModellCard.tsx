"use client";

/**
 * Detailseiten-Sektion für das Periodenmodell (v0.7+).
 *
 * Drei Tabellen:
 *  1. Echte Wertwechsel — was tatsächlich im Schuljahr passiert ist
 *     (mit Inline-Edit für tatsächliches Wirksamkeitsdatum)
 *  2. Tagesgenau-Vergleich — DB-Monatswert (alt) vs. tagesgenau berechnet (neu)
 *  3. Periodenverlauf (collapsible) — alle Untis-Perioden des Lehrers
 *
 * Untis-Periodenwechsel sind technisch immer zum Montag — der echte Stichtag
 * im Personalbestand kann an jedem Wochentag liegen. Die Inline-Korrektur
 * speichert in deputat_aenderung_korrekturen, ohne den Untis-Spiegel zu beruehren.
 */

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  korrigierePeriodeWirksamkeitAction,
  loescheKorrekturAction,
} from "../actions";

interface PeriodenZeile {
  schoolYearId: number;
  termId: number;
  termName: string | null;
  isBPeriod: boolean;
  gueltigVon: string;
  gueltigBis: string;
  deputatGesamt: string;
  deputatGes: string;
  deputatGym: string;
  deputatBk: string;
}

interface AenderungZeile {
  sy_alt: number;
  term_alt: number;
  sy_neu: number;
  term_neu: number;
  wirksam_ab: string;                  // Untis-Montag (ISO YYYY-MM-DD)
  gueltig_bis_alt: string;
  tatsaechliches_datum: string | null; // Sachbearbeiter-Korrektur (ISO)
  effektiv_wirksam_ab: string;         // = tatsaechliches_datum oder wirksam_ab
  hat_korrektur: boolean;
  korrigiert_von: string | null;
  korrigiert_am: string | null;
  bemerkung: string | null;
  korrektur_id: number | null;
  gesamt_alt: string;
  gesamt_neu: string;
  delta_gesamt: string;
}

const WOCHENTAG = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
function fmtDatum(iso: string): string {
  const d = new Date(iso);
  return `${WOCHENTAG[d.getDay()]} ${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}
function fmtDatumKurz(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

export function PeriodenModellCard({
  lehrerId,
  periodenverlauf,
  echteAenderungen,
}: {
  lehrerId: number;
  periodenverlauf: PeriodenZeile[];
  echteAenderungen: AenderungZeile[];
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (periodenverlauf.length === 0) return null;

  const keyOf = (a: AenderungZeile) => `${a.sy_alt}_${a.term_alt}_${a.sy_neu}_${a.term_neu}`;

  async function handleSave(formData: FormData) {
    setSaving(true);
    setMessage(null);
    const result = await korrigierePeriodeWirksamkeitAction(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert." });
      setEditingKey(null);
    }
  }

  async function handleDelete(korrekturId: number) {
    if (!confirm("Korrektur wirklich entfernen? Der Wechsel gilt dann wieder zum Untis-Montag.")) return;
    setSaving(true);
    setMessage(null);
    const fd = new FormData();
    fd.set("korrekturId", String(korrekturId));
    const result = await loescheKorrekturAction(fd);
    setSaving(false);
    if (result.error) setMessage({ type: "error", text: result.error });
    else setMessage({ type: "success", text: result.message ?? "Entfernt." });
  }

  return (
    <Card className="mb-6 border-l-4 border-[#009AC6]">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-lg font-bold text-[#1A1A1A]">
          Periodenmodell <span className="text-sm font-normal text-[#6B7280]">(v0.7 — Untis-Wahrheit, tagesgenau)</span>
        </h3>
        <span className="text-xs text-[#6B7280]">
          {periodenverlauf.length} Perioden · {echteAenderungen.length} echte Wertwechsel
        </span>
      </div>

      {message && (
        <div className={`mb-3 p-2.5 rounded text-sm font-medium ${
          message.type === "success"
            ? "bg-green-50 text-green-800 border border-green-200"
            : "bg-red-50 text-red-800 border border-red-200"
        }`}>
          {message.text}
        </div>
      )}

      {/* === 1) Echte Wertwechsel mit Korrektur-Spalte === */}
      <h4 className="font-bold text-[15px] text-[#1A1A1A] mt-2 mb-2">
        Echte Wertwechsel im Schuljahresverlauf
      </h4>
      <p className="text-xs text-[#6B7280] mb-3">
        Untis erlaubt Periodenwechsel nur zum Montag. Wenn der echte Stichtag im
        Personalbestand abweicht, in der Spalte <strong>&quot;Tats. Datum&quot;</strong> korrigieren —
        die tagesgenaue Berechnung verwendet dann das echte Datum
        (§ 3 Abs. 1 FESchVO).
      </p>
      {echteAenderungen.length === 0 ? (
        <p className="text-sm text-[#6B7280] italic mb-4">Keine Wertwechsel — Deputat war im erfassten Zeitraum konstant.</p>
      ) : (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756] text-xs uppercase tracking-wider text-[#575756]">
                <th className="text-left py-2 px-3">Untis-Montag</th>
                <th className="text-left py-2 px-3 text-[#E2001A]">Tats. Datum</th>
                <th className="text-left py-2 px-3">Term-Wechsel</th>
                <th className="text-right py-2 px-3">Wert alt</th>
                <th className="text-center py-2 px-3"></th>
                <th className="text-right py-2 px-3">Wert neu</th>
                <th className="text-right py-2 px-3">Δ Wochenstd.</th>
                <th className="text-left py-2 px-3 w-[40px]"></th>
              </tr>
            </thead>
            <tbody>
              {echteAenderungen.map((a) => {
                const delta = Number(a.delta_gesamt);
                const k = keyOf(a);
                const editing = editingKey === k;
                return (
                  <tr key={k} className="border-b border-[#E5E7EB]">
                    <td className="py-2.5 px-3 font-mono text-xs">{fmtDatum(a.wirksam_ab)}</td>
                    <td className="py-2.5 px-3">
                      {editing ? (
                        <form action={handleSave} className="flex items-center gap-1">
                          <input type="hidden" name="lehrerId" value={lehrerId} />
                          <input type="hidden" name="syAlt" value={a.sy_alt} />
                          <input type="hidden" name="termIdAlt" value={a.term_alt} />
                          <input type="hidden" name="syNeu" value={a.sy_neu} />
                          <input type="hidden" name="termIdNeu" value={a.term_neu} />
                          <input
                            type="date"
                            name="tatsaechlichesDatum"
                            defaultValue={a.tatsaechliches_datum ?? a.wirksam_ab}
                            className="border border-[#D1D5DB] rounded px-2 py-1 text-xs"
                            required
                          />
                          <Button type="submit" disabled={saving} className="!px-2 !py-1 !text-xs">
                            ✓
                          </Button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="px-2 py-1 text-xs text-[#6B7280] hover:text-[#1A1A1A]"
                          >
                            ✕
                          </button>
                        </form>
                      ) : a.tatsaechliches_datum ? (
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-[#E2001A]">
                            {fmtDatum(a.tatsaechliches_datum)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setEditingKey(k)}
                            className="text-[#6B7280] hover:text-[#009AC6]"
                            aria-label="Tatsaechliches Datum bearbeiten"
                          >
                            ✎
                          </button>
                          {a.korrektur_id != null && (
                            <button
                              type="button"
                              onClick={() => handleDelete(a.korrektur_id!)}
                              disabled={saving}
                              className="text-[#9CA3AF] hover:text-[#E2001A] text-xs"
                              aria-label="Korrektur entfernen"
                              title={`Gesetzt von ${a.korrigiert_von ?? "—"}${a.korrigiert_am ? " am " + new Date(a.korrigiert_am).toLocaleDateString("de-DE") : ""}`}
                            >
                              🗑
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingKey(k)}
                          className="text-xs text-[#009AC6] hover:underline flex items-center gap-1"
                        >
                          <span>Datum setzen</span>
                          <span>✎</span>
                        </button>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#6B7280] text-xs">
                      T{a.term_alt} → T{a.term_neu}
                      {a.sy_alt !== a.sy_neu && <span className="ml-2 text-[10px]">(SY-Wechsel)</span>}
                    </td>
                    <td className="py-2.5 px-3 text-right tabular-nums">{Number(a.gesamt_alt).toFixed(2)}</td>
                    <td className="py-2.5 px-3 text-center text-[#9CA3AF]">→</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-bold">{Number(a.gesamt_neu).toFixed(2)}</td>
                    <td className={`py-2.5 px-3 text-right tabular-nums font-bold ${
                      delta > 0 ? "text-[#6BAA24]" : delta < 0 ? "text-[#E2001A]" : ""
                    }`}>
                      {delta > 0 ? "▲ +" : delta < 0 ? "▼ " : ""}
                      {delta.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-3"></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* === 2) Periodenverlauf === */}
      <details className="mt-4">
        <summary className="cursor-pointer text-[15px] font-bold text-[#1A1A1A] hover:text-[#009AC6]">
          Alle Perioden (Untis-Spiegel) — {periodenverlauf.length} Eintraege
        </summary>
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-[#575756] text-xs uppercase tracking-wider text-[#575756]">
                <th className="text-left py-2 px-3">SY / Term</th>
                <th className="text-left py-2 px-3">Periode</th>
                <th className="text-left py-2 px-3">Gültig von</th>
                <th className="text-left py-2 px-3">Gültig bis</th>
                <th className="text-right py-2 px-3">Gesamt</th>
                <th className="text-right py-2 px-3">GES</th>
                <th className="text-right py-2 px-3">GYM</th>
                <th className="text-right py-2 px-3">BK</th>
              </tr>
            </thead>
            <tbody>
              {periodenverlauf.map((p) => (
                <tr key={`${p.schoolYearId}-${p.termId}`} className="border-b border-[#E5E7EB]">
                  <td className="py-2 px-3 font-mono text-xs text-[#6B7280]">
                    {p.schoolYearId} · T{p.termId}
                  </td>
                  <td className="py-2 px-3">
                    {p.termName ?? "—"}
                    {p.isBPeriod && (
                      <span className="ml-2 inline-block px-1.5 py-0.5 rounded bg-[#FEF3C7] text-[#92400E] text-[10px] font-bold">
                        b-Periode
                      </span>
                    )}
                  </td>
                  <td className="py-2 px-3 font-mono text-xs">{fmtDatumKurz(p.gueltigVon)}</td>
                  <td className="py-2 px-3 font-mono text-xs">{fmtDatumKurz(p.gueltigBis)}</td>
                  <td className="py-2 px-3 text-right tabular-nums font-bold">{Number(p.deputatGesamt).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{Number(p.deputatGes).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{Number(p.deputatGym).toFixed(2)}</td>
                  <td className="py-2 px-3 text-right tabular-nums">{Number(p.deputatBk).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Card>
  );
}
