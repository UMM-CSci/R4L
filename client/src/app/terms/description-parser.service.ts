import { Injectable } from '@angular/core';
import { Terms } from './terms';

type Field = keyof Terms;

interface Match {
  field: Field;
  value: string;
  start: number;
  end: number;
}

export interface ParsedDescription {
  quantity?: string;
  packageSize?: string;
  item?: string;
  brand?: string;
  color?: string;
  size?: string;
  type?: string;
  material?: string;
  notes: string[];
}

/** Extracts vocabulary terms without assigning the same input text to two fields. */
@Injectable({ providedIn: 'root' })
export class DescriptionParserService {
  private readonly fields: Field[] = ['item', 'brand', 'color', 'size', 'type', 'material'];
  private readonly quantityWords: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    eleven: 11,
    twelve: 12,
    thirteen: 13,
    fourteen: 14,
    fifteen: 15,
    sixteen: 16,
    seventeen: 17,
    eighteen: 18,
    nineteen: 19,
    twenty: 20
  };

  parse(input: string, terms: Terms, brandItemHints: Record<string, string[]> = {}): ParsedDescription {
    const result: ParsedDescription = { notes: [] };
    if (!input.trim()) return result;

    const reserved = new Array<boolean>(input.length).fill(false);
    const reserve = (start: number, end: number) => {
      for (let i = start; i < end; i++) reserved[i] = true;
    };

    // Parenthetical notes are excluded from term matching, but count-like parentheses
    // remain available to the package-size expression below.
    for (const match of input.matchAll(/\(([^)]+)\)/g)) {
      const fragment = match[1].trim();
      if (/^\d+\s*(?:count|ct\.?|pk\.?|pack\.?)?$/i.test(fragment)) continue;
      if (!fragment || this.matchesAnyTerm(fragment, terms)) continue;
      result.notes.push(fragment);
      reserve(match.index, match.index + match[0].length);
    }

    // An explicit count later in the phrase takes precedence over a leading
    // quantity such as "1 pack". Only treat "N pack" as package size when no
    // clearer "N count" or "pack of N" expression exists.
    const count = /(\d+)\s*-?\s*(?:count|ct)\b/i.exec(input)
      ?? /(?:pack|box|set|container|bag)\s+of\s+(\d+)\b/i.exec(input)
      ?? /(\d+)\s*-?\s*(?:pk|pack)\b/i.exec(input);
    if (count) {
      result.packageSize = count[1];
      reserve(count.index, count.index + count[0].length);
    }

    const quantity = /^(\s*)(\d+)\b(?:\s+(?:box(?:es)?|pack(?:s)?|set(?:s)?|bag(?:s)?|roll(?:s)?|ream(?:s)?|sheet(?:s)?|piece(?:s)?|pair(?:s)?))?/i.exec(input);
    const quantityNumberEnd = quantity ? quantity.index + quantity[1].length + quantity[2].length : 0;
    if (quantity && !reserved.slice(quantity.index, quantityNumberEnd).some(Boolean)) {
      result.quantity = quantity[2];
      reserve(quantity.index, quantity.index + quantity[0].length);
    } else {
      const words = Object.keys(this.quantityWords).join('|');
      const wordQuantity = new RegExp(
        `^(\\s*)(${words})\\b(?:\\s+(?:box(?:es)?|pack(?:s)?|set(?:s)?|bag(?:s)?|roll(?:s)?|ream(?:s)?|sheet(?:s)?|piece(?:s)?|pair(?:s)?))?`,
        'i'
      ).exec(input);
      if (wordQuantity) {
        result.quantity = String(this.quantityWords[wordQuantity[2].toLowerCase()]);
        reserve(wordQuantity.index, wordQuantity.index + wordQuantity[0].length);
      }
    }

    const candidates: Match[] = [];
    for (const field of this.fields) {
      for (const value of terms[field]) {
        if (!value?.trim()) continue;
        for (const alias of this.aliases(value)) {
          const expression = new RegExp(`(?<![\\p{L}\\p{N}])${this.escape(alias).replace(/ /g, '[\\s-]+')}(?![\\p{L}\\p{N}])`, 'giu');
          for (const match of input.matchAll(expression)) {
            candidates.push({ field, value, start: match.index, end: match.index + match[0].length });
          }
        }
      }
    }

    // Longer phrases win, then the complete item name wins equal-span collisions.
    candidates.sort((a, b) =>
      (b.end - b.start) - (a.end - a.start)
      || this.fields.indexOf(a.field) - this.fields.indexOf(b.field)
      || a.start - b.start);

    const chosen: Match[] = [];
    for (const candidate of candidates) {
      if (reserved.slice(candidate.start, candidate.end).some(Boolean)) continue;
      chosen.push(candidate);
      reserve(candidate.start, candidate.end);
    }

    for (const field of this.fields) {
      const matches = chosen.filter(match => match.field === field).sort((a, b) => a.start - b.start);
      const values = matches.filter((match, index) =>
        matches.findIndex(other => other.value.toLowerCase() === match.value.toLowerCase()) === index);
      if (!values.length) continue;
      if (field === 'item' || field === 'brand') {
        result[field] = values[0].value;
      } else {
        // Only alternatives joined locally by "or" become anyOf. The form stores
        // other attributes as a single exactly value, so don't silently create
        // comma-separated values that submitForm would discard.
        const alternatives = values.every((value, index) => index === 0
          || /^\s*(?:,\s*)?or\s*$/i.test(input.slice(values[index - 1].end, value.start)));
        result[field] = values.map(value => value.value).join(alternatives ? ' | ' : ' and ');
      }
    }

    if (!result.item && result.brand) {
      const hints = brandItemHints[result.brand.toLowerCase()] ?? [];
      for (const hint of hints) {
        const item = terms.item.find(value => this.aliases(value).includes(hint));
        if (item) {
          result.item = item;
          break;
        }
      }
    }
    return result;
  }

  private matchesAnyTerm(fragment: string, terms: Terms): boolean {
    return this.fields.some(field => terms[field].some(term =>
      this.aliases(term).some(alias => new RegExp(`(?<![\\p{L}\\p{N}])${this.escape(alias)}(?![\\p{L}\\p{N}])`, 'iu').test(fragment))));
  }

  private aliases(term: string): string[] {
    const lower = term.trim().toLowerCase();
    const forms = new Set([lower]);
    if (lower.endsWith('ies')) forms.add(lower.slice(0, -3) + 'y');
    else if (lower.endsWith('es') && /(?:ch|sh|x|z)es$/.test(lower)) forms.add(lower.slice(0, -2));
    else if (lower.endsWith('s') && !lower.endsWith('ss')) forms.add(lower.slice(0, -1));
    else if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) forms.add(lower.slice(0, -1) + 'ies');
    else if (/(?:ch|sh|x|z|s)$/.test(lower)) forms.add(lower + 'es');
    else forms.add(lower + 's');
    return [...forms];
  }

  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
