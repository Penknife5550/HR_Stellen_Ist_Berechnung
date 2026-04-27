/**
 * CREDO Verwaltung – Handbuch Stellenistberechnung v1.0
 * Generiert ein Word-Dokument im CREDO Corporate Design (Verwaltung: Hellgrau)
 */

const docx = require('C:/Users/driesen.FES/AppData/Roaming/npm/node_modules/docx');
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
  ShadingType, VerticalAlign, PageNumber, PageBreak, LevelFormat,
  TableOfContents, ExternalHyperlink
} = docx;
const fs = require('fs');

// ─── CREDO Corporate Design Colors ──────────────────────────────────────────
const COLORS = {
  verwaltung:  'DADADA',  // Hellgrau – Verwaltung/Standard
  yellow:      'FBC900',  // Gymnasium
  green:       '6BAA24',  // Gesamtschule
  red:         'E2001A',  // GS Minderheide
  blue:        '009AC6',  // GS Haddenhausen
  darkGray:    '575756',  // Schulverein
  white:       'FFFFFF',
  lightBg:     'F5F5F5',  // Hellhintergrund für Infoboxen
  rowAlt:      'F9F9F9',  // Tabellenzeilen alternierend
  textDark:    '2C2C2C',  // Haupttext
  textGray:    '555555',  // Sekundärtext
  borderGray:  'CCCCCC',  // Rahmen
};

// ─── Page Dimensions (A4, 2.5cm margins) ───────────────────────────────────
// A4: 11906 x 16838 DXA; 2.5cm = 1417 DXA
const PAGE = {
  width:  11906,
  height: 16838,
  margin: { top: 1417, right: 1417, bottom: 1417, left: 1417 },
  contentWidth: 11906 - 2 * 1417, // = 9072 DXA
};

// ─── Helper: Standard border definition ─────────────────────────────────────
function border(color = COLORS.borderGray, size = 4) {
  return { style: BorderStyle.SINGLE, size, color };
}

function allBorders(color = COLORS.borderGray, size = 4) {
  const b = border(color, size);
  return { top: b, bottom: b, left: b, right: b };
}

// ─── Helper: Parse inline markdown (**bold**, `code`) ───────────────────────
function parseInline(text) {
  const runs = [];
  // Split on **bold**, *italic*, `code`
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g;
  let last = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      runs.push(new TextRun({ text: text.slice(last, match.index), font: 'Calibri', size: 22 }));
    }
    const inner = match[0];
    if (inner.startsWith('**')) {
      runs.push(new TextRun({ text: inner.slice(2, -2), font: 'Calibri', size: 22, bold: true }));
    } else if (inner.startsWith('*')) {
      runs.push(new TextRun({ text: inner.slice(1, -1), font: 'Calibri', size: 22, italics: true }));
    } else if (inner.startsWith('`')) {
      runs.push(new TextRun({ text: inner.slice(1, -1), font: 'Courier New', size: 20, color: '444444' }));
    }
    last = match.index + inner.length;
  }
  if (last < text.length) {
    runs.push(new TextRun({ text: text.slice(last), font: 'Calibri', size: 22 }));
  }
  return runs.length > 0 ? runs : [new TextRun({ text, font: 'Calibri', size: 22 })];
}

