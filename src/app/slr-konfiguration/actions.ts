"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { slrWerte, slrHistorie } from "@/db/schema";
import { count, eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import {
  getAlleSchulStufen,
  getBenoetigteSchulStufen,
  getSchuljahrById,
  getVorgaengerSchuljahr,
  uebernehmeFehlendeSlrWerte,
} from "@/lib/db/queries";
import {
  ermittleBenoetigteSchulformTypen,
  ermittleZulaessigeSchulformTypen,
  normalisiereSchulformTyp,
} from "@/lib/berechnungen/schuljahrZuordnung";
import { z } from "zod";

/**
 * Relation "Schueler je Stelle": Komma -> Punkt, max. 3 Vor- und 2 Nachkommastellen,
 * und > 0 — eine 0 wuerde die Berechnung (baueSlrLookup) als "fehlend" werten,
 * das Dropdown den Typ aber als belegt sperren (Sackgasse).
 */
const relationSchema = z
  .string()
  .transform((v) => v.replace(",", "."))
  .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Format: z.B. 18.63 oder 21,95"))
  .refine((v) => Number(v) > 0, "Schueler je Stelle muss groesser als 0 sein.");

const slrUpdateSchema = z.object({
  id: z.number().int().positive(),
  relation: relationSchema,
  quelle: z.string().max(200).optional(),
  grund: z.string().min(1, "Aenderungsgrund ist erforderlich.").max(500),
});

const slrCreateSchema = z.object({
  schuljahrId: z.number().int().positive(),
  schulformTyp: z.string().min(1, "Schulform-Typ erforderlich.").max(50),
  relation: relationSchema,
  quelle: z.string().max(200).optional(),
});

/**
 * PostgreSQL-Errorcode aus einem Drizzle-Fehler holen. Drizzle wrappt jede
 * Treiber-Exception in DrizzleQueryError ("Failed query: ..."), der eigentliche
 * PostgresError mit code haengt an err.cause — deshalb die Kette durchlaufen.
 */
function pgErrorCode(err: unknown): string | undefined {
  let e = err;
  while (e && typeof e === "object") {
    const code = (e as { code?: unknown }).code;
    if (typeof code === "string") return code;
    e = (e as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Unique-Constraint-Verletzung (slr_werte_unique) erkennen. */
function istUniqueVerletzung(err: unknown): boolean {
  return pgErrorCode(err) === "23505";
}

function revalidateSlrPfade() {
  revalidatePath("/slr-konfiguration");
  revalidatePath("/stellensoll");
}

/**
 * SLR-Wert aktualisieren mit Versionierung.
 * Schreibt den alten Wert in die Historie-Tabelle.
 */
export async function updateSlrWertAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    id: Number(formData.get("id")),
    relation: String(formData.get("relation") ?? ""),
    quelle: String(formData.get("quelle") ?? "") || undefined,
    grund: String(formData.get("grund") ?? ""),
  };

  const parsed = slrUpdateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const { id, relation, quelle, grund } = parsed.data;

  // Aktuellen Wert laden
  const [existing] = await db.select().from(slrWerte).where(eq(slrWerte.id, id));
  if (!existing) {
    return { error: "SLR-Wert nicht gefunden." };
  }

  // Keine Aenderung?
  if (existing.relation === relation && (existing.quelle ?? "") === (quelle ?? "")) {
    return { error: "Keine Aenderung vorgenommen." };
  }

  // Transaktion: Historie schreiben + Wert aktualisieren
  await db.transaction(async (tx) => {
    // 1. Historie-Eintrag
    await tx.insert(slrHistorie).values({
      slrWertId: id,
      schuljahrId: existing.schuljahrId,
      schulformTyp: existing.schulformTyp,
      relationAlt: existing.relation,
      relationNeu: relation,
      quelleAlt: existing.quelle,
      quelleNeu: quelle ?? null,
      grund,
      geaendertVon: session.name,
    });

    // 2. Wert aktualisieren
    await tx
      .update(slrWerte)
      .set({
        relation,
        quelle: quelle ?? null,
        geaendertVon: session.name,
        updatedAt: new Date(),
      })
      .where(eq(slrWerte.id, id));
  });

  // Audit-Log
  await writeAuditLog("slr_werte", id, "UPDATE", {
    relation: existing.relation,
    quelle: existing.quelle,
  }, {
    relation,
    quelle: quelle ?? null,
    grund,
  }, session.name);

  revalidateSlrPfade();

  return {
    success: true,
    message: `SLR fuer "${existing.schulformTyp}" von ${existing.relation} auf ${relation} geaendert.`,
  };
}

/**
 * Neuen SLR-Wert hinzufuegen.
 * Der Typ muss zu einer Schulstufe gehoeren — sonst findet die Stellensoll-
 * Berechnung den Wert nie (Vorfall 10.09.2026: "GYM G9" statt
 * "Gymnasium Sek I (G9)" -> "Fehlende SLR-Werte"). Auch inaktive Stufen zaehlen:
 * eine deaktivierte Stufe mit Schuelerzahlen am Stichtag braucht den Wert trotzdem.
 */
export async function createSlrWertAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    schuljahrId: Number(formData.get("schuljahrId")),
    schulformTyp: String(formData.get("schulformTyp") ?? "").trim(),
    relation: String(formData.get("relation") ?? ""),
    quelle: String(formData.get("quelle") ?? "") || undefined,
  };

  const parsed = slrCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  const schulformTyp = normalisiereSchulformTyp(parsed.data.schulformTyp);

  // Typ muss von irgendeiner Schulstufe verwendet werden (zulaessige Typen, auch inaktive)
  const zulaessigeTypen = ermittleZulaessigeSchulformTypen(await getAlleSchulStufen());
  if (!zulaessigeTypen.includes(schulformTyp)) {
    return {
      error: `Schulform-Typ "${schulformTyp}" gehoert zu keiner Schulstufe. Bitte aus der Auswahl waehlen.`,
    };
  }

  // Duplikat pruefen (normalisiert, damit "Typ " und "Typ" nicht nebeneinander landen)
  const vorhandene = await db
    .select()
    .from(slrWerte)
    .where(eq(slrWerte.schuljahrId, parsed.data.schuljahrId));

  const existing = vorhandene.find((v) => normalisiereSchulformTyp(v.schulformTyp) === schulformTyp);
  if (existing) {
    return { error: `SLR fuer "${schulformTyp}" existiert bereits in diesem Schuljahr.` };
  }

  let createdId: number;
  try {
    const [created] = await db
      .insert(slrWerte)
      .values({
        schuljahrId: parsed.data.schuljahrId,
        schulformTyp,
        relation: parsed.data.relation,
        quelle: parsed.data.quelle ?? null,
        geaendertVon: session.name,
      })
      .returning();
    createdId = created.id;
  } catch (err: unknown) {
    if (istUniqueVerletzung(err)) {
      return { error: `SLR fuer "${schulformTyp}" existiert bereits in diesem Schuljahr.` };
    }
    console.error("Fehler beim Anlegen des SLR-Werts:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Anlegen des SLR-Werts." };
  }

  await writeAuditLog("slr_werte", createdId, "INSERT", null, {
    schulformTyp,
    relation: parsed.data.relation,
  }, session.name);

  revalidateSlrPfade();

  return { success: true, message: `SLR "${schulformTyp}" hinzugefuegt.` };
}

