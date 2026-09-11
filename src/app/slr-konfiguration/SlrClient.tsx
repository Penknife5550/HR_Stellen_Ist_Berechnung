"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  updateSlrWertAction,
  createSlrWertAction,
  deleteSlrWertAction,
  uebernehmeSlrAusVorjahrAction,
} from "./actions";
import {
  ermittleFehlendeSlrTypen,
  ermittleSlrVorschlag,
  ermittleVerwaisteSlrTypen,
  normalisiereSchulformTyp,
  type SlrVorschlag,
} from "@/lib/berechnungen/schuljahrZuordnung";
import { SLR_DEFAULTS_2025_2026, SLR_DEFAULTS_QUELLE } from "@/lib/constants";

type SlrWert = {
  id: number;
  schuljahrId: number;
  schulformTyp: string;
  relation: string;
  quelle: string | null;
};

type HistorieEintrag = {
  id: number;
  schulformTyp: string;
  relationAlt: string;
  relationNeu: string;
  quelleAlt: string | null;
  quelleNeu: string | null;
  grund: string | null;
  geaendertVon: string;
  geaendertAm: string;
};

type Schuljahr = {
  id: number;
  bezeichnung: string;
  startDatum: string;
  endDatum: string;
  /** Id des zuletzt begonnenen Vorgaengers — null beim aeltesten Schuljahr */
  vorgaengerId: number | null;
  /** Bezeichnung des zuletzt begonnenen Vorgaengers — null beim aeltesten Schuljahr */
  vorgaengerBezeichnung: string | null;
};

/** Eingaben des Neu-Formulars — kontrolliert, damit die Vorbelegung beim Typ-Wechsel greift */
type NeuFormular = {
  schulformTyp: string;
  relation: string;
  quelle: string;
  herkunft: SlrVorschlag["herkunft"];
};

const LEERES_NEU_FORMULAR: NeuFormular = { schulformTyp: "", relation: "", quelle: "", herkunft: null };

type Props = {
  schuljahre: Schuljahr[];
  slrBySchuljahr: Record<number, SlrWert[]>;
  historieBySchuljahr: Record<number, HistorieEintrag[]>;
  defaultSchuljahrId: number;
  /**
   * Typen ALLER Schulstufen (auch inaktive, auch inaktiver Schulen; normalisiert, sortiert) —
   * waehlbar beim Anlegen, denn eine deaktivierte Stufe kann am Stichtag noch Schuelerzahlen haben.
   */
  zulaessigeTypen: string[];
  /** Typen aktiver Schulstufen an aktiven Schulen — fuer genau diese braucht die Berechnung sicher einen SLR-Wert */
  benoetigteTypen: string[];
};

/** Laufende Server-Action — je Art, damit nur der ausloesende Button "Speichere..." zeigt */
type Pending = "create" | "update" | "delete" | "uebernahme" | null;

type ActionResult = { success?: boolean; error?: string; message?: string };

const VERWAIST_TOOLTIP = "Dieser Typ gehoert zu keiner Schulstufe — die Berechnung findet ihn nicht.";

