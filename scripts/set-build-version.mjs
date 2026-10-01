import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const manifestPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'manifest.json');
const buildNumber = Number(process.env.GITHUB_RUN_NUMBER);

if (!Number.isInteger(buildNumber) || buildNumber < 1 || buildNumber > 65535) {
    throw new Error('GITHUB_RUN_NUMBER must be an integer between 1 and 65535.');
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const match = typeof manifest.version === 'string'
    ? /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(manifest.version)
    : null;

if (!match) {
    throw new Error(`Expected a three-part base manifest version, got: ${manifest.version}`);
}

const baseParts = match.slice(1).map(Number);
if (baseParts.some(part => part > 65535)) {
    throw new Error(`Manifest base version is out of range: ${manifest.version}`);
}

manifest.version = `${manifest.version}.${buildNumber}`;
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Prepared release version ${manifest.version}.`);
