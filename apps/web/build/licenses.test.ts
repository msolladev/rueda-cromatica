import { describe, expect, it } from "vitest";
import { licenseComments, repositoryUrl } from "./licenses.ts";

describe("licenseComments", () => {
  it("extracts the text of @license comments, without the marks", () => {
    const code = `/**\n * @license\n * Icons copied from Lucide.\n *\n * ISC License.\n */\nconst x = 1;\n/* not a license */`;
    expect(licenseComments(code)).toEqual([
      "Icons copied from Lucide.\n\nISC License.",
    ]);
  });
});

describe("repositoryUrl", () => {
  it.each([
    [
      "git+https://github.com/colinhacks/zod.git",
      "https://github.com/colinhacks/zod",
    ],
    [
      "git@github.com:Evercoder/culori.git",
      "https://github.com/Evercoder/culori",
    ],
    ["github:owner/repo", "https://github.com/owner/repo"],
    ["owner/repo", "https://github.com/owner/repo"],
  ])("normalizes %s", (raw, url) => {
    expect(repositoryUrl(raw)).toBe(url);
    expect(repositoryUrl({ url: raw })).toBe(url);
  });

  it("is null without a repository", () => {
    expect(repositoryUrl(undefined)).toBeNull();
  });
});
