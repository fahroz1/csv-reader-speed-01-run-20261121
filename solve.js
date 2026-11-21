// Fast drop-in for csv-reader 1.0.0 (make.fun csv-reader-speed-01).
// Same answers as the reference on every input, faster: bulk delimiter
// scans (sticky regexes / indexOf) and slice()/split() instead of one
// character at a time. A record with no quoted field and no stray CR
// is split in one native call.
// Pure: no clock, no randomness, no locale, nothing kept from one call
// to the next.

const COMMA = 0; // field ended at a comma
const BREAK = 1; // field ended at a line break
const END = 2; // field ended at the end of the text
const DELIM_RE = /[,\r\n]/g; // next field delimiter (unquoted scan)
const NL_RE = /[\r\n]/g; // next line break (quoted-field check)
const REC_RE = /["\r\n]/g; // next quote or line break (record fast path)

/** csv-reader 1.0.0's answer for one case's input {text, header}. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xFEFF ? 1 : 0;
  let line = 1;
  const len = text.length;

  // The record being read: the line it starts on and the index in rows
  // it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // Field result slots (avoids one object allocation per field).
  let fValue = '';
  let fEnded = COMMA;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads an unquoted field starting at pos, appending to `base`.
  // Sets fValue/fEnded/fAdded. A CR not followed by LF is dropped
  // (stray_cr); the field is built from slices, segment by segment.
  // One sticky regex finds the next delimiter in a single native scan.
  function readUnquoted(base) {
    let value = base;
    let added = 0;
    for (;;) {
      DELIM_RE.lastIndex = pos;
      if (!DELIM_RE.test(text)) {
        // No delimiter left: the field runs to the end (no CR after
        // pos either, or the regex would have found it).
        added += len - pos;
        if (len > pos) value += text.slice(pos, len);
        pos = len;
        fValue = value; fEnded = END; fAdded = added;
        return;
      }
      const idx = DELIM_RE.lastIndex - 1;
      const cc = text.charCodeAt(idx);
      if (cc === 44) { // ','
        added += idx - pos;
        if (idx > pos) value += text.slice(pos, idx);
        pos = idx + 1;
        fValue = value; fEnded = COMMA; fAdded = added;
        return;
      }
      if (cc === 10) { // LF (a CR before it would have matched first)
        added += idx - pos;
        if (idx > pos) value += text.slice(pos, idx);
        pos = idx + 1;
        line += 1;
        fValue = value; fEnded = BREAK; fAdded = added;
        return;
      }
      // CR.
      if (text.charCodeAt(idx + 1) === 10) { // CRLF
        added += idx - pos;
        if (idx > pos) value += text.slice(pos, idx);
        pos = idx + 2;
        line += 1;
        fValue = value; fEnded = BREAK; fAdded = added;
        return;
      }
      // Stray CR: drop it (error) and keep reading the field.
      error('stray_cr');
      added += idx - pos;
      if (idx > pos) value += text.slice(pos, idx);
      pos = idx + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos.
  // Sets fValue/fEnded/fAdded (fAdded counts junk characters only).
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // Find the closing quote, skipping doubled quotes.
    let q = pos + 1;
    let doubled = false;
    for (;;) {
      q = text.indexOf('"', q);
      if (q === -1) {
        // The quote never closes: it is a literal character, and the
        // text after it is read again as unquoted.
        pos = open + 1;
        line = openLine;
        error('unterminated_quote');
        readUnquoted('"');
        return;
      }
      if (text.charCodeAt(q + 1) === 34) { doubled = true; q += 2; continue; }
      break;
    }
    // q is the closing quote; the content is [open+1, q).
    NL_RE.lastIndex = open + 1;
    const hasNL = NL_RE.test(text) && NL_RE.lastIndex - 1 < q;
    let value;
    if (!doubled && !hasNL) {
      // No doubled quotes and no line break inside: one slice.
      value = text.slice(open + 1, q);
    } else {
      // Cold path: fold doubled quotes and read CRLF / lone CR as LF,
      // counting every line break inside the quotes.
      let v = '';
      for (let i = open + 1; i < q; i++) {
        const ch = text[i];
        if (ch === '"') { v += '"'; i++; continue; }
        if (ch === '\r') {
          v += '\n';
          line += 1;
          if (text[i + 1] === '\n') i++;
          continue;
        }
        if (ch === '\n') line += 1;
        v += ch;
      }
      value = v;
    }
    pos = q + 1;
    if (pos >= len) { fValue = value; fEnded = END; fAdded = 0; return; }
    const cc = text.charCodeAt(pos);
    if (cc === 44) { pos += 1; fValue = value; fEnded = COMMA; fAdded = 0; return; }
    if (cc === 10) { pos += 1; line += 1; fValue = value; fEnded = BREAK; fAdded = 0; return; }
    if (cc === 13 && text.charCodeAt(pos + 1) === 10) {
      pos += 2; line += 1; fValue = value; fEnded = BREAK; fAdded = 0; return;
    }
    // What follows the closing quote is appended as it stands, up to
    // the next comma or line break.
    readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
  }

  while (true) {
    // Lines with no characters are no records.
    while (pos < len) {
      const ch = text.charCodeAt(pos);
      if (ch === 10) { pos += 1; line += 1; }
      else if (ch === 13 && text.charCodeAt(pos + 1) === 10) { pos += 2; line += 1; }
      else break;
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    let fields;
    let fast = false;
    // Fast path: a record with no quoted field and no stray CR. The
    // first quote, CR or LF decides it: a quote or a stray CR falls
    // through to the field loop; a line break (or the end of the text)
    // ends a record whose fields are one split(',') call.
    REC_RE.lastIndex = pos;
    if (REC_RE.test(text)) {
      const idx = REC_RE.lastIndex - 1;
      const cc = text.charCodeAt(idx);
      if (cc === 10) { // LF
        fields = text.slice(pos, idx).split(',');
        pos = idx + 1;
        line += 1;
        fast = true;
      } else if (cc === 13 && text.charCodeAt(idx + 1) === 10) { // CRLF
        fields = text.slice(pos, idx).split(',');
        pos = idx + 2;
        line += 1;
        fast = true;
      }
    } else {
      // No quote, CR or LF left: the last record runs to the end.
      fields = text.slice(pos).split(',');
      pos = len;
      fast = true;
    }
    if (!fast) {
      fields = [];
      let quoted = false;
      do {
        quoted = text.charCodeAt(pos) === 34;
        if (quoted) readQuoted(); else readUnquoted('');
        fields.push(fValue);
      } while (fEnded === COMMA);

      // A line that held only stray CRs is left with no characters:
      // no record (its stray_cr errors stay).
      if (fields.length === 1 && fields[0] === '' && !quoted) continue;
    }

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
