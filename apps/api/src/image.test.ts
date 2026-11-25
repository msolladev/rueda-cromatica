import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = join(import.meta.dirname, "../../..");

describe("the image of the API (apps/api/deploy/Dockerfile)", () => {
  it("runs the Node of devEngines, the one of development and the CI", async () => {
    const [dockerfile, manifest] = await Promise.all([
      readFile(join(REPO, "apps/api/deploy/Dockerfile"), "utf8"),
      readFile(join(REPO, "package.json"), "utf8"),
    ]);
    const { devEngines } = JSON.parse(manifest) as {
      devEngines: { runtime: { name: string; version: string } };
    };
    expect(devEngines.runtime.name).toBe("node");
    expect(dockerfile).toMatch(
      new RegExp(
        `^FROM node:${devEngines.runtime.version.replaceAll(".", "\\.")}-`,
        "m",
      ),
    );
  });
});
