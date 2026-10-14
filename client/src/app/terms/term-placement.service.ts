import { Injectable } from '@angular/core';
import { DescriptionParserService, ParsedDescription } from './description-parser.service';
import { Terms } from './terms';
import { BRAND_ITEM_HINTS, CANONICAL_TERMS, TERM_ALIASES } from './term-standard';

/**
 * Service for analyzing and applying term placements in supply list items.
 * This service provides methods to analyze supply list items for term placement issues
 * and apply suggested corrections.
 * It helps maintain consistency and accuracy in the representation of supply list items.
 *
 * HOW IT WORKS:
 * The service analyzes each term placement field in a supply list item.
 * It normalizes the values, checks for conflicts with canonical terms and aliases,
 * and suggests corrections to ensure consistency and accuracy.
 */

// TermPlacementField represents the different fields that can be analyzed and placed within a supply list item.
export type TermPlacementField =
  'item' | 'brand' | 'color' | 'size' | 'type' | 'material' | 'quantity' | 'packageSize';

// TermPlacementValues represents the potential values for each term placement field, which may be partially filled.
export type TermPlacementValues = Partial<Record<TermPlacementField, string | number | null | undefined>>;

// TermPlacementConflict represents a conflict between the current value and a suggested value
// for a specific term placement field.
export interface TermPlacementConflict {
  field: TermPlacementField;
  currentValue: string | number;
  suggestedValue: string | number;
}

// TermPlacementIssue represents an issue detected during the analysis of term placements,
// including suggested changes and conflicts.
export interface TermPlacementIssue {
  id: string;
  sourceField: TermPlacementField;
  message: string;
  changes: TermPlacementValues;
  conflicts: TermPlacementConflict[];

  /** True if the issue has been automatically fixed.
    * False when the user must choose a value instead of applying an automatic fix.
    */
  fixable?: boolean;
}

export type TermPlacementSchema = 'inventory' | 'supplyList';
type TermTextField = 'item' | 'brand' | 'color' | 'size' | 'type' | 'material';

@Injectable({ providedIn: 'root' })
export class TermPlacementService {
  private readonly textFields: TermPlacementField[] = ['item', 'brand', 'color', 'size', 'type', 'material'];

  // This service is also constructed directly by the pure unit tests and the
  // Inventory dialog's legacy constructor tests.
  // eslint-disable-next-line @angular-eslint/prefer-inject
  constructor(private readonly parser: DescriptionParserService) {}

  /**
   * Analyzes the term placements for a given set of values, observed terms, and schema.
   * Returns a list of detected issues, including suggested changes and conflicts.
   */
  analyze(
    values: TermPlacementValues,
    observedTerms?: Terms,
    schema: TermPlacementSchema = 'inventory'
  ): TermPlacementIssue[] {
    // Prepare the terms for analysis based on the observed terms.
    const terms = this.analysisTerms(observedTerms);

    const issues: TermPlacementIssue[] = []; // Initialize an empty list to collect detected issues.

    // Iterate over each text field and analyze its value for potential issues.
    for (const sourceField of this.textFields) {
      const raw = String(values[sourceField] ?? '').trim();
      if (!raw) continue; // Skip empty values

      // Skip values that are only whitespace after trimming.
      if (schema === 'inventory' && raw.includes('|')) {
        issues.push(this.inventoryMultipleValueIssue(sourceField, raw));
        continue;
      }
      // Normalize the raw value into a list of alternatives for further analysis.
      const normalizedAlternatives = this.normalizedAlternativeList(sourceField, raw, terms);

      // If normalization produced a valid alternative list, create an issue for it.
      if (normalizedAlternatives !== null) {
        if (raw === normalizedAlternatives) continue;
        const changes = { [sourceField]: normalizedAlternatives } as TermPlacementValues;
        issues.push({
          id: `${sourceField}:${raw.toLowerCase()}`,
          sourceField,
          message: this.issueMessage(sourceField, changes, []),
          changes,
          conflicts: []
        });
        continue;
      }
      const normalized = this.normalizeAliases(raw); // Normalize the raw value by applying known aliases.

      // Brand-to-item inference is useful only when a full item phrase is being
      // decomposed. Running it on the Brand field itself would falsely claim a
      // correctly placed brand also contains an item.
      const parsed = this.parser.parse(
        normalized,
        terms,
        sourceField === 'item' ? BRAND_ITEM_HINTS : {}
      );

      // Parse the normalized value to extract structured information based on the source field and known terms.
      if (schema === 'inventory') {
        const multipleField = this.multipleAttributeField(parsed);
        if (multipleField) {
          issues.push(this.inventoryMultipleValueIssue(sourceField, raw, multipleField));
          continue;
        }
      }

      // Determine the suggested changes based on the parsed information.
      const changes = this.changesFor(sourceField, raw, normalized, parsed);

      if (!Object.keys(changes).length) continue; // Skip if no changes were detected.

      // Determine any conflicts between the suggested changes and existing values.
      const conflicts = this.conflictsFor(values, changes, sourceField);

      // Record the issue with its suggested changes and any detected conflicts.
      issues.push({
        id: `${sourceField}:${raw.toLowerCase()}`,
        sourceField,
        message: this.issueMessage(sourceField, changes, conflicts),
        changes,
        conflicts
      });
    }

    return issues;
  }

