import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { root, sha, json, write, argumentsFor } from './project.mjs';

// Native artwork assembled from the supplied, unmodified book covers.
const manifestFile = 'config/compositions-manifest.json';
const page = (await json('src/content/pages.json')).find(p => p.key === 'forja-diaria');
const composition = page.composition;
assert(composition && composition.books.length >= 1 && composition.books.length <= 12);
assert(/^[a-z0-9-]+$/.test(composition.revision));
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('"', '&quot;');
const sources = [composition.profile, ...composition.books.map(b => b.cover)];
assert(sources.every(p => /^\/media\/(?:forja\/[a-z0-9-]+\.jpg|capas\/[a-z0-9-]+\.webp)$/.test(p)));
const inputRows = await Promise.all(sources.map(async p => ({ path: p, sha256: sha(await fs.readFile(path.join(root, 'public', p))) })));
const inputSha256 = sha(JSON.stringify({ composition, name: page.name, sources: inputRows, generator: sha(await fs.readFile(import.meta.filename)) }));
const args = process.argv.slice(2);
if (args.length === 1 && args[0] === '--check') {
  const manifest = await json(manifestFile);
  assert.equal(manifest.inputSha256, inputSha256, 'Composition changed: regenerate its artwork');
  assert.equal(manifest.bookCount, composition.books.length);
  for (const output of manifest.outputs) {
    assert.equal(sha(await fs.readFile(path.join(root, 'public', output.path))), output.sha256, 'Composition output changed');
  }
  console.log(JSON.stringify({ ok: true, mode: 'read-only', bookCount: manifest.bookCount, outputs: manifest.outputs.length, inputSha256 }));
  process.exit(0);
}
const options = argumentsFor(args);
// librsvg does not decode WebP data URIs; lossless PNG preserves their decoded pixels.
const assets = new Map(await Promise.all(sources.map(async p => {
  const original = await fs.readFile(path.join(root, 'public', p));
  const embedded = p.endsWith('.jpg') ? original : await sharp(original).png().toBuffer();
  return [p, 'data:image/' + (p.endsWith('.jpg') ? 'jpeg' : 'png') + ';base64,' + embedded.toString('base64')];
})));
const defs = `<defs><filter id="shadow" x="-20%" y="-15%" width="145%" height="145%"><feDropShadow dx="0" dy="9" stdDeviation="7" flood-color="#0d182b" flood-opacity=".3"/></filter><linearGradient id="ring" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#ffd278"/><stop offset=".5" stop-color="#f45b52"/><stop offset="1" stop-color="#dc2e88"/></linearGradient></defs>`;
function grid({ x, y, width, height, columns, gap = 22 }) {
  const count = composition.books.length, rows = Math.ceil(count / columns);
  const cellWidth = (width - gap * (columns - 1)) / columns;
  const cellHeight = (height - gap * (rows - 1)) / rows;
  return composition.books.map((b, index) => {
    const row = Math.floor(index / columns), column = index % columns;
    const countInRow = Math.min(columns, count - row * columns);
    const scale = Math.min(cellWidth / b.width, cellHeight / b.height);
    const w = b.width * scale, h = b.height * scale;
    const left = x + (columns - countInRow) * (cellWidth + gap) / 2 + column * (cellWidth + gap) + (cellWidth - w) / 2;
    const top = y + row * (cellHeight + gap) + (cellHeight - h) / 2;
    return `<g filter="url(#shadow)"><rect x="${left - 3}" y="${top + 3}" width="${w + 6}" height="${h + 6}" rx="2" fill="#132132"/><image href="${assets.get(b.cover)}" x="${left}" y="${top}" width="${w}" height="${h}"><title>${escape(b.title)}</title></image><rect x="${left}" y="${top}" width="5" height="${h}" fill="#fff" opacity=".14"/></g>`;
  }).join('');
}
function profile(cx, cy, radius) {
  return `<clipPath id="profile"><circle cx="${cx}" cy="${cy}" r="${radius - 18}"/></clipPath><circle cx="${cx}" cy="${cy}" r="${radius}" fill="url(#ring)" filter="url(#shadow)"/><circle cx="${cx}" cy="${cy}" r="${radius - 10}" fill="#fff"/><image href="${assets.get(composition.profile)}" x="${cx - radius + 18}" y="${cy - radius + 18}" width="${2 * radius - 36}" height="${2 * radius - 36}" clip-path="url(#profile)"/>`;
}
function badge(x, y, width, height) {
  return `<g filter="url(#shadow)"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}" fill="#fff"/><text x="${x + width / 2}" y="${y + height * .46}" fill="#161616" text-anchor="middle" font-family="Georgia,serif" font-size="${width * .09}" font-weight="bold">A Forja Diária</text><text x="${x + width / 2}" y="${y + height * .78}" fill="#ed6259" text-anchor="middle" font-family="Arial,sans-serif" font-size="${width * .05}">@a.forja.diaria</text></g>`;
}
function svg(width, height, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><title>Combo da Forja Diária — ${composition.books.length} livros</title>${defs}${content}</svg>`;
}
const drawings = [
  { slot: 'hero', width: 1300, height: 843, content: profile(245, 416, 210) + badge(12, 676, 470, 145) + grid({ x: 535, y: 48, width: 735, height: 735, columns: 4, gap: 27 }) },
  { slot: 'mockup', width: 1097, height: 1200, content: grid({ x: 30, y: 24, width: 1037, height: 1142, columns: 3, gap: 24 }) },
  { slot: 'oferta', width: 889, height: 1200, content: grid({ x: 30, y: 24, width: 829, height: 1005, columns: 3, gap: 20 }) + `<rect x="12" y="1063" width="865" height="124" rx="20" fill="#ef6258"/><text x="444.5" y="1117" text-anchor="middle" font-family="Georgia,serif" font-size="47" font-weight="bold" fill="#fff">Combo da Forja Diária</text><text x="444.5" y="1161" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" fill="#fff">${composition.books.length} livros para ler em família</text>` },
  { slot: 'compartilhar', width: 1200, height: 630, content: `<rect width="1200" height="630" fill="#f9f4eb"/>` + profile(223, 226, 170) + badge(23, 420, 400, 116) + `<text x="223" y="589" text-anchor="middle" font-family="Arial,sans-serif" font-size="27" fill="#234974">${composition.books.length} livros para ler em família</text>` + grid({ x: 468, y: 30, width: 700, height: 560, columns: 4, gap: 22 }) }
];
const outputs = [];
for (const drawing of drawings) {
  const vector = svg(drawing.width, drawing.height, drawing.content);
  const pipeline = sharp(Buffer.from(vector));
  const bytes = drawing.slot === 'compartilhar' ? await pipeline.jpeg({ quality: 90, chromaSubsampling: '4:4:4' }).toBuffer() : await pipeline.webp({ quality: 88, alphaQuality: 100 }).toBuffer();
  const target = `/media/forja/${drawing.slot}-${composition.revision}.${drawing.slot === 'compartilhar' ? 'jpg' : 'webp'}`;
  const before = await fs.readFile(path.join(root, 'public', target)).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
  outputs.push({ path: target, width: drawing.width, height: drawing.height, sha256: sha(bytes), bytes: bytes.length, beforeSha256: before ? sha(before) : null, data: bytes });
}
const plan = { version: 1, operation: 'render-native-composition', page: page.key, bookCount: composition.books.length, inputSha256, outputs: outputs.map(({ data, ...output }) => output) };
const planHash = sha(JSON.stringify(plan));
await write('.runtime/compositions-preview.json', { mode: 'dry-run', planHash, ...plan });
if (!options.apply) {
  console.log(JSON.stringify({ ok: true, mode: 'dry-run', planHash, bookCount: plan.bookCount, totalBytes: outputs.reduce((n, o) => n + o.bytes, 0), outputs: plan.outputs }));
  process.exit(0);
}
assert.equal(options.planHash, planHash, 'Artwork preview changed');
for (const output of outputs) {
  const target = path.join(root, 'public', output.path);
  const current = await fs.readFile(target).catch(e => { if (e.code !== 'ENOENT') throw e; return null; });
  assert.equal(current ? sha(current) : null, output.beforeSha256, 'Artwork changed after its preview');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, output.data);
  assert.equal(sha(await fs.readFile(target)), output.sha256);
}
await write(manifestFile, { version: 1, page: page.key, revision: composition.revision, bookCount: composition.books.length, inputSha256, sources: inputRows, outputs: outputs.map(({ data, beforeSha256, ...output }) => output) });
console.log(JSON.stringify({ ok: true, mode: 'apply', planHash, bookCount: plan.bookCount, verifiedOutputs: outputs.length, totalBytes: outputs.reduce((n, o) => n + o.bytes, 0) }));