// ─── Screenshot Placeholder ──────────────────────────────────────────────────
function makeScreenshotBox(label) {
  const borderDef = border(COLORS.darkGray, 8);
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE.contentWidth, type: WidthType.DXA },
            shading: { fill: COLORS.lightBg, type: ShadingType.CLEAR },
            borders: { top: borderDef, bottom: borderDef, left: borderDef, right: borderDef },
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({ text: '📷 ' + label, font: 'Calibri', size: 20, color: COLORS.darkGray, italics: true })],
                spacing: { before: 100, after: 100 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── Info Box (Hinweis/Wichtig/Praxisbeispiel) ───────────────────────────────
function makeInfoBox(text, type = 'info') {
  const colors = {
    hinweis:        { bg: 'EBF3FB', border: '009AC6', label: 'Hinweis' },
    wichtig:        { bg: 'FFF8E1', border: 'FBC900', label: 'Wichtig' },
    praxisbeispiel: { bg: 'EFF7E6', border: '6BAA24', label: 'Praxisbeispiel' },
    warnung:        { bg: 'FDECEA', border: 'E2001A', label: 'Achtung' },
    info:           { bg: COLORS.lightBg, border: COLORS.borderGray, label: '' },
  };
  const cfg = colors[type] || colors.info;
  const borderDef = border(cfg.border, 8);
  const leftBorder = { style: BorderStyle.SINGLE, size: 16, color: cfg.border };
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [PAGE.contentWidth],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: PAGE.contentWidth, type: WidthType.DXA },
            shading: { fill: cfg.bg, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: leftBorder,
            },
            margins: { top: 120, bottom: 120, left: 240, right: 120 },
            children: [
              new Paragraph({
                children: parseInline(text),
                spacing: { before: 60, after: 60 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ─── CREDO-Linie (4 Farbsegmente) ───────────────────────────────────────────
function makeCredoLine() {
  const segW = Math.floor(PAGE.contentWidth / 4);
  const rem  = PAGE.contentWidth - segW * 4;
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [segW, segW, segW, segW + rem],
    rows: [
      new TableRow({
        children: [
          { color: COLORS.yellow },
          { color: COLORS.green },
          { color: COLORS.red },
          { color: COLORS.blue },
        ].map((seg, i) =>
          new TableCell({
            width: { size: i < 3 ? segW : segW + rem, type: WidthType.DXA },
            shading: { fill: seg.color, type: ShadingType.CLEAR },
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            children: [new Paragraph({ children: [new TextRun({ text: ' ', size: 12 })] })],
          })
        ),
      }),
    ],
  });
}

// ─── Cover Page ─────────────────────────────────────────────────────────────
function makeCoverPage() {
  return [
    // Oberer Bereich: Verwaltungsfarbe-Header
    new Table({
      width: { size: PAGE.contentWidth, type: WidthType.DXA },
      columnWidths: [PAGE.contentWidth],
      rows: [new TableRow({ children: [new TableCell({
        width: { size: PAGE.contentWidth, type: WidthType.DXA },
        shading: { fill: COLORS.verwaltung, type: ShadingType.CLEAR },
        borders: allBorders(COLORS.verwaltung),
        margins: { top: 400, bottom: 400, left: 400, right: 400 },
        children: [
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [
              new TextRun({ text: 'CREDO', font: 'Arial Black', size: 56, color: COLORS.textDark, bold: true }),
              new TextRun({ text: ' Verwaltung', font: 'Arial', size: 40, color: COLORS.textGray }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: 'Christlicher Schulverein Minden e.V.', font: 'Calibri', size: 22, color: COLORS.textGray })],
          }),
        ],
      })] }) ] }),

    new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 800, after: 0 } }),

    // Titel
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'Benutzerhandbuch', font: 'Arial Black', size: 52, color: COLORS.textDark, bold: true })],
      spacing: { before: 200, after: 0 },
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'Stellenistberechnung', font: 'Arial Black', size: 72, color: COLORS.textDark, bold: true })],
      spacing: { before: 0, after: 400 },
    }),

    // Untertitel
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'HR-Software für NRW-Ersatzschulen', font: 'Calibri', size: 28, color: COLORS.textGray, italics: true })],
      spacing: { before: 0, after: 200 },
    }),

    // Horizontale Linie
    new Paragraph({
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.verwaltung } },
      children: [new TextRun({ text: '' })],
      spacing: { before: 400, after: 400 },
    }),

    // Versionsinformation
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [
        new TextRun({ text: 'Version 1.0  |  April 2026', font: 'Calibri', size: 22, color: COLORS.textGray }),
      ],
      spacing: { before: 0, after: 200 },
    }),
    new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new TextRun({ text: 'Nur für interne Nutzung', font: 'Calibri', size: 20, color: COLORS.textGray, italics: true })],
      spacing: { before: 0, after: 1200 },
    }),

    // CREDO-Linie auf Deckblatt
    makeCredoLine(),

    // Seitenumbruch nach Deckblatt
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