  /**
   * Applies the suggested changes from a detected issue to the given set of values.
   * If keepExistingConflicts is true, existing conflicts will be preserved.
   */
  apply(values: TermPlacementValues, issue: TermPlacementIssue, keepExistingConflicts = false): TermPlacementValues {
    // If the issue is not fixable, return the original values unchanged.
    if (issue.fixable === false) return { ...values };

    const result = { ...values }; // Create a copy of the original values to apply changes to.

    // Apply each suggested change from the issue to the result, respecting existing conflicts if specified.
    for (const [field, suggested] of Object.entries(issue.changes) as [TermPlacementField, string | number][]) {
      const conflict = issue.conflicts.find(entry => entry.field === field);
      if (conflict && keepExistingConflicts) continue;
      result[field] = suggested;
    }

    // Preserve the original source field value if keeping existing conflicts and conflicts exist.
    if (keepExistingConflicts && issue.conflicts.length) {
      const parsedSource = issue.changes[issue.sourceField];
      result[issue.sourceField] = parsedSource ?? '';
    }
    return result;
  }

  /**
   * Determines the suggested changes for a given source field based on the raw, normalized, and parsed information.
   * Returns an object mapping fields to their suggested values.
   */
  private changesFor(
    sourceField: TermPlacementField,
    raw: string,
    normalized: string,
    parsed: ParsedDescription
  ): TermPlacementValues {
    // Without a recognized item anchor, removing recognized attributes would
    // also erase the unknown item wording (for example, "two custom kits").
    if (sourceField === 'item' && !parsed.item) return {};

    const changes: TermPlacementValues = {}; // Initialize an empty object to store suggested changes.

    // Define the fields to be considered for parsing and their corresponding values from the parsed description.
    const parsedFields: [TermPlacementField, string | undefined][] = [
      ['item', parsed.item],
      ['brand', parsed.brand],
      ['color', parsed.color],
      ['size', parsed.size],
      ['type', parsed.type],
      ['material', parsed.material],
      ['quantity', parsed.quantity],
      ['packageSize', parsed.packageSize]
    ];

    // Iterate over each parsed field and determine if it should be included in the suggested changes.
    for (const [targetField, value] of parsedFields) {
      if (!value) continue;
      if (targetField === 'quantity' && sourceField !== 'item') continue;
      changes[targetField] = targetField === 'quantity' || targetField === 'packageSize' ? Number(value) : value;
    }

    // Check if the only parsed field with a value is the source field itself.
    const parsedTextFields = parsedFields.filter(([, value]) => !!value);
    const onlySameField = parsedTextFields.length === 1 && parsedTextFields[0][0] === sourceField;
    const suggestedSource = changes[sourceField];

    // If the only field with a value is the source field and it is exactly equivalent to the raw input, no changes are needed.
    if (onlySameField && this.exactlyEquivalent(raw, suggestedSource)) return {};

    // If there is no suggested source value but there are other changes, set the source field to an empty string.
    if (!suggestedSource && Object.keys(changes).length) changes[sourceField] = '';

    // Ensure the item field is updated if the source field is 'item' and a parsed item exists.
    if (sourceField === 'item' && parsed.item) changes.item = parsed.item;
    return changes;
  }

