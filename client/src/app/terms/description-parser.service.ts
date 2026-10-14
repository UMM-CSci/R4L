import { Injectable } from '@angular/core';
import { Terms } from './terms';
import { itemPackageMode, TERM_ALIASES } from './term-standard';

type Field = 'item' | 'brand' | 'color' | 'size' | 'type' | 'material';

/**
 * Represents a match found in the input string, including the field it corresponds to,
 * the matched value, and its start and end positions.
 */
interface Match {
  field: Field;
  value: string;
  start: number;
  end: number;
}

/**
 * Represents a match found in the input string, including the field it corresponds to,
 * the matched value, and its start and end positions.
 */
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

  /** The description names packages but does not say how many items each package contains. */
  incompletePackage?: boolean;
  /** A numeric range/choice was found and needs an explicit user decision. */
  countChoice?: string;
  /** Brand followed by “preferred”; caller must ask whether it is required. */
  preferenceBrand?: string;
}

/**
 * Service responsible for parsing item descriptions and extracting structured information.
 * How it works (new priority system):
 * 1. Identifies and reserves parenthetical notes.
 * 2. Extracts package size and quantity information.
 * 3. Matches known terms against the input string while avoiding overlaps.
 * 4. Populates the ParsedDescription object with the extracted information.
 * 5. Returns the fully populated ParsedDescription object.
 *
 * Example usage:
 * const parsed = descriptionParserService.parse("2 3-prong red 2 pocket folders", terms);
 * "2 3-prong red 2 pocket folders"
 * ^~ Quantity
 *     ^~~~~ Item    +     ^~~~~ Item
 *            ^~~ Color
 *                ^~~~~~~~~ Type
 */

@Injectable({ providedIn: 'root' })
export class DescriptionParserService {
  private readonly fields: Field[] = ['item', 'brand', 'color', 'size', 'type', 'material'];

  // Mapping of number words to their numeric values.
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

  /**
   * Parses a description string and extracts structured information based on the provided terms.
   * @param input The description string to parse.
   * @param terms The set of terms to match against.
   * @param brandItemHints Optional hints for brand-item associations.
   * @returns A ParsedDescription object containing the extracted information.
   */
  parse(input: string, terms: Terms, brandItemHints: Record<string, string[]> = {}): ParsedDescription {
    const result: ParsedDescription = { notes: [] }; // Initialize the result object with an empty notes array.
    if (!input.trim()) return result; // Return early if the input is empty or only contains whitespace.

    // Array to keep track of reserved character positions in the input string.
    // Characters marked as reserved will not be considered for term matching.
    const reserved = new Array<boolean>(input.length).fill(false);
    let packageQuantity: string | undefined;
    const flexiblePreferenceSpans: Array<{ start: number; end: number }> = [];

    // Function to mark a range of characters as reserved.
    // This helps prevent overlapping matches for different terms.
    const reserve = (start: number, end: number) => {
      for (let i = start; i < end; i++) reserved[i] = true;
    };

    // Parenthetical notes are excluded from term matching, but count-like parentheses
    // remain available to the package-size expression below.
    // For example, "(red)" would be treated as a note unless it matches a known term.
    for (const match of input.matchAll(/\(([^)]+)\)/g)) {
      const fragment = match[1].trim();

      // Skip empty fragments.
      if (!fragment) continue;

      // Skip fragments that look like package-size expressions or match known terms.
      if (/^\d+\s*(?:count|ct\.?|pk\.?|pack\.?)?$/i.test(fragment)) continue;

      // A phrase such as "preferably black but others are okay" describes a
      // preference, not a required attribute. Keep the complete wording as a
      // note and prevent recognized terms inside it from becoming constraints.
      if (/\b(?:preferably|prefer|preferred)\b/i.test(fragment)
        && /\b(?:others?|any)\b/i.test(fragment)
        && /\b(?:ok(?:ay)?|fine|acceptable|allowed)\b/i.test(fragment)) {
        result.notes.push(fragment);
        flexiblePreferenceSpans.push({ start: match.index, end: match.index + match[0].length });
        continue;
      }

      if (/\bpreferred\b/i.test(fragment)) {
        result.notes.push(fragment);
        continue;
      }

      // Skip fragments that match any known term.
      if (!fragment || this.matchesAnyTerm(fragment, terms)) continue;

      // If the fragment passes the above checks, it is considered a note.
      result.notes.push(fragment);
      reserve(match.index, match.index + match[0].length);
    }

