"use server";

import { revalidatePath } from "next/cache";
import { regeldeputate } from "@/db/schema";
import { db } from "@/db";
import { eq } from "drizzle-orm";
import { writeAuditLog } from "@/lib/audit";
import { requireWriteAccess } from "@/lib/auth/permissions";
import {
  updateRegeldeputat as updateRegeldeputatDb,
  createRegeldeputat as createRegeldeputatDb,
} from "@/lib/db/queries";
import { z } from "zod";

const regeldeputatWert = z
  .string()
  .transform((v) => v.replaceAll(",", "."))
  .pipe(z.string().regex(/^\d{1,2}(\.\d)?$/, "Format: z.B. 25,5 oder 28"));

const optionalFields = {
  rechtsgrundlage: z.string().max(300).optional(),
  bassFundstelle: z.string().max(100).optional(),
  gueltigAb: z.string().optional(),
  bemerkung: z.string().max(500).optional(),
};

const regeldeputatUpdateSchema = z.object({
  id: z.number().int().positive(),
  regeldeputat: regeldeputatWert,
  ...optionalFields,
});

const regeldeputatCreateSchema = z.object({
  schulformCode: z.string().min(1, "Schulform-Code erforderlich.").max(10),
  schulformName: z.string().min(1, "Schulform-Name erforderlich.").max(100),
  regeldeputat: regeldeputatWert,
  ...optionalFields,
});

function optionalString(formData: FormData, key: string): string | undefined {
  return String(formData.get(key) ?? "") || undefined;
}

export async function updateRegeldeputatAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const raw = {
      id: Number(formData.get("id")),
      regeldeputat: String(formData.get("regeldeputat") ?? ""),
      rechtsgrundlage: optionalString(formData, "rechtsgrundlage"),
      bassFundstelle: optionalString(formData, "bassFundstelle"),
      gueltigAb: optionalString(formData, "gueltigAb"),
      bemerkung: optionalString(formData, "bemerkung"),
    };

    const parsed = regeldeputatUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
    }

    const { id, ...updateData } = parsed.data;

    const [existing] = await db.select().from(regeldeputate).where(eq(regeldeputate.id, id));
    if (!existing) {
      return { error: "Regeldeputat nicht gefunden." };
    }

    await updateRegeldeputatDb(id, {
      regeldeputat: updateData.regeldeputat,
      rechtsgrundlage: updateData.rechtsgrundlage ?? null,
      bassFundstelle: updateData.bassFundstelle ?? null,
      gueltigAb: updateData.gueltigAb ?? null,
      bemerkung: updateData.bemerkung ?? null,
    });

    await writeAuditLog("regeldeputate", id, "UPDATE", {
      regeldeputat: existing.regeldeputat,
      rechtsgrundlage: existing.rechtsgrundlage,
    }, {
      regeldeputat: updateData.regeldeputat,
      rechtsgrundlage: updateData.rechtsgrundlage ?? null,
    }, session.name);

    revalidatePath("/regeldeputate");
    revalidatePath("/stellenist");
    revalidatePath("/dashboard");

    return {
      success: true,
      message: `Regeldeputat fuer "${existing.schulformName}" von ${existing.regeldeputat} auf ${updateData.regeldeputat} Std. geaendert.`,
    };
  } catch {
    return { error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
}

export async function createRegeldeputatAction(formData: FormData) {
  const session = await requireWriteAccess();

  try {
    const raw = {
      schulformCode: String(formData.get("schulformCode") ?? ""),
      schulformName: String(formData.get("schulformName") ?? ""),
      regeldeputat: String(formData.get("regeldeputat") ?? ""),
      rechtsgrundlage: optionalString(formData, "rechtsgrundlage"),
      bassFundstelle: optionalString(formData, "bassFundstelle"),
      gueltigAb: optionalString(formData, "gueltigAb"),
      bemerkung: optionalString(formData, "bemerkung"),
    };

    const parsed = regeldeputatCreateSchema.safeParse(raw);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Ungueltige Eingabe." };
    }

    const [existing] = await db
      .select()
      .from(regeldeputate)
      .where(eq(regeldeputate.schulformCode, parsed.data.schulformCode));

    if (existing) {
      return { error: `Regeldeputat fuer "${parsed.data.schulformCode}" existiert bereits.` };
    }

    const created = await createRegeldeputatDb({
      schulformCode: parsed.data.schulformCode,
      schulformName: parsed.data.schulformName,
      regeldeputat: parsed.data.regeldeputat,
      rechtsgrundlage: parsed.data.rechtsgrundlage ?? null,
      bassFundstelle: parsed.data.bassFundstelle ?? null,
      gueltigAb: parsed.data.gueltigAb ?? null,
      bemerkung: parsed.data.bemerkung ?? null,
    });

    await writeAuditLog("regeldeputate", created.id, "INSERT", null, {
      schulformCode: parsed.data.schulformCode,
      regeldeputat: parsed.data.regeldeputat,
    }, session.name);

    revalidatePath("/regeldeputate");

    return { success: true, message: `Regeldeputat "${parsed.data.schulformName}" (${parsed.data.regeldeputat} Std.) hinzugefuegt.` };
  } catch {
    return { error: "Speichern fehlgeschlagen. Bitte erneut versuchen." };
  }
}
