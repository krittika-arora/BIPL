// Minimal RFC 4180 CSV writer.

// Spreadsheet apps execute cells starting with these characters as formulas
// (CSV injection), so such values get a leading apostrophe.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value) {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  if (/[",\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

// The BOM makes Excel open the file as UTF-8, so names with accents display correctly.
function toCsv(headers, rows) {
  const lines = [headers, ...rows].map((row) => row.map(escapeCell).join(','));
  return `﻿${lines.join('\r\n')}\r\n`;
}

function slugify(text) {
  return (
    String(text)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'export'
  );
}

module.exports = { escapeCell, toCsv, slugify };
