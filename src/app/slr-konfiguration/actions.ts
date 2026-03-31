"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { slrWerte, slrHistorie } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { z } from "zod";

const slrUpdateSchema = z.object({
  id: z.number().int().positive(),
  relation: z
    .string()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Format: z.B. 18.63 oder 21,95")),
  quelle: z.string().max(200).optional(),
  grund: z.string().min(1, "Aenderungsgrund ist erforderlich.").max(500),
});

const slrCreateSchema = z.object({
  schuljahrId: z.number().int().positive(),
  schulformTyp: z.string().min(1, "Schulform-Typ erforderlich.").max(50),
  relation: z
    .string()
    .transform((v) => v.replace(",", "."))
    .pipe(z.string().regex(/^\d{1,3}(\.\d{1,2})?$/, "Format: z.B. 18.63 oder 21,95")),
  quelle: z.string().max(200).optional(),
});

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

  revalidatePath("/slr-konfiguration");
  revalidatePath("/stellensoll");

  return {
    success: true,
    message: `SLR fuer "${existing.schulformTyp}" von ${existing.relation} auf ${relation} geaendert.`,
  };
}

/**
 * Neuen SLR-Wert hinzufuegen.
 */
export async function createSlrWertAction(formData: FormData) {
  const session = await requireWriteAccess();

  const raw = {
    schuljahrId: Number(formData.get("schuljahrId")),
    schulformTyp: String(formData.get("schulformTyp") ?? ""),
    relation: String(formData.get("relation") ?? ""),
    quelle: String(formData.get("quelle") ?? "") || undefined,
  };

  const parsed = slrCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
  }

  // Duplikat pruefen
  const [existing] = await db
    .select()
    .from(slrWerte)
    .where(
      and(
        eq(slrWerte.schuljahrId, parsed.data.schuljahrId),
        eq(slrWerte.schulformTyp, parsed.data.schulformTyp)
      )
    );

  if (existing) {
    return { error: `SLR fuer "${parsed.data.schulformTyp}" existiert bereits in diesem Schuljahr.` };
  }

  const [created] = await db
    .insert(slrWerte)
    .values({
      schuljahrId: parsed.data.schuljahrId,
      schulformTyp: parsed.data.schulformTyp,
      relation: parsed.data.relation,
      quelle: parsed.data.quelle ?? null,
      geaendertVon: session.name,
    })
    .returning();

  await writeAuditLog("slr_werte", created.id, "INSERT", null, {
    schulformTyp: parsed.data.schulformTyp,
    relation: parsed.data.relation,
  }, session.name);

  revalidatePath("/slr-konfiguration");

  return { success: true, message: `SLR "${parsed.data.schulformTyp}" hinzugefuegt.` };
}

/**
 * SLR-Wert loeschen (mit Historie-Vermerk).
 */
export async function deleteSlrWertAction(formData: FormData) {
  const session = await requireWriteAccess();
  const id = Number(formData.get("id"));

  const [existing] = await db.select().from(slrWerte).where(eq(slrWerte.id, id));
  if (!existing) {
    return { error: "SLR-Wert nicht gefunden." };
  }

  await db.delete(slrWerte).where(eq(slrWerte.id, id));

  await writeAuditLog("slr_werte", id, "DELETE", {
    schulformTyp: existing.schulformTyp,
    relation: existing.relation,
  }, null, session.name);

  revalidatePath("/slr-konfiguration");
  return { success: true, message: `SLR "${existing.schulformTyp}" geloescht.` };
}
