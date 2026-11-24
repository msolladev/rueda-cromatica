/**
 * Instants in UTC (ADR-0038): how every date travels between the API and its
 * clients.
 */
import { z } from "zod";

/**
 * Validates an {@link Instant}: exactly what `Date.prototype.toISOString()`
 * writes. Rejects other precisions, such as `2027-03-01T09:00:00Z`, and any
 * offset other than `Z`, such as `2027-03-01T10:00:00.000+01:00`.
 */
export const instantSchema = z.iso
  .datetime({ precision: 3 })
  .brand<"Instant">();

/**
 * An instant in UTC, in the format of `toISOString()`, with milliseconds and
 * the `Z` zone, such as `2027-03-01T09:00:00.000Z`. Shown to people in their
 * own time zone and language with `Intl.DateTimeFormat`.
 */
export type Instant = z.infer<typeof instantSchema>;

/**
 * The {@link Instant} of a date.
 *
 * @throws {RangeError} If the date is invalid, such as `new Date("")`: a bug
 * of the caller.
 */
export function toInstant(date: Date): Instant {
  return instantSchema.parse(date.toISOString());
}
