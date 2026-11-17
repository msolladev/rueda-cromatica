// Helpers for error messages: invalid values fail with a message that
// explains what is wrong (docs/05 §1).

/** Describes a received value to show it in an error message. */
export function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return Array.isArray(value) ? "an array" : `a value of type ${typeof value}`;
}

/** Lists the accepted values: `one of "a", "b"`. */
export function oneOf(values: readonly string[]): string {
  return `one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;
}

export function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