export function SlrClient({
  schuljahre,
  slrBySchuljahr,
  historieBySchuljahr,
  defaultSchuljahrId,
  zulaessigeTypen,
  benoetigteTypen,
}: Props) {
  const [selectedSjId, setSelectedSjId] = useState(defaultSchuljahrId);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showHistorie, setShowHistorie] = useState(false);
  const [pending, setPending] = useState<Pending>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [neuFormular, setNeuFormular] = useState<NeuFormular>(LEERES_NEU_FORMULAR);

  const slrWerte = slrBySchuljahr[selectedSjId] ?? [];
  const historie = historieBySchuljahr[selectedSjId] ?? [];
  const selectedSj = schuljahre.find((sj) => sj.id === selectedSjId);

  // Luecken (gegen benoetigte Typen) und Tippfehler (gegen zulaessige Typen) fuer das gewaehlte
  // Schuljahr — dieselbe Normalisierung wie die Berechnung
  const fehlendeTypen = ermittleFehlendeSlrTypen(benoetigteTypen, slrWerte);
  const verwaisteTypen = new Set(ermittleVerwaisteSlrTypen(zulaessigeTypen, slrWerte));
  const vorhandeneTypen = new Set(slrWerte.map((slr) => normalisiereSchulformTyp(slr.schulformTyp)));
  const waehlbareTypen = zulaessigeTypen.filter((typ) => !vorhandeneTypen.has(typ));
  // Dropdown: benoetigte Typen zuerst, die uebrigen zulaessigen (inaktive Stufe / inaktive Schule) darunter
  const benoetigt = new Set(benoetigteTypen);
  const weitereTypen = zulaessigeTypen.filter((typ) => !benoetigt.has(typ));
  // "Fehlend" heisst: kein Wert > 0. Eine Altlast-Zeile mit Relation 0 ist zwar vorhanden (Typ im
  // Dropdown gesperrt, Uebernahme ueberspringt ihn), zaehlt fuer die Berechnung aber als fehlend.
  const echtFehlendeTypen = fehlendeTypen.filter((typ) => !vorhandeneTypen.has(typ));
  const nullWertTypen = fehlendeTypen.filter((typ) => vorhandeneTypen.has(typ));
  const keinTypWaehlbarHinweis =
    zulaessigeTypen.length === 0
      ? "Keine Schulstufen vorhanden — bitte zuerst unter Einstellungen → Schulstufen anlegen."
      : "Alle Schulstufen-Typen haben bereits einen SLR-Wert.";

  // Vorbelegung beim Typ-Wechsel: Vorjahreswert vor Standardwert (SLR_DEFAULTS_2025_2026), sonst leer.
  // Relation und Quelle werden bei jedem Typ-WECHSEL ueberschrieben — vorhersagbar statt "klebrig";
  // dieselbe Auswahl noch einmal laesst eine manuell korrigierte Relation stehen.
  function handleNeuTypChange(typ: string) {
    if (typ === neuFormular.schulformTyp) return;
    const vorgaenger = selectedSj?.vorgaengerId
      ? { bezeichnung: selectedSj.vorgaengerBezeichnung ?? "", werte: slrBySchuljahr[selectedSj.vorgaengerId] ?? [] }
      : null;
    const vorschlag = ermittleSlrVorschlag(typ, vorgaenger, SLR_DEFAULTS_2025_2026, SLR_DEFAULTS_QUELLE);
    setNeuFormular({ schulformTyp: typ, ...vorschlag });
  }

  const vorbelegungHinweis =
    neuFormular.herkunft === "vorjahr"
      ? `Vorbelegt aus ${selectedSj?.vorgaengerBezeichnung} — bitte pruefen`
      : neuFormular.herkunft === "standard"
        ? "Vorbelegt aus § 8 VO zu § 93 Abs. 2 SchulG (Stand 2025/2026) — bitte pruefen"
        : "Kein Vorjahres- oder Standardwert bekannt — bitte eintragen";

  // Die Formulare rufen die Server-Actions per onSubmit direkt auf, nicht ueber <form action>:
  // eine Form-Action laeuft als Transition (setState wird erst nach Abschluss committed — das
  // Pending-Flag wuerde nie gerendert, Doppelklick loest die Action zweimal aus), und React setzt
  // das Formular nach JEDER Action zurueck, auch bei Fehler-Result (das kontrollierte Select fiele
  // auf "Bitte waehlen ..." zurueck). revalidatePath in der Action aktualisiert den Router weiterhin.
  async function handleAction(art: NonNullable<Pending>, action: (fd: FormData) => Promise<ActionResult>, formData: FormData) {
    if (pending !== null) return; // Doppelklick-Sperre
    setPending(art);
    setMessage(null);
    try {
      const result = await action(formData);
      if (result.error) {
        setMessage({ type: "error", text: result.error });
      } else {
        setMessage({ type: "success", text: result.message ?? "Gespeichert!" });
        setEditingId(null);
        setShowAdd(false);
        setNeuFormular(LEERES_NEU_FORMULAR);
        setConfirmDelete(null);
      }
    } catch {
      // Server-Action rejected (Netz, unerwarteter Serverfehler): Buttons nicht dauerhaft sperren
      setMessage({ type: "error", text: "Aktion fehlgeschlagen. Bitte Seite neu laden." });
    } finally {
      setPending(null);
    }
  }

  return (
    <>
      {/* Schuljahr-Auswahl + Aktionen */}
      <div className="flex items-center gap-4 mb-6">
        <label className="text-[15px] font-medium text-[#1A1A1A]">Schuljahr:</label>
        <select
          value={selectedSjId}
          onChange={(e) => {
            setSelectedSjId(Number(e.target.value));
            setEditingId(null);
            setShowAdd(false);
            setNeuFormular(LEERES_NEU_FORMULAR);
            setMessage(null);
          }}
          className="border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-[15px] min-h-[44px]"
        >
          {schuljahre.map((sj) => (
            <option key={sj.id} value={sj.id}>
              {sj.bezeichnung}
            </option>
          ))}
        </select>

        <div className="ml-auto flex gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowHistorie(!showHistorie)}
          >
            {showHistorie ? "Tabelle anzeigen" : `Historie (${historie.length})`}
          </Button>
          <Button
            size="sm"
            onClick={() => { setShowAdd(true); setNeuFormular(LEERES_NEU_FORMULAR); setEditingId(null); setMessage(null); }}
            disabled={showAdd || waehlbareTypen.length === 0}
            title={waehlbareTypen.length === 0 ? keinTypWaehlbarHinweis : undefined}
          >
            + Neuen SLR-Wert
          </Button>
        </div>
      </div>
      {/* Erklaert den deaktivierten Button — der Hinweis muss ohne Klick sichtbar sein */}
      {waehlbareTypen.length === 0 && (
        <p className="-mt-4 mb-4 text-right text-xs text-[#6B7280]">{keinTypWaehlbarHinweis}</p>
      )}

      {/* Meldung */}
      {message && (
        <div
          role="status"
          aria-live={message.type === "error" ? "assertive" : "polite"}
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Neuen Wert hinzufuegen */}
      {showAdd && waehlbareTypen.length > 0 && (
        <Card className="mb-4 border-[#6BAA24]">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleAction("create", createSlrWertAction, new FormData(e.currentTarget));
            }}
          >
            <input type="hidden" name="schuljahrId" value={selectedSjId} />
            <h3 className="text-[15px] font-bold mb-3">Neuen SLR-Wert hinzufuegen</h3>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div>
                <label htmlFor="slr-schulformTyp" className="block text-xs font-bold text-[#6B7280] mb-1">Schulform-Typ</label>
                <select
                  id="slr-schulformTyp"
                  name="schulformTyp"
                  required
                  value={neuFormular.schulformTyp}
                  onChange={(e) => handleNeuTypChange(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px] bg-white"
                >
                  <option value="">Bitte waehlen ...</option>
                  {benoetigteTypen.map((typ) => (
                    <option key={typ} value={typ} disabled={vorhandeneTypen.has(typ)}>
                      {typ}
                    </option>
                  ))}
                  {weitereTypen.length > 0 && (
                    <optgroup label="Weitere Schulstufen (inaktiv oder inaktive Schule)">
                      {weitereTypen.map((typ) => (
                        <option key={typ} value={typ} disabled={vorhandeneTypen.has(typ)}>
                          {typ}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <p className="text-xs text-[#6B7280] mt-1">
                  Nur Typen vorhandener Schulstufen (Einstellungen → Schulstufen); bereits belegte Typen sind ausgegraut.
                </p>
              </div>
              <div>
                <label htmlFor="slr-relation" className="block text-xs font-bold text-[#6B7280] mb-1">Schueler je Stelle</label>
                <input
                  id="slr-relation"
                  type="text"
                  name="relation"
                  placeholder="z.B. 18,63"
                  required
                  value={neuFormular.relation}
                  onChange={(e) => setNeuFormular({ ...neuFormular, relation: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] text-right tabular-nums min-h-[44px]"
                />
                {/* Herkunft der Vorbelegung — erst nach Typ-Wahl, vorher gibt es nichts zu pruefen */}
                {neuFormular.schulformTyp !== "" && (
                  <p className="text-xs text-[#6B7280] mt-1">{vorbelegungHinweis}</p>
                )}
              </div>
              <div>
                <label htmlFor="slr-quelle" className="block text-xs font-bold text-[#6B7280] mb-1">Quelle / Rechtsgrundlage</label>
                <input
                  id="slr-quelle"
                  type="text"
                  name="quelle"
                  placeholder="z.B. § 8 VO zu § 93 Abs. 2 SchulG"
                  value={neuFormular.quelle}
                  onChange={(e) => setNeuFormular({ ...neuFormular, quelle: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-[15px] min-h-[44px]"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={pending !== null}>
                {pending === "create" ? "Speichere..." : "Hinzufuegen"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => { setShowAdd(false); setNeuFormular(LEERES_NEU_FORMULAR); }}
              >
                Abbrechen
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Luecken-Hinweis: benoetigte Typen (aktive Stufen an aktiven Schulen) ohne SLR-Wert — daran scheitert die Berechnung.
          Nur die Textabsaetze sind Live-Region; das Uebernahme-Formular liegt ausserhalb, damit der Button-Wechsel
          ("Uebernehme...") nicht als Statusmeldung vorgelesen wird. */}
      {fehlendeTypen.length > 0 && selectedSj && (
        <div className="mb-4 p-3 rounded-lg border border-amber-200 bg-amber-50 text-sm text-[#575756]">
          <div role="status" aria-live="polite">
            {echtFehlendeTypen.length > 0 && (
              <>
                <p>
                  Fuer diese Schulstufen-Typen fehlt im Schuljahr {selectedSj.bezeichnung} noch ein SLR-Wert:{" "}
                  <strong>{echtFehlendeTypen.join(", ")}</strong>.
                </p>
                {!selectedSj.vorgaengerBezeichnung && (
                  <p className="mt-1 text-[#6B7280]">
                    Kein Vorgaenger-Schuljahr vorhanden — bitte die Werte ueber &quot;+ Neuen SLR-Wert&quot; anlegen.
                  </p>
                )}
              </>
            )}
            {nullWertTypen.length > 0 && (
              <p className={echtFehlendeTypen.length > 0 ? "mt-2" : undefined}>
                Wert 0 fuer <strong>{nullWertTypen.join(", ")}</strong> — die Berechnung wertet das als fehlend.
                Bitte ueber &quot;Bearbeiten&quot; korrigieren.
              </p>
            )}
          </div>
          {/* Kein <form>: Dieser Block wird serverseitig gerendert — ein Klick vor der Hydration wuerde
              als native GET-Navigation (?schuljahrId=...) landen. Ein type="button" tut ohne React nichts. */}
          {echtFehlendeTypen.length > 0 && selectedSj.vorgaengerBezeichnung && (
            <div className="mt-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={pending !== null}
                onClick={() => {
                  const fd = new FormData();
                  fd.set("schuljahrId", String(selectedSj.id));
                  void handleAction("uebernahme", uebernehmeSlrAusVorjahrAction, fd);
                }}
              >
                {pending === "uebernahme" ? "Uebernehme..." : `Fehlende Werte aus ${selectedSj.vorgaengerBezeichnung} uebernehmen`}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* HISTORIE-ANSICHT */}
      {showHistorie ? (
        <Card>
          <h3 className="text-lg font-bold text-[#1A1A1A] mb-4">
            Aenderungshistorie — {selectedSj?.bezeichnung}
          </h3>
          {historie.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Datum</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Schulform</th>
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Alt</th>
                  <th className="text-center py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold" />
                  <th className="text-right py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Neu</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Grund</th>
                  <th className="text-left py-2 px-3 text-xs uppercase tracking-wider text-[#575756] font-bold">Von</th>
                </tr>
              </thead>
              <tbody>
                {historie.map((h, i) => (
                  <tr key={h.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                    <td className="py-3 px-3 text-sm text-[#6B7280] tabular-nums">{h.geaendertAm}</td>
                    <td className="py-3 px-3 text-[15px] font-medium">{h.schulformTyp}</td>
                    <td className="py-3 px-3 text-[15px] text-right tabular-nums text-[#E2001A] line-through">
                      {Number(h.relationAlt).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-center text-[#6B7280]">→</td>
                    <td className="py-3 px-3 text-[15px] text-right tabular-nums font-bold text-[#22C55E]">
                      {Number(h.relationNeu).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3 px-3 text-sm text-[#575756]">{h.grund ?? "—"}</td>
                    <td className="py-3 px-3 text-sm text-[#6B7280]">{h.geaendertVon}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[#6B7280] py-6 text-center text-sm">
              Keine Aenderungen fuer dieses Schuljahr protokolliert.
            </p>
          )}
        </Card>
      ) : (
        /* SLR-TABELLE MIT INLINE-EDITING */
        <Card>
          {slrWerte.length > 0 ? (
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-[#575756]">
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Schulform-Typ
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Schueler je Stelle
                  </th>
                  <th className="text-left py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold">
                    Quelle
                  </th>
                  <th className="text-right py-3 px-4 text-xs uppercase tracking-wider text-[#575756] font-bold w-[180px]">
                    Aktionen
                  </th>
                </tr>
              </thead>
              <tbody>
                {slrWerte.map((slr, i) => (
                  editingId === slr.id ? (
                    /* EDIT-MODUS */
                    <tr key={slr.id} className="bg-[#FEF7CC]">
                      <td colSpan={4} className="p-4">
                        <form
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleAction("update", updateSlrWertAction, new FormData(e.currentTarget));
                          }}
                        >
                          <input type="hidden" name="id" value={slr.id} />
                          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                            <div className="col-span-3">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Schulform</label>
                              <div className="text-[15px] font-medium py-2">{slr.schulformTyp}</div>
                            </div>
                            <div className="col-span-2">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Neuer Wert</label>
                              <input
                                type="text"
                                name="relation"
                                defaultValue={Number(slr.relation).toLocaleString("de-DE", { minimumFractionDigits: 2 })}
                                required
                                className="w-full border border-[#FBC900] rounded px-3 py-2 text-[15px] text-right tabular-nums font-bold min-h-[44px] bg-white"
                                autoFocus
                              />
                            </div>
                            <div className="col-span-3">
                              <label className="block text-xs font-bold text-[#6B7280] mb-1">Quelle</label>
                              <input
                                type="text"
                                name="quelle"
                                defaultValue={slr.quelle ?? ""}
                                className="w-full border border-[#E5E7EB] rounded px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                            <div className="col-span-4">
                              <label className="block text-xs font-bold text-[#E2001A] mb-1">Aenderungsgrund *</label>
                              <input
                                type="text"
                                name="grund"
                                placeholder="z.B. Bewirtschaftungserlass 2026/27"
                                required
                                className="w-full border border-[#E2001A] rounded px-3 py-2 text-[15px] min-h-[44px]"
                              />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-3">
                            <Button type="submit" size="sm" disabled={pending !== null}>
                              {pending === "update" ? "Speichere..." : "Speichern"}
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                              Abbrechen
                            </Button>
                          </div>
                        </form>
                      </td>
                    </tr>
                  ) : (
                    /* ANZEIGE-MODUS */
                    <tr key={slr.id} className={i % 2 === 0 ? "bg-white" : "bg-[#F9FAFB]"}>
                      <td className="py-3 px-4 text-[15px] font-medium">
                        <span className="inline-flex items-center gap-2 flex-wrap">
                          {slr.schulformTyp}
                          {verwaisteTypen.has(normalisiereSchulformTyp(slr.schulformTyp)) && (
                            <span
                              title={VERWAIST_TOOLTIP}
                              className="text-xs font-medium border border-[#E2001A] text-[#E2001A] rounded px-1.5 py-0.5"
                            >
                              Keiner Schulstufe zugeordnet
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-[15px] text-right tabular-nums font-bold">
                        {Number(slr.relation).toLocaleString("de-DE", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#6B7280]">
                        {slr.quelle ?? `VO zu § 93 Abs. 2 SchulG ${selectedSj?.bezeichnung}`}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingId(slr.id); setMessage(null); }}
                          >
                            Bearbeiten
                          </Button>
                          {confirmDelete === slr.id ? (
                            <form
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleAction("delete", deleteSlrWertAction, new FormData(e.currentTarget));
                              }}
                              className="flex gap-1"
                            >
                              <input type="hidden" name="id" value={slr.id} />
                              <Button type="submit" variant="danger" size="sm" disabled={pending !== null}>
                                {pending === "delete" ? "Loesche..." : "Ja, loeschen"}
                              </Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>
                                Nein
                              </Button>
                            </form>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setConfirmDelete(slr.id)}
                              className="text-[#E2001A] hover:text-[#E2001A]"
                            >
                              ×
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[#6B7280] py-8 text-center">
              Fuer das Schuljahr {selectedSj?.bezeichnung} sind keine SLR-Werte hinterlegt.
            </p>
          )}
        </Card>
      )}
    </>
  );
}
