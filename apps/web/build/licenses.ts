/**
 * The third-party licenses of the distributed code (docs/07 §13): a Vite
 * plugin that follows each module of the bundle to its package and reads its
 * name, version, license and LICENSE file, and the `@license` comments of
 * this project's own packages (the copied Lucide icons). Nothing is written
 * by hand, so the list always matches what is shipped.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { Plugin } from "vite";
import type { LicenseEntry } from "../src/features/credits/data.ts";

/** This project's packages: their code is not third-party. */
const OWN_SCOPE = "@chromatic-wheel/";

interface PackageJson {
  readonly name?: string;
  readonly version?: string;
  readonly license?: string;
  readonly repository?: string | { readonly url?: string };
}

const LICENSE_FILE = /^(licen[cs]e|copying)(\.(md|txt))?$/i;
const LICENSE_COMMENT = /\/\*\*?\s*\n?\s*\*?\s*@license\b([\s\S]*?)\*\//g;

function packageRoot(file: string): string | undefined {
  let dir = dirname(file);
  for (;;) {
    if (existsSync(join(dir, "package.json"))) {
      const json = JSON.parse(
        readFileSync(join(dir, "package.json"), "utf8"),
      ) as PackageJson;
      // Some packages have a package.json in subfolders without a name.
      if (json.name !== undefined) return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

function repositoryUrl(repository: PackageJson["repository"]): string | null {
  const raw = typeof repository === "string" ? repository : repository?.url;
  if (raw === undefined) return null;
  const url = raw
    .replace(/^git\+/, "")
    .replace(/\.git$/, "")
    .replace(/^git:\/\//, "https://")
    .replace(/^git@([^:]+):/, "https://$1/")
    .replace(/^github:/, "https://github.com/");
  return /^https?:\/\//.test(url) ? url : `https://github.com/${url}`;
}

/** The text of `@license` comments, without the comment marks. */
export function licenseComments(code: string): string[] {
  return [...code.matchAll(LICENSE_COMMENT)].map((match) =>
    (match[1] ?? "")
      .split("\n")
      .map((line) => line.replace(/^\s*\* ?/, "").trimEnd())
      .join("\n")
      .trim(),
  );
}

export interface LicenseCollector {
  /** Add it to the plugins of each build whose output is distributed. */
  readonly plugin: () => Plugin;
  /** Every entry found, packages first and by name. */
  readonly entries: () => LicenseEntry[];
}

export function licenseCollector(): LicenseCollector {
  const found = new Map<string, LicenseEntry>();

  const collect = (id: string) => {
    if (id.startsWith("\0") || !isAbsolute(id)) return;
    const file = id.split("?")[0] ?? id;
    const root = packageRoot(file);
    if (root === undefined) return;
    const json = JSON.parse(
      readFileSync(join(root, "package.json"), "utf8"),
    ) as PackageJson;
    const name = json.name ?? "";
    if (name.startsWith(OWN_SCOPE)) {
      if (!existsSync(file)) return;
      for (const text of licenseComments(readFileSync(file, "utf8"))) {
        found.set(`notice:${name}:${text}`, { kind: "notice", name, text });
      }
      return;
    }
    const key = `package:${name}@${json.version ?? ""}`;
    if (found.has(key)) return;
    const licenseFile = readdirSync(root).find((entry) =>
      LICENSE_FILE.test(entry),
    );
    if (licenseFile === undefined) {
      throw new Error(`${name} has no license file to reproduce.`);
    }
    found.set(key, {
      kind: "package",
      name,
      version: json.version ?? "",
      license: json.license ?? "",
      repository: repositoryUrl(json.repository),
      text: readFileSync(join(root, licenseFile), "utf8").trim(),
    });
  };

  return {
    plugin: () => ({
      name: "chromatic-wheel:licenses",
      apply: "build",
      generateBundle(_, bundle) {
        for (const output of Object.values(bundle)) {
          if (output.type !== "chunk") continue;
          for (const id of Object.keys(output.modules)) collect(id);
        }
      },
    }),
    entries: () =>
      [...found.values()].sort((a, b) =>
        a.kind === b.kind
          ? a.name.localeCompare(b.name, "en")
          : a.kind === "package"
            ? -1
            : 1,
      ),
  };
}
