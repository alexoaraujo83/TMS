#!/usr/bin/env node

import { execFileSync } from 'node:child_process';

const tools = [
  ['git', ['--version']],
  ['gh', ['--version']],
  ['vercel', ['--version']],
  ['neon', ['--version']],
  ['railway', ['--version']],
  ['auth0', ['--version']],
];

const results = tools.map(([name, args]) => {
  try {
    const output = execFileSync(name, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return { name, ok: true, version: output.split('\n')[0] };
  } catch {
    return { name, ok: false, version: null };
  }
});

console.table(results);

const missing = results.filter((item) => !item.ok).map((item) => item.name);
if (missing.length) {
  console.error(`Missing platform CLIs: ${missing.join(', ')}`);
  process.exit(1);
}
