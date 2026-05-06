"use server";

import { revalidatePath } from "next/cache";
import { requireWriteAccess } from "@/lib/auth/permissions";
import { upsertNachtragStatus } from "@/lib/db/queries";
import { writeAuditLog } from "@/lib/audit";

type TupelInput = {
  lehrerId: number;
  syAlt: number;
  termAlt: number;
  syNeu: number;
  termNeu: number;
};

function parseTupel(formData: FormData): TupelInput | { error: string } {
  const fields = ["lehrerId", "syAlt", "termAlt", "syNeu", "termNeu"] as const;
  const out: Partial<TupelInput> = {};
  for (const f of fields) {
    const n = Number(formData.get(f));
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return { error: `Eingabe ungueltig — bitte Seite neu laden.` };
    }
    out[f] = n;
  }
  return out as TupelInput;
}

export async function markiereAlsVersendetAction(formData: FormData) {
  const session = await requireWriteAccess();
  const parsed = parseTupel(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    await upsertNachtragStatus({ ...parsed, status: "versendet" });
    await writeAuditLog(
      "deputat_nachtraege",
      parsed.lehrerId,
      "UPDATE",
      null,
      { status: "versendet", ...parsed },
      session.name,
    );
  } catch (err) {
    console.error("markiereAlsVersendetAction", err);
    return { error: "Speichern fehlgeschlagen — bitte erneut versuchen." };
  }

  revalidatePath("/nachtraege");
  return { success: true, message: "Als versendet markiert." };
}

export async function resetNachtragStatusAction(formData: FormData) {
  const session = await requireWriteAccess();
  const parsed = parseTupel(formData);
  if ("error" in parsed) return { error: parsed.error };

  try {
    await upsertNachtragStatus({ ...parsed, status: null });
    await writeAuditLog(
      "deputat_nachtraege",
      parsed.lehrerId,
      "DELETE",
      null,
      { status: null, ...parsed },
      session.name,
    );
  } catch (err) {
    console.error("resetNachtragStatusAction", err);
    return { error: "Zuruecksetzen fehlgeschlagen — bitte erneut versuchen." };
  }

  revalidatePath("/nachtraege");
  return { success: true, message: "Status zurueckgesetzt." };
}
