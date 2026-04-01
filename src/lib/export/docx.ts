/**
 * DOCX-Generierung fuer Vertragsnachtraege.
 * Nutzt docxtemplater mit der vorbereiteten Word-Vorlage.
 * Swiss QR-Code wird als PNG eingebettet (Vorname|Nachname|Personalnummer).
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

export interface NachtragData {
  /** Vollname im Format "Nachname Vorname" */
  lehrerVollname: string;
  personalnummer: string;
  /** Altes Deputat (z.B. "12") */
  altStunden: string;
  /** Neues Deputat (z.B. "14") — wird aktuell nicht im Template verwendet,
   *  da die Vorlage nur den bisherigen Stand dokumentiert */
  neuStunden: string;
  /** Regelstundendeputat (z.B. "25.5") */
  regelstunden: string;
  /** Vollstaendiger Schulname */
  schuleName: string;
  /** Schulform-Langbezeichnung (z.B. "Ev. priv. Gesamtschule") */
  schulformLang: string;
  /** Datum der Aenderung (DD.MM.YYYY) */
  aenderungsDatum: string;
}

/**
 * Zerlegt "Nachname Vorname" in { vorname, nachname }.
 * Bei "Nachname Vorname1 Vorname2" wird alles nach dem ersten Leerzeichen als Vorname behandelt.
 */
function splitName(vollname: string): { vorname: string; nachname: string } {
  const parts = vollname.trim().split(/\s+/);
  if (parts.length === 1) return { vorname: "", nachname: parts[0] };
  const [nachname, ...vornameParts] = parts;
  return { vorname: vornameParts.join(" "), nachname };
}

// Template wird einmal geladen und im Speicher gehalten
const templatePath = path.join(
  process.cwd(),
  "src/lib/export/vorlagen/nachtrag-template.docx"
);
let cachedTemplate: Buffer | null = null;

function getTemplate(): Buffer {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(templatePath);
  }
  return cachedTemplate;
}

export async function generateNachtragDocx(data: NachtragData): Promise<Buffer> {
  // 1. Template laden (gecacht)
  const templateContent = getTemplate();

  // 2. QR-Code generieren (Swiss QR Format: Vorname|Nachname|Personalnummer)
  const { vorname, nachname } = splitName(data.lehrerVollname);
  const qrContent = [vorname, nachname, data.personalnummer].join("|");
  const qrPngBuffer = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  // 3. Image-Module konfigurieren
  const imageModule = new ImageModule({
    centered: false,
    getImage: (_tagValue: string) => qrPngBuffer,
    getSize: () => [60, 60], // 60x60pt im Dokument
  });

  // 4. Template rendern
  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
  });

  // Anrede ableiten (Standard: "Herr/Frau" — muss ggf. angepasst werden)
  const anrede = "Herr/Frau";

  doc.render({
    lehrerVollname: `${vorname} ${nachname}`,
    vorname,
    nachname,
    anrede,
    personalnummer: data.personalnummer || "—",
    altStunden: data.altStunden,
    neuStunden: data.neuStunden,
    regelstunden: data.regelstunden,
    schuleName: data.schuleName,
    schulformLang: data.schulformLang,
    schulform: data.schulformLang,
    aenderungsDatum: data.aenderungsDatum,
    // Felder die aktuell nicht aus der DB kommen — Platzhalter
    geburtsdatum: "___.___.______",
    geburtsort: "_______________",
    adresse: "_______________________________________________",
    vertragstyp: "AV/AnV",
    vertragsdatum: "___.___.______",
    vonDatum: data.aenderungsDatum,
    bisDatum: "___.___.______",
    qrCode: "qr",
  });

  // 5. Output generieren
  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
