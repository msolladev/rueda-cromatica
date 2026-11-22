// The constants that vite.config.ts writes in the code when it builds.

interface ImportMetaEnv {
  /** The commit the web is built from; empty without git (docs/07 §17). */
  readonly VITE_COMMIT: string;
  /** The date of that commit, as `YYYY-MM-DD`; empty without git. */
  readonly VITE_COMMIT_DATE: string;
}