  /**
   * Identifies conflicts between the current values and the suggested changes for a given source field.
   * Returns an array of conflicts, each containing the field, its current value, and the suggested value.
   */
  private conflictsFor(
    current: TermPlacementValues,
    changes: TermPlacementValues,
    sourceField: TermPlacementField
  ): TermPlacementConflict[] {
    return (Object.entries(changes) as [TermPlacementField, string | number][])
      .filter(([field, suggested]) => field !== sourceField
        && this.hasValue(current[field])
        && !this.equivalent(current[field], suggested))
      .map(([field, suggested]) => ({
        field,
        currentValue: current[field] as string | number,
        suggestedValue: suggested
      }));
  }

  /**
   * Generates a user-friendly message describing the suggested changes and any conflicts for a given source field.
   */
  private issueMessage(
    sourceField: TermPlacementField,
    changes: TermPlacementValues,
    conflicts: TermPlacementConflict[]
  ): string {
    const changedFields = Object.keys(changes); // Get the list of fields that have suggested changes.

    // If there are no changed fields, return an empty message.
    if (changedFields.length === 0) return '';

    // If there is only one changed field and it is the source field, return a normalization message.
    if (changedFields.length === 1 && changedFields[0] === sourceField) {
      return `${this.label(sourceField)} uses a recognized term that should be normalized. Suggested ${this.label(sourceField)}: ${changes[sourceField]}.`;
    }

    // Prepare the list of destination fields and their suggested values, excluding the source field.
    const destinations = Object.entries(changes)
      .filter(([field]) => field !== sourceField)
      .map(([field, value]) => `${this.label(field as TermPlacementField)}: ${value}`);
    const normalizedSource = changes[sourceField];
    const sourceChange = this.hasValue(normalizedSource)
      ? `${this.label(sourceField)}: ${normalizedSource}`
      : `${this.label(sourceField)}: blank`;
    const conflictSuffix = conflicts.length
      ? ` Resolve the existing ${conflicts.map(conflict => this.label(conflict.field)).join(', ')} value.`
      : '';

    // Construct the final message combining the source field, suggested destination fields, and any conflict information.
    return `${this.label(sourceField)} contains recognized information that belongs in structured fields. Suggested ${[sourceChange, ...destinations].join('; ')}.${conflictSuffix}`;
  }

  /**
   * Analyzes the observed terms and merges them with canonical terms to create a comprehensive list of normalized terms.
   * @param observed The observed terms from the input data.
   * @returns A set of normalized terms for each category.
   */
  private analysisTerms(observed?: Terms): Terms {
    const merge = (field: TermTextField) => {
      const values = [...CANONICAL_TERMS[field], ...(field === 'brand' ? observed?.brand ?? [] : [])];
      return [...new Map(values.filter(Boolean).map(value => [value.trim().toLowerCase(), value.trim()])).values()];
    };
    return {
      item: merge('item'),
      brand: merge('brand'),
      color: merge('color'),
      size: merge('size'),
      type: merge('type'),
      material: merge('material')
    };
  }

  /**
   * Normalizes a given value by replacing any recognized aliases with their canonical forms.
   * @param value The raw value to normalize.
   * @returns The normalized value with aliases replaced by canonical terms.
   */
  private normalizeAliases(value: string): string {
    let normalized = value;
    const aliases = Object.entries(TERM_ALIASES).sort((a, b) => b[0].length - a[0].length);
    for (const [alias, canonical] of aliases) {
      const expression = new RegExp(`(?<![\\p{L}\\p{N}])${this.escape(alias).replace(/ /g, '[\\s-]+')}(?![\\p{L}\\p{N}])`, 'giu');
      normalized = normalized.replace(expression, canonical);
    }
    return normalized;
  }

