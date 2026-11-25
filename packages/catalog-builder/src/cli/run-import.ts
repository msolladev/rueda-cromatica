/**
 * Flow shared by the importer entry points (docs/04 §7): fetches the files of
 * each source at the URL of its file, reads them as text or as a PDF,
 * imports them with the package's pure logic (`importSource`) and writes the
 * source file and the brand files that change, once they pass their own
 * checks.
 */
import { dataPath, printIssues, readCuratedFiles } from "./data-files.ts";
import { writeDataFile } from "./write-data-file.ts";
import {
  importerOf,
  importSource,
  readBrandFile,
  readCurated,
  readSourceFile,
  sourceContent,
  sourceFiles,
  type SourceImporter,
  type Transcribed,
} from "../index.ts";
import { readPdfText } from "./pdf.ts";

function fail(messages: readonly string[]): number {
  for (const message of messages) console.error(message);
  return 1;
}

/** Fetches the files of a source and transcribes them. */
async function transcribe(
  importer: SourceImporter,
  urls: readonly string[],
): Promise<Transcribed | string> {
  const fetched: { name: string; bytes: Uint8Array }[] = [];
  for (const url of urls) {
    const response = await fetch(url);
    if (!response.ok) {
      return `Could not fetch ${url}: HTTP ${String(response.status)}`;
    }
    fetched.push({
      name: url,
      bytes: new Uint8Array(await response.arrayBuffer()),
    });
  }
  if (importer.format === "pdf") {
    const pdfs = [];
    for (const { bytes } of fetched) pdfs.push(await readPdfText(bytes));
    return importer.transcribe(pdfs);
  }
  const decoder = new TextDecoder();
  return importer.transcribe(
    fetched.map(({ name, bytes }) => ({ name, text: decoder.decode(bytes) })),
  );
}

/** Imports one source; 0 if it went well. */
async function runImport(sourceId: string): Promise<number> {
  const importer = importerOf(sourceId);
  if (importer === null) return fail([`No importer for ${sourceId}`]);
  const files = await readCuratedFiles();
  if (!files.ok) return fail(files.error);
  const curated = readCurated(files.value.data);
  if (!curated.ok) {
    printIssues(curated.error);
    return 1;
  }

  const source = curated.value.sources.find((s) => s.source.id === sourceId);
  if (source === undefined) return fail([`No source file for ${sourceId}`]);
  const targets = sourceFiles(source.source);
  if (!targets.ok) {
    return fail([`${dataPath(source.name)}: ${targets.error}`]);
  }
  if (targets.value === null || targets.value.length === 0) {
    return fail([`${dataPath(source.name)}: ${sourceId} has no URL`]);
  }

  const transcription = await transcribe(
    importer,
    targets.value.map(({ url }) => url),
  );
  if (typeof transcription === "string") return fail([transcription]);
  if (!transcription.ok) return fail(transcription.error);

  const result = importSource({
    curated: curated.value,
    source,
    importer,
    transcription: transcription.value,
  });
  if (!result.ok) return fail(result.error);
  const imported = result.value;

  // Never write a file that does not pass its own checks.
  const sourceWrite = {
    name: imported.source.name,
    content: sourceContent(imported.source),
  };
  const brandWrites = imported.brands.map((brand) => ({
    name: brand.name,
    content: { brand: brand.brand, ranges: brand.ranges, paints: brand.paints },
  }));
  const invalid = [
    readSourceFile(sourceWrite),
    ...brandWrites.map(readBrandFile),
  ].flatMap((check) => (check.ok ? [] : check.error));
  if (invalid.length > 0) {
    printIssues(invalid);
    return 1;
  }
  const writes = [sourceWrite, ...brandWrites];
  for (const write of writes) await writeDataFile(write.name, write.content);

  const { paints, equivalences } = imported.source;
  console.log(
    `${dataPath(source.name)}: ${String(paints.length)} rows, ${String(equivalences.length)} equivalences, ${String(imported.proposals.length)} new paint(s)`,
  );
  for (const paint of imported.proposals) console.log(`  + ${paint.id}`);
  const { keys, differences, pending } = imported;
  if (keys !== null) {
    console.log(
      `  ${String(keys.added.length)} key(s) added to curated paints`,
    );
    if (keys.unmatched.length > 0) {
      console.log("\nRows without a single paint (key or ignore by hand):");
      for (const { key, candidates } of keys.unmatched) {
        const which =
          candidates.length === 0 ? "no paint" : candidates.join(", ");
        console.log(`  "${key}": ${which}`);
      }
    }
  }
  if (differences.length > 0) {
    console.log(
      "\nChanged in the source, kept in the curated paints (decide by hand):",
    );
    for (const d of differences) {
      console.log(
        `  ${d.paintId} ${d.field}: source ${String(d.source)}, curated ${String(d.curated)}`,
      );
    }
  }
  if (pending.length > 0) {
    console.log("\nThe builder will reject these until they are decided:");
    printIssues(pending);
  }
  return 0;
}

/**
 * Imports the sources in order, stopping at the first that fails, and sets
 * the exit code.
 */
export async function runImports(sourceIds: readonly string[]): Promise<void> {
  for (const sourceId of sourceIds) {
    const code = await runImport(sourceId);
    if (code !== 0) {
      process.exitCode = code;
      return;
    }
  }
  console.log("\nNext: build-catalog, and review the diff.");
}