/**
 * SLR-Wert loeschen.
 * slr_historie.slr_wert_id referenziert slr_werte.id ohne ON DELETE CASCADE — ein
 * je bearbeiteter Wert ist deshalb nicht loeschbar (23503). Das wird vorab geprueft
 * und als Meldung erklaert, statt als "Aktion fehlgeschlagen" beim Nutzer anzukommen.
 */
export async function deleteSlrWertAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = Number(formData.get("id"));

  const [existing] = await db.select().from(slrWerte).where(eq(slrWerte.id, id));
  if (!existing) {
    return { error: "SLR-Wert nicht gefunden." };
  }

  const nichtLoeschbar =
    `SLR-Wert fuer "${existing.schulformTyp}" wurde bereits bearbeitet und hat eine Aenderungshistorie — ` +
    'er kann nicht geloescht werden. Bitte den Wert ueber "Bearbeiten" korrigieren.';

  const [historie] = await db
    .select({ n: count() })
    .from(slrHistorie)
    .where(eq(slrHistorie.slrWertId, id));
  if ((historie?.n ?? 0) > 0) {
    return { error: nichtLoeschbar };
  }

  try {
    await db.delete(slrWerte).where(eq(slrWerte.id, id));
  } catch (err: unknown) {
    // Historie-Eintrag zwischen Pruefung und Delete entstanden (paralleles Bearbeiten)
    if (pgErrorCode(err) === "23503") {
      return { error: nichtLoeschbar };
    }
    console.error("Fehler beim Loeschen des SLR-Werts:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Loeschen des SLR-Werts." };
  }

  // schuljahrId und quelle mitschreiben — nach dem Loeschen ist der Bezug sonst nicht rekonstruierbar
  await writeAuditLog("slr_werte", id, "DELETE", {
    schuljahrId: existing.schuljahrId,
    schulformTyp: existing.schulformTyp,
    relation: existing.relation,
    quelle: existing.quelle,
  }, null, session.name);

  revalidateSlrPfade();
  return { success: true, message: `SLR "${existing.schulformTyp}" geloescht.` };
}