// ─── Markdown → docx Paragraphs ────────────────────────────────────────────
function parseMarkdown(md) {
  const lines = md.split('\n');
  const elements = [];
  let i = 0;
  let inList = false;
  let listType = null; // 'bullet' or 'number'

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines (but end lists)
    if (trimmed === '') {
      inList = false;
      listType = null;
      i++;
      continue;
    }

    // Horizontal rule
    if (trimmed === '---' || trimmed === '***') {
      inList = false;
      elements.push(new Paragraph({
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderGray } },
        children: [new TextRun({ text: '' })],
        spacing: { before: 200, after: 200 },
      }));
      i++;
      continue;
    }

    // H1
    if (trimmed.startsWith('# ') && !trimmed.startsWith('## ')) {
      inList = false;
      const text = trimmed.slice(2);
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text, font: 'Arial Black', size: 36, bold: true, color: COLORS.textDark })],
        spacing: { before: 480, after: 240 },
        shading: { fill: COLORS.verwaltung, type: ShadingType.CLEAR },
        indent: { left: 200, right: 200 },
      }));
      i++;
      continue;
    }

    // H2
    if (trimmed.startsWith('## ') && !trimmed.startsWith('### ')) {
      inList = false;
      const text = trimmed.slice(3);
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text, font: 'Arial Black', size: 28, bold: true, color: COLORS.textDark })],
        spacing: { before: 360, after: 180 },
      }));
      i++;
      continue;
    }

    // H3/H4
    if (trimmed.startsWith('### ') || trimmed.startsWith('#### ')) {
      inList = false;
      const text = trimmed.replace(/^#{3,5}\s+/, '');
      elements.push(new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text, font: 'Arial Black', size: 24, bold: true, color: COLORS.textDark })],
        spacing: { before: 280, after: 140 },
      }));
      i++;
      continue;
    }

    // Screenshot placeholder
    const scrMatch = trimmed.match(/^\[SCREENSHOT_(\d+):\s*(.+?)\]$/);
    if (scrMatch) {
      inList = false;
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 120, after: 0 } }));
      elements.push(makeScreenshotBox(`Screenshot ${scrMatch[1]}: ${scrMatch[2]}`));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 120 } }));
      i++;
      continue;
    }

    // Table rows
    if (trimmed.startsWith('|')) {
      inList = false;
      // Collect all table lines
      const tableLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      // Parse table
      const rows = tableLines.filter(l => !l.match(/^\|[-\s|:]+\|$/));
      if (rows.length > 0) {
        const parsedRows = rows.map(row =>
          row.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1).map(c => c.trim())
        );
        const colCount = Math.max(...parsedRows.map(r => r.length));
        const colW = Math.floor(PAGE.contentWidth / colCount);
        const colWidths = Array(colCount).fill(colW);
        colWidths[colCount - 1] += PAGE.contentWidth - colW * colCount;

        const tableRows = parsedRows.map((row, rowIdx) => {
          const isHeader = rowIdx === 0;
          return new TableRow({
            children: row.map((cell, colIdx) =>
              new TableCell({
                width: { size: colWidths[colIdx], type: WidthType.DXA },
                shading: { fill: isHeader ? COLORS.verwaltung : (rowIdx % 2 === 0 ? COLORS.white : COLORS.rowAlt), type: ShadingType.CLEAR },
                borders: allBorders(COLORS.borderGray, 4),
                margins: { top: 80, bottom: 80, left: 140, right: 140 },
                children: [new Paragraph({
                  children: [new TextRun({
                    text: cell,
                    font: 'Calibri',
                    size: 20,
                    bold: isHeader,
                    color: isHeader ? COLORS.textDark : COLORS.textDark,
                  })],
                })],
              })
            ),
          });
        });

        elements.push(new Table({
          width: { size: PAGE.contentWidth, type: WidthType.DXA },
          columnWidths: colWidths,
          rows: tableRows,
        }));
        elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 160 } }));
      }
      continue;
    }

    // Numbered list
    const numberedMatch = trimmed.match(/^(\d+)\.\s+(.+)/);
    if (numberedMatch) {
      inList = true;
      listType = 'number';
      elements.push(new Paragraph({
        numbering: { reference: 'numbered', level: 0 },
        children: parseInline(numberedMatch[2]),
        spacing: { before: 60, after: 60 },
      }));
      i++;
      continue;
    }

    // Bullet list (- item or * item)
    const bulletMatch = trimmed.match(/^[-*]\s+(.+)/);
    if (bulletMatch) {
      inList = true;
      listType = 'bullet';
      elements.push(new Paragraph({
        numbering: { reference: 'bullets', level: 0 },
        children: parseInline(bulletMatch[1]),
        spacing: { before: 60, after: 60 },
      }));
      i++;
      continue;
    }

    // Detect info box types
    const isPraxis = trimmed.startsWith('**Praxisbeispiel:**') || trimmed.startsWith('**Praxis-Beispiel:**');
    const isHinweis = trimmed.startsWith('**Hinweis:**');
    const isWichtig = trimmed.startsWith('**Wichtig:**') || trimmed.startsWith('**WICHTIG:**');
    const isWarnung = trimmed.startsWith('**Warnung:**') || trimmed.startsWith('**Achtung:**');

    if (isPraxis) {
      inList = false;
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 80, after: 0 } }));
      elements.push(makeInfoBox(trimmed.replace(/\*\*/g, ''), 'praxisbeispiel'));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 80 } }));
      i++;
      continue;
    }
    if (isHinweis) {
      inList = false;
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 80, after: 0 } }));
      elements.push(makeInfoBox(trimmed.replace(/\*\*/g, ''), 'hinweis'));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 80 } }));
      i++;
      continue;
    }
    if (isWichtig) {
      inList = false;
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 80, after: 0 } }));
      elements.push(makeInfoBox(trimmed.replace(/\*\*/g, ''), 'wichtig'));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 80 } }));
      i++;
      continue;
    }
    if (isWarnung) {
      inList = false;
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 80, after: 0 } }));
      elements.push(makeInfoBox(trimmed.replace(/\*\*/g, ''), 'warnung'));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 80 } }));
      i++;
      continue;
    }

    // Code block
    if (trimmed.startsWith('```')) {
      inList = false;
      i++; // skip opening ```
      const codeLines = [];
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      const code = codeLines.join('\n');
      elements.push(new Table({
        width: { size: PAGE.contentWidth, type: WidthType.DXA },
        columnWidths: [PAGE.contentWidth],
        rows: [new TableRow({ children: [new TableCell({
          width: { size: PAGE.contentWidth, type: WidthType.DXA },
          shading: { fill: '2C2C2C', type: ShadingType.CLEAR },
          borders: allBorders('444444', 4),
          margins: { top: 120, bottom: 120, left: 200, right: 200 },
          children: codeLines.map(cl => new Paragraph({
            children: [new TextRun({ text: cl, font: 'Courier New', size: 18, color: 'E8E8E8' })],
            spacing: { before: 0, after: 0 },
          })),
        })] }) ],
      }));
      elements.push(new Paragraph({ children: [new TextRun({ text: '' })], spacing: { before: 0, after: 120 } }));
      continue;
    }

    // Regular paragraph
    inList = false;
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      // Italic paragraph (like footer notes)
      elements.push(new Paragraph({
        children: [new TextRun({ text: trimmed.replace(/^\*|\*$/g, ''), font: 'Calibri', size: 20, italics: true, color: COLORS.textGray })],
        spacing: { before: 80, after: 80 },
      }));
    } else {
      elements.push(new Paragraph({
        children: parseInline(trimmed),
        spacing: { before: 100, after: 100 },
      }));
    }
    i++;
  }

  return elements;
}

