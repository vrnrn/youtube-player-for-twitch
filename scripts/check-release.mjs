import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const entries = execFileSync('unzip', ['-Z1', 'release.zip'], { cwd, encoding: 'utf8' }).trim().split('\n');
const expected = new Set([
    'manifest.json', manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap(script => [...(script.js || []), ...(script.css || [])]),
    'vaft-main.js', 'vendor/vaft/vaft.js', 'vendor/vaft/LICENSE', 'vendor/vaft/README.md', 'LICENSE'
]);
assert.deepEqual(new Set(entries), expected, 'Release must contain only runtime files and license notices');
for (const file of expected) {
    const packaged = execFileSync('unzip', ['-p', 'release.zip', file], { cwd });
    assert.ok(packaged.equals(readFileSync(new URL(`../${file}`, import.meta.url))), `${file}: packaged bytes match source`);
}
console.log(`Validated ${entries.length} release files (${statSync(new URL('../release.zip', import.meta.url)).size.toLocaleString()} bytes).`);
