/**
 * Build a PDF of the Touround CRM user guide from USER_GUIDE.md.
 *
 * Pure Node + pdfkit (no browser/system dependencies). Parses a practical
 * subset of Markdown: headings, paragraphs, bullet/numbered lists, tables,
 * blockquotes, horizontal rules, and inline **bold** / *italic* / `code`.
 *
 * Usage: node scripts/build-user-guide-pdf.js
 */
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'USER_GUIDE.md');
const OUT = path.join(ROOT, 'USER_GUIDE.pdf');

const BRAND = '#0d9488';       // teal accent (matches app)
const INK = '#111827';         // near-black body text
const MUTED = '#6b7280';       // secondary text
const RULE = '#e5e7eb';        // light divider
const CODE_BG = '#f3f4f6';     // inline/code background

const PAGE_MARGIN = 56;

function readSource() {
  if (!fs.existsSync(SRC)) {
    console.error(`Source not found: ${SRC}`);
    process.exit(1);
  }
  return fs.readFileSync(SRC, 'utf8');
}

// --- Inline formatting -----------------------------------------------------
// Splits a line into styled runs: { text, bold, italic, code, link }.
function parseInline(text) {
  const runs = [];
  // Strip markdown links -> keep the label (PDF stays print-friendly).
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let last = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index) });
    if (m[2] !== undefined) runs.push({ text: m[2], bold: true });
    else if (m[3] !== undefined) runs.push({ text: m[3], italic: true });
    else if (m[4] !== undefined) runs.push({ text: m[4], code: true });
    last = re.lastIndex;
  }
  if (last < text.length) runs.push({ text: text.slice(last) });
  return runs.length ? runs : [{ text }];
}

// --- Block parsing ---------------------------------------------------------
function parseBlocks(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i];

    // Blank line
    if (line.trim() === '') { i++; continue; }

    // Horizontal rule
    if (/^---+\s*$/.test(line.trim())) { blocks.push({ type: 'hr' }); i++; continue; }

    // Heading
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) { blocks.push({ type: 'heading', level: h[1].length, text: h[2].trim() }); i++; continue; }

    // Blockquote (possibly multi-line)
    if (/^>\s?/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      blocks.push({ type: 'quote', text: quote.join(' ').trim() });
      continue;
    }

    // Table (header row + separator row of ---/:--)
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const toCells = (row) => row.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
      const header = toCells(line);
      i += 2; // skip header + separator
      const rows = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
        rows.push(toCells(lines[i]));
        i++;
      }
      blocks.push({ type: 'table', header, rows });
      continue;
    }

    // Lists (grouped runs of bullet or numbered items)
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      const ordered = !!numbered;
      const items = [];
      while (i < lines.length) {
        const b = /^\s*[-*]\s+(.*)$/.exec(lines[i]);
        const n = /^\s*(\d+)\.\s+(.*)$/.exec(lines[i]);
        if (ordered && n) items.push(n[2]);
        else if (!ordered && b) items.push(b[1]);
        else if (lines[i].trim() === '') { break; }
        else if (/^\s+\S/.test(lines[i]) && items.length) {
          // continuation line indented under the previous item
          items[items.length - 1] += ' ' + lines[i].trim();
        } else break;
        i++;
      }
      blocks.push({ type: 'list', ordered, items });
      continue;
    }

    // Paragraph (gather until blank / next block)
    const para = [line];
    i++;
    while (i < lines.length && lines[i].trim() !== '' &&
      !/^(#{1,6})\s/.test(lines[i]) && !/^>/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^---+\s*$/.test(lines[i].trim()) && !lines[i].includes('|')) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ type: 'paragraph', text: para.join(' ').trim() });
  }

  return blocks;
}