// ─── Main Document Assembly ──────────────────────────────────────────────────
async function generateDocument() {
  console.log('Lese Handbuch-Markdown...');
  const mdContent = fs.readFileSync(
    require('path').join(__dirname, 'handbuch_draft.md'),
    'utf8'
  );

  console.log('Parse Markdown-Inhalt...');
  // Skip title area (first ~10 lines) and start from actual content
  const lines = mdContent.split('\n');
  // Find start of actual content (after the header metadata)
  let startLine = 0;
  for (let i = 0; i < Math.min(15, lines.length); i++) {
    if (lines[i].startsWith('## Inhaltsverzeichnis')) {
      startLine = i + 20; // skip TOC section
      break;
    }
  }
  const contentMd = lines.slice(startLine).join('\n');
  const bodyElements = parseMarkdown(contentMd);

  console.log(`Geparst: ${bodyElements.length} Elemente`);
  console.log('Erstelle Word-Dokument...');

  const doc = new Document({
    numbering: {
      config: [
        {
          reference: 'bullets',
          levels: [{
            level: 0, format: LevelFormat.BULLET, text: '\u2022',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
        {
          reference: 'numbered',
          levels: [{
            level: 0, format: LevelFormat.DECIMAL, text: '%1.',
            alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } },
          }],
        },
      ],
    },
    styles: {
      default: {
        document: { run: { font: 'Calibri', size: 22 } },
      },
      paragraphStyles: [
        {
          id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 36, bold: true, font: 'Arial Black', color: COLORS.textDark },
          paragraph: { spacing: { before: 480, after: 240 }, outlineLevel: 0 },
        },
        {
          id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 28, bold: true, font: 'Arial Black', color: COLORS.textDark },
          paragraph: { spacing: { before: 360, after: 180 }, outlineLevel: 1 },
        },
        {
          id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
          run: { size: 24, bold: true, font: 'Arial Black', color: COLORS.textDark },
          paragraph: { spacing: { before: 280, after: 140 }, outlineLevel: 2 },
        },
      ],
    },
    sections: [
      // ── Section 1: Cover Page ─────────────────────────────────────────────
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
        },
        children: makeCoverPage(),
      },
      // ── Section 2: Table of Contents ─────────────────────────────────────
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
        },
        headers: {
          default: new Header({
            children: [makeHeaderContent()],
          }),
        },
        footers: {
          default: new Footer({
            children: [makeFooterContent()],
          }),
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            children: [new TextRun({ text: 'Inhaltsverzeichnis', font: 'Arial Black', size: 36, bold: true, color: COLORS.textDark })],
            spacing: { before: 0, after: 240 },
          }),
          new TableOfContents('Inhaltsverzeichnis', {
            hyperlink: true,
            headingStyleRange: '1-3',
          }),
          new Paragraph({ children: [new PageBreak()] }),
        ],
      },
      // ── Section 3: Handbuch-Inhalt ────────────────────────────────────────
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: PAGE.margin,
          },
        },
        headers: {
          default: new Header({
            children: [makeHeaderContent()],
          }),
        },
        footers: {
          default: new Footer({
            children: [makeFooterContent()],
          }),
        },
        children: bodyElements,
      },
    ],
  });

  console.log('Packe Dokument...');
  const buffer = await Packer.toBuffer(doc);
  const outPath = require('path').join(__dirname, 'Handbuch_Stellenistberechnung_v1.0.docx');
  fs.writeFileSync(outPath, buffer);
  console.log(`\n✅ Dokument erstellt: ${outPath}`);
  console.log(`   Größe: ${(buffer.length / 1024).toFixed(1)} KB`);
}

