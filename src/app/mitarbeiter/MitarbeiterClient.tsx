"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createLehrerAction, updateLehrerAction, toggleLehrerAktivAction } from "./actions";

type Lehrer = {
  id: number;
  untisTeacherId: number | null;
  personalnummer: string | null;
  vollname: string;
  vorname: string | null;
  nachname: string | null;
  stammschuleId: number | null;
  schuleKurzname: string | null;
  schuleName: string | null;
  schuleFarbe: string | null;
  quelle: string;
  aktiv: boolean;
  deputat: number | null;
  statistikCode: string | null;
  statistikBezeichnung: string | null;
  statistikGruppe: string | null;
  statistikIstTeilzeit: boolean | null;
};

type Schule = {
  id: number;
  kurzname: string;
  name: string;
  farbe: string;
};

type StatistikCodeOption = {
  code: string;
  bezeichnung: string;
  gruppe: string;
  istTeilzeit: boolean;
};

type Props = {
  lehrer: Lehrer[];
  schulen: Schule[];
  statistikCodes: StatistikCodeOption[];
  /** Aktuelles Haushaltsjahr — fuer Detailseiten-PDF-Link. NULL wenn kein HJ gefunden wurde. */
  haushaltsjahrId: number | null;
};

function StatistikCodeSelect({
  codes,
  defaultValue = "",
  className,
  angestellteLabel = "Angestellte TV-L",
}: {
  codes: StatistikCodeOption[];
  defaultValue?: string;
  className: string;
  angestellteLabel?: string;
}) {
  const beamte = codes.filter((c) => c.gruppe === "beamter");
  const angestellte = codes.filter((c) => c.gruppe === "angestellter");
  return (
    <select name="statistikCode" defaultValue={defaultValue} className={className}>
      <option value="">— Kein Code —</option>
      <optgroup label="Beamte">
        {beamte.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.bezeichnung}
          </option>
        ))}
      </optgroup>
      <optgroup label={angestellteLabel}>
        {angestellte.map((c) => (
          <option key={c.code} value={c.code}>
            {c.code} — {c.bezeichnung}
          </option>
        ))}
      </optgroup>
    </select>
  );
}

