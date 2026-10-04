import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd, encoding: 'utf8' })
    .split('\0').filter(file => /\.(?:js|mjs)$/.test(file) && existsSync(path.join(cwd, file)));
for (const file of new Set(files)) execFileSync(process.execPath, ['--check', file], { cwd, stdio: 'inherit' });
console.log(`Syntax checked ${new Set(files).size} JavaScript files.`);