  /**
   * Normalizes a list of alternative values separated by the '|' character for a given source field.
   * @param sourceField The field for which the alternatives are being normalized.
   * @param raw The raw string containing alternative values separated by '|'.
   * @param terms The set of normalized terms for each category.
   * @returns A normalized string of alternatives or null if normalization is not applicable.
   */
  private normalizedAlternativeList(sourceField: TermPlacementField, raw: string, terms: Terms): string | null {
    if (!raw.includes('|') || sourceField === 'quantity' || sourceField === 'packageSize') return null;
    const tokens = raw.split('|').map(token => token.trim()).filter(Boolean);
    if (tokens.length < 2) return null;

    const normalizedTokens: string[] = [];
    for (const token of tokens) {
      const normalized = this.normalizeAliases(token);
      const owners = this.textFields.filter(field =>
        terms[field as TermTextField].some(term => this.equivalent(term, normalized)));
      if (owners.length === 0) {
        normalizedTokens.push(token);
        continue;
      }
      if (owners.length !== 1 || owners[0] !== sourceField) return null;
      normalizedTokens.push(
        terms[sourceField as TermTextField].find(term => this.equivalent(term, normalized)) ?? normalized
      );
    }
    return normalizedTokens.join(' | ');
  }

  /**
   * Determines which attribute field contains multiple values separated by the '|' character.
   * @param parsed The parsed description containing various attribute fields.
   * @returns The field that contains multiple values, or undefined if none are found.
   */
  private multipleAttributeField(parsed: ParsedDescription): TermPlacementField | undefined {
    const attributes: [TermPlacementField, string | undefined][] = [
      ['brand', parsed.brand],
      ['color', parsed.color],
      ['size', parsed.size],
      ['type', parsed.type],
      ['material', parsed.material]
    ];
    return attributes.find(([, value]) => value?.includes('|'))?.[0];
  }

  /**
   * Generates an issue object for inventory fields that contain multiple values when only one is allowed.
   * @param sourceField The field where the issue originated.
   * @param raw The raw value that caused the issue.
   * @param detectedField The field detected to have multiple values, defaults to the source field.
   * @returns A TermPlacementIssue object describing the multiple value issue.
   */
  private inventoryMultipleValueIssue(
    sourceField: TermPlacementField,
    raw: string,
    detectedField: TermPlacementField = sourceField
  ): TermPlacementIssue {
    return {
      id: `${sourceField}:${raw.toLowerCase()}:multiple-values`,
      sourceField,
      message: `Inventory allows only one ${this.label(detectedField).toLowerCase()} value. Choose a single value before saving.`,
      changes: {},
      conflicts: [],
      fixable: false
    };
  }

  /**
   * Checks if two values are equivalent, ignoring case and surrounding whitespace.
   * @param left The first value to compare.
   * @param right The second value to compare.
   * @returns True if the values are equivalent, false otherwise.
   */
  private equivalent(left: unknown, right: unknown): boolean {
    return String(left ?? '').trim().toLowerCase() === String(right ?? '').trim().toLowerCase();
  }

  /**
   * Checks if two values are exactly equivalent, considering case and surrounding whitespace.
   * @param left The first value to compare.
   * @param right The second value to compare.
   * @returns True if the values are exactly equivalent, false otherwise.
   */
  private exactlyEquivalent(left: unknown, right: unknown): boolean {
    return String(left ?? '').trim() === String(right ?? '').trim();
  }

  /**
   * Checks if a value is non-empty and non-null.
   * @param value The value to check.
   * @returns True if the value has a meaningful value, false otherwise.
   */
  private hasValue(value: unknown): boolean {
    return value !== undefined && value !== null && String(value).trim() !== '';
  }

  /**
   * Returns a human-readable label for a given term placement field.
   * @param field The term placement field.
   * @returns The human-readable label for the field.
   */
  private label(field: TermPlacementField): string {
    return field === 'packageSize'
      ? 'Package size'
      : field.charAt(0).toUpperCase() + field.slice(1);
  }
  /**
   * Escapes special characters in a string for use in a regular expression.
   * @param value The string to escape.
   * @returns The escaped string.
   */
  private escape(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