export function MitarbeiterClient({ lehrer, schulen, statistikCodes, haushaltsjahrId }: Props) {
  const searchParams = useSearchParams();
  // Initial-Filter aus URL (?gruppe=&code=&schule=) — Deeplink vom Dashboard
  const initialGruppe = (() => {
    const g = searchParams.get("gruppe");
    return g === "beamter" || g === "angestellter" || g === "ohne" || g === "alle" ? g : "alle";
  })();
  const initialCode = searchParams.get("code")?.toUpperCase() ?? null;
  const initialSchuleParam = searchParams.get("schule");
  const initialSchule: number | "alle" = initialSchuleParam
    ? schulen.find((sch) => sch.kurzname.toUpperCase() === initialSchuleParam.toUpperCase())?.id ?? "alle"
    : "alle";

  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState<number | "alle">(initialSchule);
  const [quelleFilter, setQuelleFilter] = useState<"alle" | "untis" | "manuell">("alle");
  const [gruppeFilter, setGruppeFilter] = useState<"alle" | "beamter" | "angestellter" | "ohne">(initialGruppe);
  const [codeFilter, setCodeFilter] = useState<string | null>(initialCode);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Filter logic
  const filtered = lehrer.filter((l) => {
    const searchLower = search.toLowerCase();
    const matchesSearch =
      !search ||
      l.vollname.toLowerCase().includes(searchLower) ||
      (l.personalnummer && l.personalnummer.toLowerCase().includes(searchLower));
    const matchesSchool = schoolFilter === "alle" || l.stammschuleId === schoolFilter;
    const matchesQuelle = quelleFilter === "alle" || l.quelle === quelleFilter;
    const matchesGruppe =
      gruppeFilter === "alle" ||
      (gruppeFilter === "ohne" ? !l.statistikGruppe : l.statistikGruppe === gruppeFilter);
    const matchesCode = !codeFilter || l.statistikCode === codeFilter;
    return matchesSearch && matchesSchool && matchesQuelle && matchesGruppe && matchesCode;
  });

  async function handleAction(
    action: (fd: FormData) => Promise<{ success?: boolean; error?: string; message?: string }>,
    formData: FormData
  ) {
    setSaving(true);
    setMessage(null);
    const result = await action(formData);
    setSaving(false);
    if (result.error) {
      setMessage({ type: "error", text: result.error });
    } else {
      setMessage({ type: "success", text: result.message ?? "Gespeichert!" });
      setEditingId(null);
      setShowAdd(false);
    }
  }

  return (
    <>
      {/* Message */}
      {message && (
        <div
          role={message.type === "error" ? "alert" : "status"}
          aria-live={message.type === "error" ? "assertive" : "polite"}
          className={`mb-4 p-3 rounded-lg text-sm ${
            message.type === "success"
              ? "bg-green-50 border border-green-200 text-green-800"
              : "bg-red-50 border border-red-200 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <input
          type="text"
          placeholder="Name oder Personalnummer suchen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px] w-72"
        />

        {/* School filter */}
        <select
          value={schoolFilter === "alle" ? "alle" : schoolFilter}
          onChange={(e) =>
            setSchoolFilter(e.target.value === "alle" ? "alle" : Number(e.target.value))
          }
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          <option value="alle">Alle Schulen</option>
          {schulen.map((s) => (
            <option key={s.id} value={s.id}>
              {s.kurzname} - {s.name}
            </option>
          ))}
        </select>

        {/* Quelle filter */}
        <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
          {(["alle", "untis", "manuell"] as const).map((q) => (
            <button
              key={q}
              onClick={() => setQuelleFilter(q)}
              className={`px-4 py-2.5 text-[15px] min-h-[44px] transition-colors ${
                quelleFilter === q
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white text-[#575756] hover:bg-gray-50"
              }`}
            >
              {q === "alle" ? "Alle" : q === "untis" ? "Untis" : "Manuell"}
            </button>
          ))}
        </div>

        {/* Gruppe filter (Beamte / Angestellte) */}
        <div className="flex rounded-lg border border-[#E5E7EB] overflow-hidden">
          {(["alle", "beamter", "angestellter", "ohne"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGruppeFilter(g)}
              className={`px-4 py-2.5 text-[15px] min-h-[44px] transition-colors ${
                gruppeFilter === g
                  ? "bg-[#1A1A1A] text-white"
                  : "bg-white text-[#575756] hover:bg-gray-50"
              }`}
              title={
                g === "alle"
                  ? "Alle Gruppen"
                  : g === "beamter"
                  ? "Beamte (L, LT, P, PT)"
                  : g === "angestellter"
                  ? "Angestellte TV-L (U, UT, B, BT)"
                  : "Ohne Statistik-Code"
              }
            >
              {g === "alle"
                ? "Alle Gruppen"
                : g === "beamter"
                ? "Beamte"
                : g === "angestellter"
                ? "Angestellte"
                : "Ohne Code"}
            </button>
          ))}
        </div>

        {/* Code filter chip (nur sichtbar bei aktivem Code-Deeplink) */}
        {codeFilter && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#1A1A1A] pl-3 pr-1 py-1 text-xs font-medium text-white">
            Code: {codeFilter}
            <button
              onClick={() => setCodeFilter(null)}
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-white/70 hover:text-white hover:bg-white/10"
              aria-label="Code-Filter entfernen"
            >
              <span aria-hidden="true">×</span>
            </button>
          </span>
        )}

        {/* Add button */}
        <Button
          onClick={() => {
            setShowAdd(!showAdd);
            setEditingId(null);
            setMessage(null);
          }}
          className="ml-auto"
        >
          + Neue Lehrkraft
        </Button>

        {/* Count */}
        <span className="text-sm text-[#6B7280]">
          {filtered.length} von {lehrer.length} Lehrkraefte
        </span>
      </div>

      {/* Add form */}
      {showAdd && (
        <Card className="mb-6 border-green-300 border-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              handleAction(createLehrerAction, fd);
            }}
          >
            <h3 className="text-[15px] font-semibold text-[#1A1A1A] mb-4">
              Neue Lehrkraft anlegen
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div>
                <label className="block text-sm text-[#575756] mb-1">Vorname *</label>
                <input
                  name="vorname"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Nachname *</label>
                <input
                  name="nachname"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Personalnummer</label>
                <input
                  name="personalnummer"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Stammschule *</label>
                <select
                  name="stammschuleId"
                  required
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                >
                  <option value="">Bitte waehlen...</option>
                  {schulen.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.kurzname} - {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">Deputat (Wochenstunden)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max="45"
                  name="deputat"
                  placeholder="z.B. 28"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px] tabular-nums"
                />
                <span className="text-xs text-[#9CA3AF]">Wird fuer alle 12 Monate uebernommen</span>
              </div>
              <div>
                <label className="block text-sm text-[#575756] mb-1">
                  Statistik-Code <span className="text-[#9CA3AF]">(Bezirksregierung)</span>
                </label>
                <StatistikCodeSelect
                  codes={statistikCodes}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
                <span className="text-xs text-[#9CA3AF]">Pflicht für Bezirksregierungs-Export</span>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving ? "Speichern..." : "Speichern"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowAdd(false);
                  setMessage(null);
                }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr className="border-b border-[#E5E7EB]">
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Name</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Personalnr.</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Code</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Stammschule</th>
                <th className="text-right py-3 px-4 font-semibold text-[#575756]">Deputat</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Quelle</th>
                <th className="text-left py-3 px-4 font-semibold text-[#575756]">Status</th>
                <th className="text-right py-3 px-4 font-semibold text-[#575756]">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-[#6B7280]">
                    Keine Lehrkraefte gefunden.
                  </td>
                </tr>
              )}
              {filtered.map((l, idx) => {
                const isEditing = editingId === l.id;
                const isManuell = l.quelle === "manuell";
                const rowBg = idx % 2 === 1 ? "bg-[#F9FAFB]" : "bg-white";

                if (isEditing && isManuell) {
                  return (
                    <tr key={l.id} className="bg-yellow-50 border-y border-yellow-200">
                      <td colSpan={8} className="py-3 px-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.currentTarget);
                            handleAction(updateLehrerAction, fd);
                          }}
                        >
                          <input type="hidden" name="id" value={l.id} />
                          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Vorname</label>
                              <input
                                name="vorname"
                                defaultValue={l.vorname ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Nachname</label>
                              <input
                                name="nachname"
                                defaultValue={l.nachname ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Personalnr.</label>
                              <input
                                name="personalnummer"
                                defaultValue={l.personalnummer ?? ""}
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Stammschule</label>
                              <select
                                name="stammschuleId"
                                defaultValue={l.stammschuleId ?? ""}
                                required
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              >
                                <option value="">Bitte waehlen...</option>
                                {schulen.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.kurzname}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Code</label>
                              <StatistikCodeSelect
                                codes={statistikCodes}
                                defaultValue={l.statistikCode ?? ""}
                                angestellteLabel="Angestellte"
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-[#575756] mb-1">Deputat (Std.)</label>
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                max="45"
                                name="deputat"
                                defaultValue={l.deputat ?? ""}
                                placeholder="z.B. 28"
                                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-[15px] min-h-[44px] tabular-nums"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button type="submit" disabled={saving}>
                                {saving ? "..." : "Speichern"}
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                onClick={() => {
                                  setEditingId(null);
                                  setMessage(null);
                                }}
                              >
                                Abbrechen
                              </Button>
                            </div>
                          </div>
                        </form>
                      </td>
                    </tr>
                  );
                }

                return (
                  <tr key={l.id} className={`${rowBg} border-b border-[#E5E7EB] last:border-b-0`}>
                    {/* Name */}
                    <td className="py-3 px-4">
                      <span className="font-semibold text-[#1A1A1A]">{l.vollname}</span>
                    </td>

                    {/* Personalnummer */}
                    <td className="py-3 px-4 text-[#575756]">
                      {l.personalnummer || <span className="text-[#D1D5DB]">-</span>}
                    </td>

                    {/* Statistik-Code */}
                    <td className="py-3 px-4">
                      {l.statistikCode ? (
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tabular-nums ${
                            l.statistikGruppe === "beamter"
                              ? "bg-blue-100 text-blue-800"
                              : l.statistikGruppe === "angestellter"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-gray-100 text-gray-700"
                          }`}
                          title={
                            l.statistikBezeichnung
                              ? `${l.statistikBezeichnung}${
                                  l.statistikIstTeilzeit ? " — Teilzeit" : ""
                                }`
                              : l.statistikCode
                          }
                        >
                          {l.statistikCode}
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]" title="Kein Statistik-Code hinterlegt">
                          —
                        </span>
                      )}
                    </td>

                    {/* Stammschule */}
                    <td className="py-3 px-4">
                      {l.schuleKurzname ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: l.schuleFarbe ?? "#6B7280" }}
                          />
                          <span className="text-[#575756]">{l.schuleKurzname}</span>
                        </span>
                      ) : (
                        <span className="text-[#D1D5DB]">-</span>
                      )}
                    </td>

                    {/* Deputat */}
                    <td className="py-3 px-4 text-right tabular-nums">
                      {l.deputat !== null && l.deputat > 0 ? (
                        <span className="font-bold">{l.deputat.toLocaleString("de-DE", { minimumFractionDigits: 1 })}</span>
                      ) : (
                        <span className="text-[#D1D5DB]">{"\u2014"}</span>
                      )}
                    </td>

                    {/* Quelle */}
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          l.quelle === "untis"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        {l.quelle === "untis" ? "Untis" : "Manuell"}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className={`inline-block w-2 h-2 rounded-full ${
                            l.aktiv ? "bg-green-500" : "bg-red-500"
                          }`}
                        />
                        <span className="text-sm text-[#575756]">
                          {l.aktiv ? "Aktiv" : "Inaktiv"}
                        </span>
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {haushaltsjahrId !== null && (
                          <a
                            href={`/api/export/lehrer-detail?lehrerId=${l.id}&hj=${haushaltsjahrId}`}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-[#009AC6] hover:bg-[#E0F2FB] hover:text-[#0086AC] transition-colors"
                            title="Detailseite als PDF (Nachweis-Dokument fuer Bezirksregierung)"
                            aria-label={`PDF-Nachweis fuer ${l.vollname}`}
                          >
                            <span aria-hidden>📄</span>
                            <span>PDF</span>
                          </a>
                        )}
                        {isManuell ? (
                          <>
                            <button
                              onClick={() => {
                                setEditingId(l.id);
                                setShowAdd(false);
                                setMessage(null);
                              }}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              Bearbeiten
                            </button>
                            <button
                              onClick={() => {
                                const fd = new FormData();
                                fd.set("id", String(l.id));
                                fd.set("aktiv", String(!l.aktiv));
                                handleAction(toggleLehrerAktivAction, fd);
                              }}
                              className={`text-sm hover:underline ${
                                l.aktiv
                                  ? "text-red-600 hover:text-red-800"
                                  : "text-green-600 hover:text-green-800"
                              }`}
                            >
                              {l.aktiv ? "Deaktivieren" : "Aktivieren"}
                            </button>
                          </>
                        ) : (
                          <span
                            className="text-xs text-[#D1D5DB] cursor-default"
                            title="Wird aus Untis synchronisiert"
                          >
                            Untis-Sync
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
