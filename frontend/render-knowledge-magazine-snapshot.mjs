#!/usr/bin/env node
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const EXIT = Object.freeze({ PASS: 0, STRUCTURAL_FAIL: 1, INPUT: 2, INTERNAL: 3 });
const ROOT = dirname(fileURLToPath(import.meta.url));
const MODULE_PATH = '/src/render-snapshot/knowledgeMagazineRenderSnapshot.tsx';

function usage() {
  return [
    'Usage:',
    '  node frontend/render-knowledge-magazine-snapshot.mjs --input <request.json> [--out <snapshot.json>]',
    '',
    'Exit codes: 0 PASS, 1 structural FAIL, 2 input/usage error, 3 renderer/internal error.',
  ].join('\n');
}

function parseArgs(argv) {
  const result = { input: null, out: null, help: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument !== '--input' && argument !== '--out') {
      throw Object.assign(new Error(`Unbekanntes Argument: ${argument}`), { code: 'USAGE_INVALID' });
    }
    if (seen.has(argument)) {
      throw Object.assign(new Error(`Argument doppelt angegeben: ${argument}`), { code: 'USAGE_INVALID' });
    }
    seen.add(argument);
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw Object.assign(new Error(`Wert für ${argument} fehlt.`), { code: 'USAGE_INVALID' });
    }
    result[argument === '--input' ? 'input' : 'out'] = value;
    index += 1;
  }
  if (!result.help && !result.input) {
    throw Object.assign(new Error('--input ist erforderlich.'), { code: 'USAGE_INVALID' });
  }
  return result;
}

function errorJson(code, message) {
  return JSON.stringify({ schema: 'article_render_snapshot_error.v2', code, message });
}

async function readJsonStrict(path) {
  let bytes;
  try {
    bytes = await readFile(resolve(path));
  } catch (error) {
    throw Object.assign(new Error(`Input konnte nicht gelesen werden: ${error.message}`), { code: 'INPUT_READ_FAILED' });
  }
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw Object.assign(new Error('Input ist kein valides UTF-8.'), { code: 'INPUT_UTF8_INVALID' });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw Object.assign(new Error(`Input ist kein valides JSON: ${error.message}`), { code: 'INPUT_JSON_INVALID' });
  }
}

async function writeSnapshotAtomic(path, serialized) {
  const outputPath = resolve(path);
  const temporaryPath = `${outputPath}.tmp-${process.pid}`;
  try {
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(temporaryPath, serialized, { encoding: 'utf8' });
    await rename(temporaryPath, outputPath);
  } catch (error) {
    throw Object.assign(new Error(`Snapshot konnte nicht atomar geschrieben werden: ${error.message}`), {
      code: 'OUTPUT_WRITE_FAILED',
      exit_code: EXIT.INTERNAL,
    });
  } finally {
    await rm(temporaryPath, { force: true });
  }
}

export async function closeViteServer(vite) {
  if (!vite) return;
  try {
    await vite.close();
  } catch (error) {
    throw Object.assign(new Error(`Vite-Renderer konnte nicht geschlossen werden: ${error.message}`), {
      code: 'VITE_CLOSE_FAILED',
      exit_code: EXIT.INTERNAL,
    });
  }
}

export async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${errorJson(error.code ?? 'USAGE_INVALID', error.message)}\n${usage()}\n`);
    process.exitCode = EXIT.INPUT;
    return;
  }
  if (args.help) {
    process.stdout.write(`${usage()}\n`);
    return;
  }

  let request;
  try {
    request = await readJsonStrict(args.input);
  } catch (error) {
    process.stderr.write(`${errorJson(error.code ?? 'INPUT_INVALID', error.message)}\n`);
    process.exitCode = EXIT.INPUT;
    return;
  }

  process.env.NODE_ENV = 'production';
  let vite;
  try {
    vite = await createServer({
      root: ROOT,
      appType: 'custom',
      logLevel: 'silent',
      server: { middlewareMode: true },
    });
    const snapshotModule = await vite.ssrLoadModule(MODULE_PATH);
    const snapshot = snapshotModule.renderKnowledgeMagazineSnapshot(request);
    const serialized = `${JSON.stringify(snapshot, null, 2)}\n`;
    if (args.out) await writeSnapshotAtomic(args.out, serialized);
    process.stdout.write(serialized);
    process.exitCode = snapshot.result === 'PASS' ? EXIT.PASS : EXIT.STRUCTURAL_FAIL;
  } catch (error) {
    const exitCode = error?.exit_code === EXIT.INPUT ? EXIT.INPUT : EXIT.INTERNAL;
    process.stderr.write(`${errorJson(error?.code ?? (exitCode === EXIT.INPUT ? 'INPUT_INVALID' : 'RENDER_INTERNAL'), error?.message ?? 'Unbekannter Rendererfehler.')}\n`);
    process.exitCode = exitCode;
  } finally {
    try {
      await closeViteServer(vite);
    } catch (error) {
      process.stderr.write(`${errorJson(error.code ?? 'VITE_CLOSE_FAILED', error.message)}\n`);
      process.exitCode = EXIT.INTERNAL;
    }
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) await main();
