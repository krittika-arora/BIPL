// Turns pasted text or an uploaded CSV/TXT file into a list of candidate email addresses.

const EMAIL_PATTERN = /^[^\s@,;<>"]+@[^\s@,;<>"]+\.[^\s@,;<>"]+$/;

function isValidEmail(value) {
  return value.length <= 254 && EMAIL_PATTERN.test(value);
}

// Splits one CSV line into cells, honouring double-quoted cells that contain commas.
function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',' || char === ';') {
      cells.push(cell);
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells.map((value) => value.trim());
}

// Pasted text: any mix of commas, semicolons, spaces and new lines between addresses.
function addressesFromText(text) {
  return text.split(/[\s,;]+/).filter(Boolean);
}

// Uploaded file: if the first row has an "email" column, only that column is used
// (so a name,email export works); otherwise every cell is treated as an address.
function addressesFromFile(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];

  const header = parseCsvLine(lines[0]).map((cell) => cell.toLowerCase());
  const emailColumn = header.findIndex((cell) => cell === 'email' || cell === 'email address');
  if (emailColumn >= 0) {
    return lines
      .slice(1)
      .map((line) => parseCsvLine(line)[emailColumn] || '')
      .filter(Boolean);
  }
  return lines.flatMap((line) => parseCsvLine(line)).flatMap(addressesFromText);
}

// Normalises and de-duplicates, keeping first-seen order and how often each address appeared.
function normaliseAddresses(rawAddresses) {
  const seen = new Map();
  for (const raw of rawAddresses) {
    const email = raw.trim().replace(/^<|>$/g, '').toLowerCase();
    if (!email) continue;
    seen.set(email, (seen.get(email) || 0) + 1);
  }
  return [...seen].map(([email, occurrences]) => ({ email, occurrences }));
}

module.exports = { isValidEmail, parseCsvLine, addressesFromText, addressesFromFile, normaliseAddresses };
