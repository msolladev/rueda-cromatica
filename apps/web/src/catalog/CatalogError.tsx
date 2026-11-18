import type { Messages } from "../i18n/messages.ts";
import type { CatalogLoadError } from "./load.ts";

interface CatalogErrorProps {
  readonly error: CatalogLoadError;
  readonly messages: Messages;
  readonly onRetry: () => void;
  readonly onUpdate: () => void;
}

/**
 * Why there are no paints (docs/07 §7). It takes the place of the results;
 * the wheel keeps working.
 */
export function CatalogError({
  error,
  messages: m,
  onRetry,
  onUpdate,
}: CatalogErrorProps) {
  switch (error.kind) {
    case "network":
      return (
        <div className="notice notice-error" role="alert">
          <p>
            <strong>{m.errors.networkTitle}</strong> {m.errors.networkBody}
          </p>
          <button type="button" className="button" onClick={onRetry}>
            {m.errors.retry}
          </button>
        </div>
      );
    case "version":
      return (
        <div className="notice notice-error" role="alert">
          <p>
            <strong>{m.errors.versionTitle}</strong> {m.errors.versionBody}
          </p>
          <button type="button" className="button" onClick={onUpdate}>
            {m.errors.update}
          </button>
        </div>
      );
    case "invalid":
      return (
        <div className="notice notice-error" role="alert">
          <p>
            <strong>{m.errors.invalidTitle}</strong> {m.errors.invalidBody}
          </p>
          <details>
            <summary>{m.errors.technicalDetails}</summary>
            <pre>{error.detail}</pre>
          </details>
        </div>
      );
  }
}