/**
 * Fehlende SLR-Werte aus dem Vorgaenger-Schuljahr uebernehmen.
 * Fuer Schuljahre, die VOR der automatischen Uebernahme (createSchuljahr) angelegt
 * wurden oder bei denen einzelne Typen fehlen. Vorhandene Werte bleiben unberuehrt.
 */
export async function uebernehmeSlrAusVorjahrAction(formData: FormData) {
  const session = await requireWriteAccess();

  const schuljahrId = Number(formData.get("schuljahrId"));
  if (!Number.isInteger(schuljahrId) || schuljahrId <= 0) {
    return { error: "Ungueltiges Schuljahr." };
  }

  const ziel = await getSchuljahrById(schuljahrId);
  if (!ziel) {
    return { error: "Schuljahr nicht gefunden." };
  }

  const vorgaenger = await getVorgaengerSchuljahr(ziel.startDatum);
  if (!vorgaenger) {
    return { error: "Kein Vorgaenger-Schuljahr gefunden." };
  }

  // Nur Typen aktiver Stufen an aktiven Schulen — genau die, fuer die die Berechnung sicher einen Wert braucht
  const benoetigteTypen = ermittleBenoetigteSchulformTypen(await getBenoetigteSchulStufen());

  let uebernommen: Array<{ schulformTyp: string; relation: string }>;
  try {
    uebernommen = await uebernehmeFehlendeSlrWerte({
      zielSchuljahrId: ziel.id,
      vonSchuljahrId: vorgaenger.id,
      vonBezeichnung: vorgaenger.bezeichnung,
      benoetigteTypen,
      benutzer: session.name,
    });
  } catch (err: unknown) {
    // Zwei parallele Uebernahmen (zwei Tabs/Nutzer): die zweite scheitert an slr_werte_unique,
    // die Daten der ersten sind korrekt — nur die Seite muss neu geladen werden.
    if (istUniqueVerletzung(err)) {
      revalidateSlrPfade();
      return { error: "Die SLR-Werte wurden gerade parallel angelegt — bitte Seite neu laden und pruefen." };
    }
    console.error("Fehler beim Uebernehmen der SLR-Werte:", err instanceof Error ? err.message : "Unbekannt");
    return { error: "Fehler beim Uebernehmen der SLR-Werte." };
  }

  if (uebernommen.length > 0) {
    await writeAuditLog("slr_werte", ziel.id, "INSERT", null, {
      uebernommenAus: vorgaenger.bezeichnung,
      werte: uebernommen,
    }, session.name);
  }

  revalidateSlrPfade();

  if (uebernommen.length === 0) {
    return {
      success: true,
      message: `Keine fehlenden Werte, die aus ${vorgaenger.bezeichnung} uebernommen werden koennten.`,
    };
  }
  return {
    success: true,
    message: `${uebernommen.length} SLR-Werte aus ${vorgaenger.bezeichnung} uebernommen — bitte pruefen.`,
  };
}
