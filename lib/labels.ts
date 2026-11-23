/**
 * Field labels, and the value each one introduces.
 *
 * A form is full of them: Full Name, Email, Phone, Home Address. A label is
 * not sensitive - it is a fixed piece of text that says what kind of thing
 * is written under it. But a model reading a form can report the label as
 * though it were the value, and then the value underneath is left uncovered.
 *
 * So a finding whose quote is exactly one of these labels is not taken at face
 * value. It is read as a pointer, and the value it points at is what gets
 * covered. When the model reports the label and the value, both point at the
 * same place and the cover is the same cover.
 *
 * The values under the labels are also found without asking the model at all.
 * A form says what its fields hold, so the field is sensitive whatever a
 * small model happened to notice that day.
 */

const LABELS: Record<string, string> = {
  'full name': 'PERSON',
  'first name': 'PERSON',
  'last name': 'PERSON',
  'given name': 'PERSON',
  'family name': 'PERSON',
  'surname': 'PERSON',
  'maiden name': 'PERSON',
  'email': 'EMAIL',
  'email address': 'EMAIL',
  'contact email': 'EMAIL',
  'phone': 'PHONE',
  'phone number': 'PHONE',
  'telephone': 'PHONE',
  'telephone number': 'PHONE',
  'mobile': 'PHONE',
  'mobile number': 'PHONE',
  'home address': 'HOME_ADDRESS',
  'street address': 'HOME_ADDRESS',
  'mailing address': 'HOME_ADDRESS',
  'postal address': 'HOME_ADDRESS',
  'employer': 'EMPLOYER',
  'company name': 'EMPLOYER',
  'organisation name': 'EMPLOYER',
  'organization name': 'EMPLOYER',
  'api key': 'API_KEY',
  'access key': 'API_KEY',
  'secret key': 'API_KEY',
  'password': 'PASSWORD',
  'date of birth': 'DATE_OF_BIRTH',
  'dob': 'DATE_OF_BIRTH',
  'place of birth': 'LOCATION',
  'ip address': 'IP_ADDRESS',
  'mac address': 'MAC_ADDRESS',
  'account number': 'ACCOUNT_NUMBER',
  'card number': 'CREDIT_CARD',
  'credit card': 'CREDIT_CARD',
  'username': 'PERSON',
  'user name': 'PERSON',
};

/**
 * The kind of thing a label introduces, or null when the quote is not a
 * label. Only an exact label counts: a word that merely appears inside a
 * sentence is not a label.
 */
export function labelType(quote: string): string | null {
  const key = quote.trim().replace(/[\s:：\-]+$/g, '').toLowerCase();
  if (!key) return null;
  return LABELS[key] ?? null;
}

export interface LabelValue {
  start: number;
  end: number;
}

/**
 * The value a label introduces.
 *
 * Two layouts are covered. When the label sits at the start of a line with the
 * value after it - "Full Name: Amara Okonkwo" - the value is the rest of
 * that line. When the label is on a line of its own - "FULL NAME" above
 * "Amara Okonkwo" - the value is the line below it.
 *
 * Returns null when there is no value under the label.
 */
export function valueAfterLabel(
  text: string,
  start: number,
  end: number
): LabelValue | null {
  const lineEnd = text.indexOf('\n', end);
  const lineStop = lineEnd === -1 ? text.length : lineEnd;

  const rest = text.slice(end, lineStop);
  const lead = rest.match(/^[\s:：\-–—]*/);

  if (lead) {
    const valueStart = end + lead[0].length;
    const value = text.slice(valueStart, lineStop);
    if (value.trim()) return { start: valueStart, end: lineStop };
  }

  if (lineEnd === -1) return null;

  const nextStart = lineEnd + 1;
  const nextEnd = text.indexOf('\n', nextStart);
  const nextStop = nextEnd === -1 ? text.length : nextEnd;
  const next = text.slice(nextStart, nextStop);

  if (!next.trim()) return null;

  const offset = next.indexOf(next.trim());
  return {
    start: nextStart + offset,
    end: nextStart + offset + next.trim().length,
  };
}

/** A value written under a field label. */
export interface LabelledValue {
  type: string;
  start: number;
  end: number;
  quote: string;
}

/**
 * How long a line can be and still be a field value rather than a paragraph.
 *
 * A name, an address, a key: a line. A paragraph under a heading that
 * happens to read "Notes" is not one, and the headings that matter here are
 * not "Notes".
 */
const MAX_VALUE_LENGTH = 100;

/** How many lines below a label the value may be. */
const MAX_VALUE_DISTANCE = 2;

interface Line {
  text: string;
  start: number;
}

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  let start = 0;

  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text.charAt(i) === '\n') {
      lines.push({ text: text.slice(start, i).replace(/\r$/, ''), start });
      start = i + 1;
    }
  }

  return lines;
}

/**
 * The values written under the field labels in a piece of text.
 *
 * Two layouts are covered: "Full Name: Amara Okonkwo" on one line, and
 * "FULL NAME" on a line of its own with the value on the line below. A label
 * with no value under it, or with another label under it, gives nothing.
 */
export function findLabelValues(text: string): LabelledValue[] {
  const lines = splitLines(text);
  const values: LabelledValue[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // "Full Name: Amara Okonkwo"
    const inline = line.text.match(/^([A-Za-z][A-Za-z ]{1,30}):[ \t]*(.*)$/);

    if (inline) {
      const type = labelType(inline[1]);

      if (type) {
        const raw = inline[2];
        const value = raw.trim();

        if (value && value.length <= MAX_VALUE_LENGTH) {
          const offset =
            line.start + inline[0].length - raw.length + raw.indexOf(value);
          values.push({
            type,
            start: offset,
            end: offset + value.length,
            quote: value,
          });
        }

        continue;
      }
    }

    // A label on a line of its own, with the value on the line below.
    const type = labelType(line.text.trim());
    if (!type) continue;

    const value = findValueBelow(lines, i);
    if (!value) continue;

    values.push({
      type,
      start: value.start,
      end: value.end,
      quote: value.quote,
    });
  }

  return values;
}

function findValueBelow(
  lines: Line[],
  labelIndex: number
): LabelledValue | null {
  for (
    let distance = 1;
    distance <= MAX_VALUE_DISTANCE && labelIndex + distance < lines.length;
    distance++
  ) {
    const line = lines[labelIndex + distance];
    const trimmed = line.text.trim();

    if (!trimmed) continue;

    // Another label is not a value.
    if (labelType(trimmed)) return null;

    if (trimmed.length > MAX_VALUE_LENGTH) return null;

    const offset = line.start + line.text.indexOf(trimmed);

    return {
      type: '',
      start: offset,
      end: offset + trimmed.length,
      quote: trimmed,
    };
  }

  return null;
}
