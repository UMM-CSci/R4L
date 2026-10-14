import { ParsedDescription } from './description-parser.service';

/**
 * Expands color allocations into separate backend requests. A plain list such
 * as "blue or red" remains one request with alternatives; allocation wording
 * such as "one in each color" becomes one request per allocation.
 */
export function expandColorAllocations(source: string, parsed: ParsedDescription): ParsedDescription[] {
  const total = Number(parsed.quantity);
  const colors = (parsed.color ?? '').split('|').map(color => color.trim()).filter(Boolean);
  if (!Number.isInteger(total) || total < 2 || colors.length === 0) return [parsed];

  if (/\bone\s+(?:in|of)\s+each\s+colou?r\b/i.test(source) && colors.length <= total) {
    const allocated = colors.map(color => ({ ...parsed, quantity: '1', color }));
    const remainder = total - colors.length;
    return remainder > 0 ? [...allocated, { ...parsed, quantity: String(remainder), color: undefined }] : allocated;
  }

  const minimum = /\bat\s+least\s+(\d+|one|two|three|four|five|six)\b/i.exec(source);
  if (minimum) {
    const allocatedQuantity = numericWord(minimum[1]);
    if (allocatedQuantity > 0 && allocatedQuantity < total) {
      return [
        { ...parsed, quantity: String(allocatedQuantity) },
        { ...parsed, quantity: String(total - allocatedQuantity), color: undefined }
      ];
    }
  }

  const chosenRemainder = new RegExp(
    `(?:-|,|\\()\\s*(\\d+|one|two|three|four|five|six)\\s+(${colors.map(escape).join('|')})`
    + '\\s*(?:&|and)\\s*(\\d+|one|two|three|four|five|six)\\s+colou?r\\s+of\\s+(?:your|their)\\s+choice',
    'i'
  ).exec(source);
  if (chosenRemainder) {
    const specifiedQuantity = numericWord(chosenRemainder[1]);
    const openQuantity = numericWord(chosenRemainder[3]);
    if (specifiedQuantity + openQuantity === total) {
      const canonicalColor = colors.find(color => color.toLowerCase() === chosenRemainder[2].toLowerCase())
        ?? chosenRemainder[2];
      return [
        { ...parsed, quantity: String(specifiedQuantity), color: canonicalColor },
        { ...parsed, quantity: String(openQuantity), color: undefined }
      ];
    }
  }

  return [parsed];
}

function numericWord(value: string): number {
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return /^\d+$/.test(value) ? Number(value) : words[value.toLowerCase()] ?? 0;
}

function escape(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
