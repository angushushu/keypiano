import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceDirs = ['components', 'contexts', 'hooks', 'services', 'types'];
const sourceFiles = ['App.tsx', 'constants.ts', 'i18n.ts', 'index.tsx', 'theme.ts', 'vite.config.ts'];
const findings = [];

const collect = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(path);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      sourceFiles.push(relative(root, path));
    }
  }
};

for (const dir of sourceDirs) {
  collect(join(root, dir));
}

const uniqueFiles = [...new Set(sourceFiles)];

for (const file of uniqueFiles) {
  const path = join(root, file);
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);

  lines.forEach((line, index) => {
    const at = `${file}:${index + 1}`;

    if (/\bas\s+any\b|:\s*any\b|any\[\]/.test(line)) {
      findings.push(`${at} avoid explicit any`);
    }

    if (/target="_blank"/.test(line) && !/rel="[^"]*\bnoopener\b[^"]*"/.test(line)) {
      findings.push(`${at} target="_blank" must include rel="noopener noreferrer"`);
    }

    // User-visible attribute text has to come from i18n.ts. Interpolated
    // values (`attr={...}`) are fine; only hardcoded literals are flagged.
    const literal = line.match(/\b(title|aria-label|placeholder|alt)="([^"{}]+)"/);
    if (literal) {
      findings.push(`${at} ${literal[1]}="${literal[2]}" must be a localized string from i18n.ts`);
    }
  });
}

// Vite copies public/ into dist/, so a file kept in both the repo root and
// public/ can silently drift: editing the root copy changes nothing that ships.
// (The sitemap, robots.txt and the GA snippet were each lost this way.)
for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile()) continue;
  if (existsSync(join(root, 'public', entry.name))) {
    findings.push(`${entry.name} exists in both the repo root and public/; keep only the public/ copy`);
  }
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`Quality checks passed (${uniqueFiles.length} files scanned).`);
