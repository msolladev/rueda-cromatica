/**
 * Outcome of an operation whose expected failures are returned as values,
 * not thrown. Check `ok` before reading `value` or `error`.
 *
 * @example
 * ```ts
 * const parsed = parseCatalog(json);
 * if (!parsed.ok) throw new Error(parsed.error.kind);
 * const catalog = parsed.value;
 * ```
 */
export type Result<T, E> =
  | {
      /** The operation succeeded. */
      readonly ok: true;
      /** What it produced. */
      readonly value: T;
    }
  | {
      /** The operation failed. */
      readonly ok: false;
      /** Why. */
      readonly error: E;
    };

/** A successful {@link Result} with `value`. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

/** A failed {@link Result} with `error`. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
