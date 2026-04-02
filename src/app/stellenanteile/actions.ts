"use server";

import { revalidatePath } from "next/cache";
import { stellenanteile } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import {
  createStellenanteil,
  updateStellenanteil,
  deleteStellenanteil,
} from "@/lib/db/queries";
import { stellenanteilCreateSchema, stellenanteilUpdateSchema } from "@/lib/validation";
import { VALID_STELLENANTEIL_STATUSES } from "@/lib/constants";

function optionalString(formData: FormData, key: string): string | undefined {
  const val = String(formData.get(key) ?? "").trim();
  return val || undefined;
}

function optionalNumber(formData: FormData, key: string): number | null {
  const val = formData.get(key);
  if (!val || val === "" || val === "0") return null;
  const num = Number(val);
  return isNaN(num) ? null : num;
}

export async function createStellenanteilAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const raw = {
      schuleId: Number(formData.get("schuleId")),
      haushaltsjahrId: Number(formData.get("haushaltsjahrId")),
      stellenartTypId: Number(formData.get("stellenartTypId")),
      lehrerId: optionalNumber(formData, "lehrerId"),
      wert: String(formData.get("wert") ?? ""),
      eurBetrag: optionalString(formData, "eurBetrag") ?? "",
      wahlrecht: optionalString(formData, "wahlrecht"),
      zeitraum: String(formData.get("zeitraum") ?? "ganzjahr"),
      status: String(formData.get("status") ?? "beantragt"),
      befristetBis: optionalString(formData, "befristetBis"),
      antragsdatum: optionalString(formData, "antragsdatum"),
      aktenzeichen: optionalString(formData, "aktenzeichen"),
      dmsDokumentennummer: optionalString(formData, "dmsDokumentennummer"),
      bemerkung: optionalString(formData, "bemerkung"),
    };

    const parsed = stellenanteilCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
    }

    const created = await createStellenanteil({
      schuleId: parsed.data.schuleId,
      haushaltsjahrId: parsed.data.haushaltsjahrId,
      stellenartTypId: parsed.data.stellenartTypId,
      lehrerId: parsed.data.lehrerId ?? null,
      wert: parsed.data.wert,
      eurBetrag: parsed.data.eurBetrag || null,
      wahlrecht: parsed.data.wahlrecht ?? null,
      zeitraum: parsed.data.zeitraum,
      status: parsed.data.status,
      befristetBis: parsed.data.befristetBis || null,
      antragsdatum: parsed.data.antragsdatum || null,
      aktenzeichen: parsed.data.aktenzeichen ?? null,
      dmsDokumentennummer: parsed.data.dmsDokumentennummer ?? null,
      bemerkung: parsed.data.bemerkung ?? null,
      erstelltVon: session.name,
    });

    await writeAuditLog("stellenanteile", created.id, "INSERT", null, {
      schuleId: parsed.data.schuleId,
      stellenartTypId: parsed.data.stellenartTypId,
      wert: parsed.data.wert,
      status: parsed.data.status,
      lehrerId: parsed.data.lehrerId,
    }, session.name);

    revalidatePath("/stellenanteile");
    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");

    return { success: true, message: "Stellenanteil erfolgreich angelegt." };
  } catch {
    return { error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
}

export async function updateStellenanteilAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const raw = {
      id: Number(formData.get("id")),
      schuleId: Number(formData.get("schuleId")),
      haushaltsjahrId: Number(formData.get("haushaltsjahrId")),
      stellenartTypId: Number(formData.get("stellenartTypId")),
      lehrerId: optionalNumber(formData, "lehrerId"),
      wert: String(formData.get("wert") ?? ""),
      eurBetrag: optionalString(formData, "eurBetrag") ?? "",
      wahlrecht: optionalString(formData, "wahlrecht"),
      zeitraum: String(formData.get("zeitraum") ?? "ganzjahr"),
      status: String(formData.get("status") ?? "beantragt"),
      befristetBis: optionalString(formData, "befristetBis"),
      antragsdatum: optionalString(formData, "antragsdatum"),
      aktenzeichen: optionalString(formData, "aktenzeichen"),
      dmsDokumentennummer: optionalString(formData, "dmsDokumentennummer"),
      bemerkung: optionalString(formData, "bemerkung"),
    };

    const parsed = stellenanteilUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
    }

    const [existing] = await db.select().from(stellenanteile).where(eq(stellenanteile.id, parsed.data.id));
    if (!existing) {
      return { error: "Stellenanteil nicht gefunden." };
    }

    await updateStellenanteil(parsed.data.id, {
      stellenartTypId: parsed.data.stellenartTypId,
      lehrerId: parsed.data.lehrerId ?? null,
      wert: parsed.data.wert,
      eurBetrag: parsed.data.eurBetrag || null,
      wahlrecht: parsed.data.wahlrecht ?? null,
      zeitraum: parsed.data.zeitraum,
      status: parsed.data.status,
      befristetBis: parsed.data.befristetBis || null,
      antragsdatum: parsed.data.antragsdatum || null,
      aktenzeichen: parsed.data.aktenzeichen ?? null,
      dmsDokumentennummer: parsed.data.dmsDokumentennummer ?? null,
      bemerkung: parsed.data.bemerkung ?? null,
      geaendertVon: session.name,
    });

    await writeAuditLog("stellenanteile", parsed.data.id, "UPDATE", {
      wert: existing.wert,
      status: existing.status,
      stellenartTypId: existing.stellenartTypId,
      lehrerId: existing.lehrerId,
    }, {
      wert: parsed.data.wert,
      status: parsed.data.status,
      stellenartTypId: parsed.data.stellenartTypId,
      lehrerId: parsed.data.lehrerId,
    }, session.name);

    revalidatePath("/stellenanteile");
    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");

    return { success: true, message: "Stellenanteil erfolgreich aktualisiert." };
  } catch {
    return { error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
}

export async function deleteStellenanteilAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const id = Number(formData.get("id"));
    if (!id || isNaN(id)) {
      return { error: "Ungueltige ID." };
    }

    const [existing] = await db.select().from(stellenanteile).where(eq(stellenanteile.id, id));
    if (!existing) {
      return { error: "Stellenanteil nicht gefunden." };
    }

    await deleteStellenanteil(id);

    await writeAuditLog("stellenanteile", id, "DELETE", {
      schuleId: existing.schuleId,
      stellenartTypId: existing.stellenartTypId,
      wert: existing.wert,
      status: existing.status,
      lehrerId: existing.lehrerId,
    }, null, session.name);

    revalidatePath("/stellenanteile");
    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");

    return { success: true, message: "Stellenanteil geloescht." };
  } catch {
    return { error: "Loeschen fehlgeschlagen. Bitte erneut versuchen." };
  }
}

export async function updateStellenanteilStatusAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const id = Number(formData.get("id"));
    const newStatus = String(formData.get("status") ?? "");

    if (!id || isNaN(id)) {
      return { error: "Ungueltige ID." };
    }

    if (!(VALID_STELLENANTEIL_STATUSES as readonly string[]).includes(newStatus)) {
      return { error: "Ungueltiger Status." };
    }

    const [existing] = await db.select().from(stellenanteile).where(eq(stellenanteile.id, id));
    if (!existing) {
      return { error: "Stellenanteil nicht gefunden." };
    }

    await updateStellenanteil(id, {
      status: newStatus,
      geaendertVon: session.name,
    });

    await writeAuditLog("stellenanteile", id, "UPDATE", {
      status: existing.status,
    }, {
      status: newStatus,
    }, session.name);

    revalidatePath("/stellenanteile");
    revalidatePath("/stellensoll");
    revalidatePath("/dashboard");

    return { success: true, message: `Status auf "${newStatus}" geaendert.` };
  } catch {
    return { error: "Statusaenderung fehlgeschlagen." };
  }
}
