import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const directory = new URL('../site/', import.meta.url);
const versions = new Map();
for (const asset of ['style.css', 'site.js']) {
    const bytes = await readFile(new URL(asset, directory));
    versions.set(asset, createHash('sha256').update(bytes).digest('hex').slice(0, 12));
}
for (const page of ['index.html', 'privacy/index.html', '404.html']) {
    const file = new URL(page, directory);
    const source = await readFile(file, 'utf8');
    const updated = source.replace(/\/(style\.css|site\.js)(?:\?v=[^"\s]+)?/g,
        (_, asset) => `/${asset}?v=${versions.get(asset)}`);
    if (updated !== source) await writeFile(file, updated);
}
console.log('Updated website asset versions.');
