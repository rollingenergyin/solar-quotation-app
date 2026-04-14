/**
 * Safely read a nested value from an object using dot notation.
 * e.g. getNestedValue({ lead: { score: 42 } }, 'lead.score') → 42
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}
