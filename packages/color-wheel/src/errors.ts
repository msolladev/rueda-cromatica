// Ayudas para los mensajes de error: los valores no válidos fallan con un
// mensaje que explica qué falla (docs/05 §1).

/** Representa un valor recibido para mostrarlo en un mensaje de error. */
export function describeValue(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  return Array.isArray(value) ? "an array" : `a value of type ${typeof value}`;
}

/** Lista los valores admitidos: `one of "a", "b"`. */
export function oneOf(values: readonly string[]): string {
  return `one of ${values.map((v) => JSON.stringify(v)).join(", ")}`;
}

export function isPlainObject(
  value: unknown,
): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