    // Normalize measurements by pattern so numeric sizes do not require one
    // alias entry per possible value.
    const dimension = /(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|["”″])\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:inches|inch|in\.?|["”″])/i.exec(input);
    if (dimension) {
      result.size = `${dimension[1]} in x ${dimension[2]} in`;
      reserve(dimension.index, dimension.index + dimension[0].length);
    } else {
      const measurement = /(\d+(?:\.\d+)?)\s*(ounces?|oz\.?|inches|inch|in\.?|["”″])/i.exec(input);
      if (measurement) {
        const unit = /^(?:ounces?|oz\.?)$/i.test(measurement[2]) ? 'oz' : 'in';
        result.size = `${measurement[1]} ${unit}`;
        reserve(measurement.index, measurement.index + measurement[0].length);
      }
    }

    /**
     * Extracts the package size from the input string, either as a numeric count or a word-based count.
     * Numeric counts take precedence over word-based counts.
     * Reserves the corresponding characters in the input string to prevent overlapping matches.
     * For example, "1 count" -> result.packageSize = "1"
     *              "2 packs of 6" -> result.packageSize = "6" & result.quantity = "2"
     */
    const countWords = Object.keys(this.quantityWords).join('|');
    const count = /(\d+)\s*-?\s*(?:count|ct)\b/i.exec(input)
      ?? /(?:pack(?:s)?|box(?:es)?|set(?:s)?|container(?:s)?|bag(?:s)?)\s+of\s+(\d+)\b/i.exec(input)
      ?? /(?:pack(?:s)?|box(?:es)?|set(?:s)?|container(?:s)?|bag(?:s)?)\s+(\d+)\b/i.exec(input)
      ?? /(\d+)\s*-?\s*(?:pk|pack)\b/i.exec(input);

    // If a numeric count is found, it takes precedence as the package size.
    if (count) {
      result.packageSize = count[1];
      reserve(count.index, count.index + count[0].length);
    } else { // No numeric count found, check for a word-based count.
      const wordCount = new RegExp(`\\b(${countWords})\\s*-?\\s*(?:count|ct)\\b`, 'i').exec(input);
      // If a word-based count is found, it is used as the package size when no numeric count is present.
      if (wordCount) {
        result.packageSize = String(this.quantityWords[wordCount[1].toLowerCase()]);
        reserve(wordCount.index, wordCount.index + wordCount[0].length);
      }
    }

    /**
     * Detects incomplete package expressions at the start of the input string.
     * An incomplete package expression is one that specifies a package type and quantity
     * but does not provide a complete item count.
     * For example, "1 box of" would be considered incomplete.
     * While "1 box of 24" would be considered complete.
     */
    const incompletePackage = new RegExp(
      `^\\s*(\\d+|${countWords})\\s+(?:box(?:es)?|pack(?:s)?|set(?:s)?|bag(?:s)?|container(?:s)?)(?:\\s+of)?\\b`,
      'i'
    ).exec(input);
    // If an incomplete package expression is found at the start of the input and no package size has been determined
    if (incompletePackage && !result.packageSize) {
      // Mark the result as having an incomplete package expression.
      result.incompletePackage = true;
      packageQuantity = /^\d+$/.test(incompletePackage[1])
        ? incompletePackage[1]
        : String(this.quantityWords[incompletePackage[1].toLowerCase()]);
      reserve(incompletePackage.index, incompletePackage.index + incompletePackage[0].length);
    }

    // Extracts the leading numeric quantity from the input string, if present.
    const quantity = /^(\s*)(\d+)\b(?!\s*-)(?:\s+(?:box(?:es)?|pack(?:s)?|set(?:s)?|bag(?:s)?|roll(?:s)?|ream(?:s)?|sheet(?:s)?|piece(?:s)?|pair(?:s)?))?/i.exec(input);
    // Calculate the end index of the numeric quantity, including any leading whitespace.
    const quantityNumberEnd = quantity ? quantity.index + quantity[1].length + quantity[2].length : 0;

    // If a numeric quantity is found and it does not overlap with reserved spans, it is used as the quantity.
    // The reserved spans prevent double-counting of quantities that have already been identified as package sizes.
    if (quantity && !reserved.slice(quantity.index, quantityNumberEnd).some(Boolean)) {
      result.quantity = quantity[2];
      reserve(quantity.index, quantity.index + quantity[0].length);
    } else { // No numeric quantity found, check for a word-based quantity at the start of the input.
      // If no numeric quantity is found, check for a word-based quantity at the start of the input.
      const wordQuantity = new RegExp(
        `^(\\s*)(${countWords})\\b(?:\\s+(?:box(?:es)?|pack(?:s)?|set(?:s)?|bag(?:s)?|roll(?:s)?|ream(?:s)?|sheet(?:s)?|piece(?:s)?|pair(?:s)?))?`,
        'i'
      ).exec(input);

      // Calculate the end index of the word-based quantity, including any leading whitespace.
      const wordQuantityEnd = wordQuantity
        ? wordQuantity.index + wordQuantity[1].length + wordQuantity[2].length
        : 0;

      // If a word-based quantity is found and it does not overlap with reserved spans, it is used as the quantity.
      if (wordQuantity && !reserved.slice(wordQuantity.index, wordQuantityEnd).some(Boolean)) {
        result.quantity = String(this.quantityWords[wordQuantity[2].toLowerCase()]);
        reserve(wordQuantity.index, wordQuantity.index + wordQuantity[0].length);
      }
    }

    // Collect potential matches for each term in the input string.
    const candidates: Match[] = [];
    // Collect potential matches for each term in the input string.
    for (const field of this.fields) {
      // Iterate through each value associated with the current field.
      for (const value of terms[field]) {
        // Skip empty or whitespace-only values.
        if (!value?.trim()) continue;
        // Iterate through each alias for the current value.
        for (const alias of this.aliases(value)) {
          // Treat straight and curly apostrophes as equivalent in names such
          // as Elmer's, since copied school lists commonly contain either.
          const aliasPattern = this.escape(alias).replace(/['’]/g, "['’]").replace(/ /g, '[\\s-]+');
          const expression = new RegExp(`(?<![\\p{L}\\p{N}])${aliasPattern}(?![\\p{L}\\p{N}])`, 'giu');

          // Find all matches of the alias in the input string and add them to the candidates list.
          for (const match of input.matchAll(expression)) {
            const prefix = input.slice(Math.max(0, match.index - 12), match.index);
            const suffix = input.slice(match.index + match[0].length, match.index + match[0].length + 8);
            if (/\b(?:no|not|without)\s*$/i.test(prefix)) continue;
            if (field === 'color' && value === 'White' && /^\s*board\b/i.test(suffix)) continue;
            if (flexiblePreferenceSpans.some(span => match.index >= span.start
              && match.index + match[0].length <= span.end)) continue;
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

    const chosen: Match[] = []; // Holds the final selected matches after resolving conflicts with reserved spans.

    // Iterate through the sorted candidates and select the ones that do not conflict with reserved spans.
    for (const candidate of candidates) {
      if (reserved.slice(candidate.start, candidate.end).some(Boolean)) continue;
      chosen.push(candidate);
      reserve(candidate.start, candidate.end);
    }

    // Assign the chosen matches to their respective fields in the result object.
    for (const field of this.fields) {
      // Filter the chosen matches to include only those that belong to the current field and sort them by their start position.
      const matches = chosen.filter(match => match.field === field).sort((a, b) => a.start - b.start);
      // Remove duplicate matches based on their value, ignoring case.
      const values = matches.filter((match, index) =>
        matches.findIndex(other => other.value.toLowerCase() === match.value.toLowerCase()) === index);

      if (!values.length) continue; // Skip fields with no matched values.

      // Assign the first matched value to 'item' and 'brand' fields, or join multiple values for other fields.
      // For 'item' and 'brand' fields, only the first matched value is used.
      if (field === 'item' || field === 'brand') {
        result[field] = values[0].value;
      } else {
        // Supply List attributes can require one value (exactly) or accept one
        // of several values (anyOf). They cannot require several values with
        // "and", so every set of distinct matches becomes alternatives.
        result[field] = values.map(value => value.value).join(' | ');
      }
    }

    if (result.item?.toLowerCase().includes('marker')
      && /\bwide(?:\s+(?:point|tip))?\b/i.test(input)
      && !/\bwide[\s-]+ruled?\b/i.test(input)) {
      result.type = result.type
        ? [...new Set([...result.type.split('|').map(value => value.trim()), 'Wide Tip'])].join(' | ')
        : 'Wide Tip';
    }

    if (result.item === 'Marker' && /\bwashable\b/i.test(input)
      && terms.item.some(item => item === 'Washable Marker')) {
      result.item = 'Washable Marker';
    }

    if (result.item === 'Notebook' && /\bsingle[\s-]+subject\b/i.test(input)) {
      const canonical = /\bspiral(?:\s+bound)?\b/i.test(input)
        ? 'Single-Subject Spiral Notebook'
        : 'Single-Subject Notebook';
      if (terms.item.some(item => item === canonical)) result.item = canonical;
      result.type = this.withoutOption(result.type, 'Single Subject');
    }

    // Use brand hints when no item was found or when the text only matched a
    // generic item contained by the brand's more specific item (for example,
    // "Expo markers" should be Dry Erase Marker rather than Marker).
    if (result.brand) {
      const hints = brandItemHints[result.brand.toLowerCase()] ?? [];
      const compatibleItems = [...new Set(hints
        .map(hint => terms.item.find(value => this.aliases(value).includes(hint)))
        .filter((item): item is string => !!item)
        .filter(item => !result.item
          || item.toLowerCase() === result.item.toLowerCase()
          || item.toLowerCase().endsWith(` ${result.item.toLowerCase()}`)))]
        .sort((left, right) => right.length - left.length);

      // Prefer the most specific compatible item. Hint order should not allow
      // a generic term such as Marker to hide Dry Erase Marker.
      if (compatibleItems.length > 0) result.item = compatibleItems[0];
    }

    // Interpret packages only after the item is known. A package without a
    // count is valid for packaged items on Supply List. Individual items use
    // an implicit count of one, so explicit package arithmetic is flattened.
    const mode = result.item ? itemPackageMode(result.item, terms) : undefined;
    if (mode === 'PACKAGED' && result.incompletePackage) {
      result.quantity = packageQuantity;
      delete result.packageSize;
      result.incompletePackage = false;
    } else if (mode === 'PACKAGED' && result.packageSize && !result.quantity
      && /^\s*(?:box|pack|set|container|bag)\b/i.test(input)) {
      result.quantity = '1';
    } else if (mode === 'INDIVIDUAL') {
      const namedPackage = !!result.packageSize || !!result.incompletePackage;
      if (result.incompletePackage && !result.packageSize) {
        delete result.quantity;
        result.packageSize = '1';
      } else if (result.packageSize) {
        result.quantity = String(Number(result.quantity ?? 1) * Number(result.packageSize));
      }
      if (namedPackage) result.packageSize = '1';
      else delete result.packageSize;
    }

    const countChoice = /\b(\d+)\s*(?:-|–|—|or)\s*(\d+)\s*(?:count|ct\.?|pk\.?|pack|box)?\b/i.exec(input);
    if (countChoice) {
      result.countChoice = `${countChoice[1]} or ${countChoice[2]}`;
      result.packageSize = undefined;
    }
    if (result.brand && /\bpreferred\b/i.test(input)) {
      result.preferenceBrand = result.brand;
    }
    return result;
  }

  // Checks if a given fragment matches any term in the provided terms object.
  private matchesAnyTerm(fragment: string, terms: Terms): boolean {
    return this.fields.some(field => terms[field].some(term =>
      this.aliases(term).some(alias => new RegExp(`(?<![\\p{L}\\p{N}])${this.escape(alias)}(?![\\p{L}\\p{N}])`, 'iu').test(fragment))));
  }

  // Generates possible aliases for a given term to account for common variations.
  private aliases(term: string): string[] {
    // Converts the term to lowercase and trims whitespace, then generates common variations.
    const lower = term.trim().toLowerCase();

    // Initialize a set to store unique forms of the term, starting with the lowercase version.
    const forms = new Set([lower]);
    for (const [alias, canonical] of Object.entries(TERM_ALIASES)) {
      if (canonical.toLowerCase() === lower) forms.add(alias.toLowerCase());
    }

    // Generate common plural and singular forms of the term to account for variations in usage.
    if (lower.endsWith('ies')) forms.add(lower.slice(0, -3) + 'y');
    else if (lower.endsWith('es') && /(?:ch|sh|x|z)es$/.test(lower)) forms.add(lower.slice(0, -2));
    else if (lower.endsWith('s') && !lower.endsWith('ss')) forms.add(lower.slice(0, -1));
    else if (lower.endsWith('y') && !/[aeiou]y$/.test(lower)) forms.add(lower.slice(0, -1) + 'ies');
    else if (/(?:ch|sh|x|z|s)$/.test(lower)) forms.add(lower + 'es');
    else forms.add(lower + 's');
    return [...forms];
  }

  // Escapes special characters in a string to be used in a regular expression.
  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private withoutOption(value: string | undefined, remove: string): string | undefined {
    if (!value) return undefined;
    const remaining = value.split('|').map(option => option.trim())
      .filter(option => option.toLowerCase() !== remove.toLowerCase());
    return remaining.length ? remaining.join(' | ') : undefined;
  }
}