// --- Rendering -------------------------------------------------------------
function build() {
  const md = readSource();
  const blocks = parseBlocks(md);

  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
    info: {
      Title: 'Touround CRM — User Guide',
      Author: 'Touround',
      Subject: 'Business portal user guide',
    },
  });

  const stream = fs.createWriteStream(OUT);
  doc.pipe(stream);

  const contentWidth = doc.page.width - PAGE_MARGIN * 2;

  const F = {
    reg: 'Helvetica',
    bold: 'Helvetica-Bold',
    italic: 'Helvetica-Oblique',
    boldItalic: 'Helvetica-BoldOblique',
    mono: 'Courier',
  };

  function ensureSpace(h) {
    if (doc.y + h > doc.page.height - PAGE_MARGIN) doc.addPage();
  }

  // Render styled inline runs as one wrapped line of text.
  function renderInline(runs, opts = {}) {
    const { size = 10.5, color = INK, lineGap = 3, indent = 0, x = PAGE_MARGIN } = opts;
    const width = contentWidth - indent;
    doc.fontSize(size);
    runs.forEach((run, idx) => {
      let font = F.reg;
      let fill = color;
      if (run.code) { font = F.mono; fill = '#9d174d'; }
      else if (run.bold && run.italic) font = F.boldItalic;
      else if (run.bold) font = F.bold;
      else if (run.italic) font = F.italic;
      doc.font(font).fillColor(fill);
      const isLast = idx === runs.length - 1;
      doc.text(run.text, idx === 0 ? x + indent : undefined, idx === 0 ? doc.y : undefined, {
        width,
        continued: !isLast,
        lineGap,
      });
    });
    doc.fillColor(INK).font(F.reg);
  }

  blocks.forEach((block) => {
    switch (block.type) {
      case 'heading': {
        const map = {
          1: { size: 24, gapBefore: 0, gapAfter: 10, color: BRAND, rule: true },
          2: { size: 16, gapBefore: 16, gapAfter: 6, color: INK, rule: true },
          3: { size: 13, gapBefore: 12, gapAfter: 4, color: INK },
          4: { size: 11.5, gapBefore: 10, gapAfter: 3, color: BRAND },
        };
        const s = map[block.level] || map[4];
        ensureSpace(s.size + s.gapBefore + s.gapAfter + 8);
        doc.moveDown(0);
        if (s.gapBefore) doc.y += s.gapBefore;
        doc.font(F.bold).fontSize(s.size).fillColor(s.color)
          .text(block.text, PAGE_MARGIN, doc.y, { width: contentWidth });
        if (s.rule) {
          doc.moveTo(PAGE_MARGIN, doc.y + 3)
            .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 3)
            .lineWidth(block.level === 1 ? 1.5 : 0.75)
            .strokeColor(block.level === 1 ? BRAND : RULE)
            .stroke();
          doc.y += 6;
        }
        doc.y += s.gapAfter;
        doc.fillColor(INK).font(F.reg);
        break;
      }

      case 'paragraph': {
        ensureSpace(28);
        renderInline(parseInline(block.text), { size: 10.5, lineGap: 3 });
        doc.y += 8;
        break;
      }

      case 'quote': {
        ensureSpace(32);
        const startY = doc.y;
        const padX = 12;
        doc.save();
        // Draw text first to measure its height, then the accent bar.
        const textX = PAGE_MARGIN + padX + 6;
        doc.fontSize(10).font(F.italic).fillColor(MUTED);
        doc.text('', textX, startY + 4);
        renderInline(parseInline(block.text), { size: 10, color: MUTED, x: textX - PAGE_MARGIN + PAGE_MARGIN, indent: padX + 6 });
        const endY = doc.y;
        doc.restore();
        doc.save()
          .roundedRect(PAGE_MARGIN, startY, contentWidth, endY - startY + 8, 4)
          .fill('#f0fdfa');
        doc.restore();
        // Re-render text on top of the background box.
        doc.save();
        doc.fontSize(10).font(F.italic).fillColor('#115e59');
        doc.text(block.text.replace(/\*\*/g, '').replace(/\*/g, '').replace(/`/g, ''),
          textX, startY + 4, { width: contentWidth - padX * 2 - 6 });
        doc.restore();
        // accent bar
        doc.save().rect(PAGE_MARGIN, startY, 3, endY - startY + 8).fill(BRAND).restore();
        doc.y = endY + 12;
        doc.fillColor(INK).font(F.reg);
        break;
      }

      case 'list': {
        block.items.forEach((item, idx) => {
          ensureSpace(20);
          const marker = block.ordered ? `${idx + 1}.` : '•';
          doc.font(block.ordered ? F.bold : F.reg).fontSize(10.5).fillColor(BRAND);
          doc.text(marker, PAGE_MARGIN + 6, doc.y, { width: 20, continued: false });
          const markerBottom = doc.y;
          // place item text to the right of the marker, on the same baseline
          doc.y = markerBottom - doc.currentLineHeight();
          renderInline(parseInline(item), { size: 10.5, x: PAGE_MARGIN + 28, indent: 28 - 0, lineGap: 2 });
          doc.y += 4;
        });
        doc.y += 6;
        break;
      }

      case 'table': {
        const cols = block.header.length;
        const colW = contentWidth / cols;
        const cellPadX = 6;
        const cellPadY = 5;
        const fontSize = 9;

        const measureRow = (cells, bold) => {
          doc.font(bold ? F.bold : F.reg).fontSize(fontSize);
          let maxH = 0;
          cells.forEach((c) => {
            const h = doc.heightOfString(c || '', { width: colW - cellPadX * 2 });
            if (h > maxH) maxH = h;
          });
          return maxH + cellPadY * 2;
        };

        const drawRow = (cells, y, bold, bg) => {
          const h = measureRow(cells, bold);
          if (bg) doc.save().rect(PAGE_MARGIN, y, contentWidth, h).fill(bg).restore();
          cells.forEach((c, ci) => {
            const x = PAGE_MARGIN + ci * colW;
            doc.font(bold ? F.bold : F.reg).fontSize(fontSize).fillColor(bold ? '#fff' : INK);
            doc.text(c || '', x + cellPadX, y + cellPadY, { width: colW - cellPadX * 2 });
          });
          // cell borders
          doc.strokeColor(RULE).lineWidth(0.5);
          for (let ci = 0; ci <= cols; ci++) {
            const x = PAGE_MARGIN + ci * colW;
            doc.moveTo(x, y).lineTo(x, y + h).stroke();
          }
          doc.moveTo(PAGE_MARGIN, y + h).lineTo(PAGE_MARGIN + contentWidth, y + h).stroke();
          return y + h;
        };

        // header
        let y = doc.y + 2;
        ensureSpace(measureRow(block.header, true) + 10);
        y = doc.y;
        doc.strokeColor(RULE).lineWidth(0.5)
          .moveTo(PAGE_MARGIN, y).lineTo(PAGE_MARGIN + contentWidth, y).stroke();
        y = drawRow(block.header, y, true, BRAND);
        block.rows.forEach((row, ri) => {
          const h = measureRow(row, false);
          if (y + h > doc.page.height - PAGE_MARGIN) {
            doc.addPage();
            y = doc.y;
            y = drawRow(block.header, y, true, BRAND);
          }
          y = drawRow(row, y, false, ri % 2 === 1 ? '#f9fafb' : null);
        });
        doc.y = y + 10;
        doc.fillColor(INK).font(F.reg);
        break;
      }

      case 'hr': {
        ensureSpace(14);
        doc.moveTo(PAGE_MARGIN, doc.y + 2)
          .lineTo(doc.page.width - PAGE_MARGIN, doc.y + 2)
          .lineWidth(0.75).strokeColor(RULE).stroke();
        doc.y += 12;
        break;
      }

      default:
        break;
    }
  });

  // Footer page numbers.
  // Set the bottom margin to 0 while stamping footers so pdfkit does not treat
  // near-bottom text as an overflow and auto-insert extra blank pages.
  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(range.start + p);
    doc.page.margins.bottom = 0;
    const bottom = doc.page.height - 40;
    doc.font(F.reg).fontSize(8).fillColor(MUTED);
    doc.text('Touround CRM — User Guide', PAGE_MARGIN, bottom, {
      width: contentWidth, align: 'left', lineBreak: false,
    });
    doc.text(`Page ${p + 1} of ${range.count}`, PAGE_MARGIN, bottom, {
      width: contentWidth, align: 'right', lineBreak: false,
    });
  }

  doc.end();

  stream.on('finish', () => {
    const { size } = fs.statSync(OUT);
    console.log(`Wrote ${OUT} (${(size / 1024).toFixed(1)} KB, ${range.count} pages)`);
  });
}

build();
