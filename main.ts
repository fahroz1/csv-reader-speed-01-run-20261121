// Entry driver for csv-reader-speed-01 (make.fun): the harness runs
// `node /bot/main.ts` (node22). It reads every case from
// /input/cases.json (a JSON array of {id, input}), answers each one
// alone with run() from solve.js, and writes /output/answers.json: a
// JSON array of the answers, one per case and in the cases' order.
// Outside a container MAKEFUN_INPUT_DIR and MAKEFUN_OUTPUT_DIR stand
// in for /input and /output. Paths are resolved from this file, never
// from the process working directory (the grader's CWD is not /bot).

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { setFlagsFromString } from 'node:v8';

// V8's incremental marking off, set before solve.js is imported so all
// of its work runs under it (the house baseline runs with
// --no-incremental-marking, and an entry may tune V8's flags too).
setFlagsFromString('--no-incremental-marking');

/** The entry's own directory, from this file's URL. */
const ENTRY_DIR = dirname(fileURLToPath(import.meta.url));

/** solve.js, imported by its file URL (a .js module carries no types)
 *  and typed by its contract. */
const { run } = (await import(pathToFileURL(join(ENTRY_DIR, 'solve.js')).href)) as {
  run: (input: unknown) => unknown;
};

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const cases = JSON.parse(readFileSync(join(INPUT_DIR, 'cases.json'), 'utf8')) as { id: string; input: unknown }[];
const answers: unknown[] = [];
for (const c of cases) answers.push(run(c.input));
writeFileSync(join(OUTPUT_DIR, 'answers.json'), JSON.stringify(answers));