// ─── Header Content ──────────────────────────────────────────────────────────
function makeHeaderContent() {
  return new Table({
    width: { size: PAGE.contentWidth, type: WidthType.DXA },
    columnWidths: [Math.floor(PAGE.contentWidth * 0.7), Math.ceil(PAGE.contentWidth * 0.3)],
    rows: [new TableRow({
      children: [
        new TableCell({
          width: { size: Math.floor(PAGE.contentWidth * 0.7), type: WidthType.DXA },
          shading: { fill: COLORS.verwaltung, type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.borderGray },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            children: [new TextRun({ text: 'CREDO Gruppe  |  Stellenistberechnung Handbuch', font: 'Calibri', size: 18, color: COLORS.textGray })],
          })],
        }),
        new TableCell({
          width: { size: Math.ceil(PAGE.contentWidth * 0.3), type: WidthType.DXA },
          shading: { fill: COLORS.verwaltung, type: ShadingType.CLEAR },
          borders: {
            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            bottom: { style: BorderStyle.SINGLE, size: 6, color: COLORS.borderGray },
            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'Version 1.0  |  April 2026', font: 'Calibri', size: 18, color: COLORS.textGray })],
          })],
        }),
      ],
    })],
  });
}

// ─── Footer Content ──────────────────────────────────────────────────────────
function makeFooterContent() {
  return new Paragraph({
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: COLORS.borderGray } },
    tabStops: [{ type: docx.TabStopType.RIGHT, position: PAGE.contentWidth }],
    children: [
      new TextRun({ text: 'Seite ', font: 'Calibri', size: 18, color: COLORS.textGray }),
      new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: COLORS.textGray }),
      new TextRun({ text: '\t', font: 'Calibri', size: 18 }),
      new TextRun({ text: 'Vertraulich \u2013 nur f\u00fcr interne Nutzung', font: 'Calibri', size: 18, color: COLORS.textGray, italics: true }),
    ],
    spacing: { before: 120 },
  });
}

// ─── Run ────────────────────────────────────────────────────────────────────
generateDocument().catch(err => {
  console.error('FEHLER:', err.message);
  console.error(err.stack);
  process.exit(1);
});
