import { readdirSync, readFileSync } from 'node:fs';
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
    if (/\bas\s+any\b|:\s*any\b|any\[\]/.test(line)) {
      findings.push(`${file}:${index + 1} avoid explicit any`);
    }
    if (/target="_blank"/.test(line) && !/rel="[^"]*\bnoopener\b[^"]*"/.test(line)) {
      findings.push(`${file}:${index + 1} target="_blank" must include rel="noopener noreferrer"`);
    }
  });
}

if (findings.length > 0) {
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log(`Quality checks passed (${uniqueFiles.length} files scanned).`);
