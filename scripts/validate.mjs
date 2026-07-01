#!/usr/bin/env node
// Validate the distributable plugin for this repo's marketplace.
//
// Three checks, all must pass:
//   1. Native schema validation via `claude plugin validate <plugin> --strict`.
//   2. Parity: every plugin component byte-matches its .claude/ source, and every
//      .claude/ component (except the lab-only commands/hello.md) is shipped.
//   3. The marketplace.json parses and its plugin `source` path exists.
//
// No external dependencies — Node built-ins only. Wired to `npm run validate`.

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const pluginDir = join(repoRoot, 'plugins', 'agent-driven-dev');
const claudeDir = join(repoRoot, '.claude');
const marketplaceFile = join(repoRoot, '.claude-plugin', 'marketplace.json');

// Components that live in .claude/ but are intentionally NOT shipped in the plugin.
const EXCLUDED = new Set(['commands/hello.md']);

const errors = [];
const notes = [];

// --- Check 1: native plugin validation ------------------------------------
function nativeValidate() {
  // On Windows the `claude` launcher is a .cmd, which spawnSync can only run via a
  // shell; pass a single quoted command string to avoid DEP0190 (args + shell).
  const res =
    process.platform === 'win32'
      ? spawnSync(`claude plugin validate "${pluginDir}" --strict`, {
          encoding: 'utf8',
          shell: true,
        })
      : spawnSync('claude', ['plugin', 'validate', pluginDir, '--strict'], {
          encoding: 'utf8',
        });
  if (res.error && res.error.code === 'ENOENT') {
    notes.push('claude CLI not found on PATH — skipped native `plugin validate`.');
    return;
  }
  const out = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim();
  if (res.status !== 0) {
    errors.push(`native validation failed (exit ${res.status}):\n${out}`);
  } else {
    notes.push('native `claude plugin validate --strict`: OK');
  }
}

// --- Check 2: parity between plugin copies and .claude/ sources ------------
function listFiles(dir) {
  const acc = [];
  const walk = (d) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else acc.push(p);
    }
  };
  if (existsSync(dir)) walk(dir);
  return acc;
}

// Compare content ignoring line-ending style: git's autocrlf can check out the
// plugin copies and their .claude/ sources with different EOLs in the working
// tree even though the committed blobs are identical, which would otherwise
// trip a byte-exact check with false drift.
const normalized = (p) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

function parity() {
  // Every shipped file must match its .claude/ source (EOL-insensitive).
  for (const file of listFiles(pluginDir)) {
    const rel = relative(pluginDir, file).split('\\').join('/');
    if (rel.startsWith('.claude-plugin/')) continue; // manifest is plugin-only
    const source = join(claudeDir, rel);
    if (!existsSync(source)) {
      errors.push(`shipped file has no .claude/ source: ${rel}`);
      continue;
    }
    if (normalized(file) !== normalized(source)) {
      errors.push(`drift: plugin copy differs from .claude/${rel}`);
    }
  }
  // Every .claude/ component (minus EXCLUDED) must be shipped.
  for (const source of listFiles(claudeDir)) {
    const rel = relative(claudeDir, source).split('\\').join('/');
    if (rel.endsWith('.local.json')) continue; // local settings, never shipped
    if (rel === 'settings.local.json') continue;
    const top = rel.split('/')[0];
    if (!['commands', 'agents', 'skills'].includes(top)) continue;
    if (EXCLUDED.has(rel)) continue;
    if (!existsSync(join(pluginDir, rel))) {
      errors.push(`.claude/${rel} is not shipped in the plugin (add it or add to EXCLUDED)`);
    }
  }
}

// --- Check 3: marketplace catalog -----------------------------------------
function marketplace() {
  let cat;
  try {
    cat = JSON.parse(readFileSync(marketplaceFile, 'utf8'));
  } catch (e) {
    errors.push(`marketplace.json does not parse: ${e.message}`);
    return;
  }
  if (!cat.name) errors.push('marketplace.json: missing "name"');
  if (!Array.isArray(cat.plugins) || cat.plugins.length === 0) {
    errors.push('marketplace.json: "plugins" must be a non-empty array');
    return;
  }
  for (const p of cat.plugins) {
    if (!p.name) errors.push('marketplace.json: a plugin entry is missing "name"');
    if (!p.source) {
      errors.push(`marketplace.json: plugin "${p.name}" is missing "source"`);
      continue;
    }
    const src = join(repoRoot, p.source);
    if (!existsSync(join(src, '.claude-plugin', 'plugin.json'))) {
      errors.push(`marketplace.json: source for "${p.name}" has no .claude-plugin/plugin.json (${p.source})`);
    }
  }
  notes.push(`marketplace "${cat.name}": ${cat.plugins.length} plugin(s) catalogued`);
}

nativeValidate();
parity();
marketplace();

for (const n of notes) console.log(`  ok  ${n}`);
if (errors.length > 0) {
  console.error(`\n✗ validate: ${errors.length} problem(s):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log('\n✓ validate: plugin, parity, and marketplace all OK');
