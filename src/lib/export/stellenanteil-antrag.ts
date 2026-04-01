/**
 * DOCX-Generierung fuer Antraege auf zusaetzliche Stellenanteile.
 * Vorlage: Schreiben an die Bezirksregierung Detmold.
 * QR-Code: Schule|Stellenart|Wert|Datum|Aktenzeichen
 */

import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import ImageModule from "docxtemplater-image-module-free";
import * as QRCode from "qrcode";
import * as fs from "fs";
import * as path from "path";

export interface StellenanteilAntragData {
  brBehoerde: string;
  brAnsprechpartner: string;
  brStrasse: string;
  brPlzOrt: string;
  absenderName: string;
  absenderTelefon: string;
  datum: string;
  betreffzeile: string;
  lehrerName: string;
  schuleName: string;
  schuleOrt: string;
  schulform: string;
  schuleStandort: string;
  schuljahr: string;
  antragText: string;
  stellenartBezeichnung: string;
  wert: string;
  aktenzeichen: string;
}

const templatePath = path.join(
  process.cwd(),
  "src/lib/export/vorlagen/stellenanteil-antrag-template.docx"
);
let cachedTemplate: Buffer | null = null;

function getTemplate(): Buffer {
  if (!cachedTemplate) {
    cachedTemplate = fs.readFileSync(templatePath);
  }
  return cachedTemplate;
}

export async function generateStellenanteilAntragDocx(
  data: StellenanteilAntragData
): Promise<Buffer> {
  const templateContent = getTemplate();

  // QR-Code: Schule|Stellenart|Wert|Datum|Aktenzeichen
  const qrContent = [
    data.schuleName,
    data.stellenartBezeichnung,
    data.wert,
    data.datum,
    data.aktenzeichen || "—",
  ].join("|");

  const qrPngBuffer = await QRCode.toBuffer(qrContent, {
    type: "png",
    width: 200,
    margin: 1,
    errorCorrectionLevel: "M",
  });

  const imageModule = new ImageModule({
    centered: false,
    getImage: () => qrPngBuffer,
    getSize: () => [60, 60],
  });

  const zip = new PizZip(templateContent);
  const doc = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    ...data,
    qrCode: "qr",
  });

  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  }) as Buffer;
}
