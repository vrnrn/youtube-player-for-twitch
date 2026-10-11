import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const cwd = fileURLToPath(new URL('../', import.meta.url));
const unpackedDirectory = process.argv[2] && resolve(cwd, process.argv[2]);
const manifest = JSON.parse(readFileSync(new URL('../manifest.json', import.meta.url), 'utf8'));
const entries = execFileSync('unzip', ['-Z1', 'release.zip'], { cwd, encoding: 'utf8' }).trim().split('\n');
const expected = new Set([
    'manifest.json', manifest.background.service_worker,
    ...Object.values(manifest.icons),
    ...manifest.content_scripts.flatMap(script => [...(script.js || []), ...(script.css || [])]),
    'vaft-main.js', 'vendor/vaft/vaft.js', 'vendor/vaft/LICENSE', 'vendor/vaft/README.md', 'LICENSE'
]);
assert.deepEqual(new Set(entries), expected, 'Release must contain only runtime files and license notices');
if (unpackedDirectory) {
    const unpackedEntries = readdirSync(unpackedDirectory, { recursive: true })
        .filter(file => statSync(join(unpackedDirectory, file)).isFile());
    assert.deepEqual(new Set(unpackedEntries), expected, 'Unpacked build must contain only runtime files and license notices');
}
for (const file of expected) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url));
    const packaged = execFileSync('unzip', ['-p', 'release.zip', file], { cwd });
    assert.ok(packaged.equals(source), `${file}: packaged bytes match source`);
    if (unpackedDirectory) {
        assert.ok(readFileSync(join(unpackedDirectory, file)).equals(source), `${file}: unpacked bytes match source`);
    }
}
if (unpackedDirectory) {
    console.log(`Validated ${entries.length} unpacked files at ${unpackedDirectory}.`);
} else {
    console.log(`Validated ${entries.length} release files (${statSync(new URL('../release.zip', import.meta.url)).size.toLocaleString()} bytes).`);
}
