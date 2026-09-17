// Asset packaging only: preserve the generated art and alpha, encode smaller files.
// Usage: node scripts/prepare-assets.mjs <runtime node_modules> <generated asset folder>
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';
const [runtime, source] = process.argv.slice(2);
if (!runtime || !source) throw new Error('Provide the runtime node_modules and generated asset folder.');
const sharp = createRequire(resolve(runtime, '../package.json'))('sharp');
await mkdir('dist/assets', {recursive:true});
for (const [input, output, width] of [
  ['partyposs-character.png','partyposs.webp',768],
  ['partyposs-attack.png','partyposs-attack.webp',800],
  ['ball-atlas.png','balls.webp',1024],
  ['maui-wali-effects.png','effects.webp',900],
  ['encounter-meadow.png','meadow.webp',900]
]) {
  try { await stat(resolve(source,input)); } catch { continue; }
  await sharp(resolve(source,input)).resize({width,withoutEnlargement:true}).webp({quality:87,alphaQuality:100}).toFile(resolve('dist/assets',output));
  console.log(output, (await stat(resolve('dist/assets',output))).size);
}
const icon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="110" fill="#173b49"/><path d="M119 390 253 70 392 390Z" fill="#4581ed"/><circle cx="253" cy="79" r="49" fill="#ffd773"/><path d="m221 221 60 17m-93 61 132 33" stroke="#fff" stroke-width="25" stroke-linecap="round"/><circle cx="255" cy="352" r="16" fill="#ffd773"/></svg>`;
await sharp(Buffer.from(icon)).png().toFile('dist/assets/icon.png');
try {
  const provenance = JSON.parse(await readFile(resolve(source,'provenance.json'),'utf8'));
  let text = '# Artwork provenance\n\nPrepared using the built-in image-generation tool from two PartyPoss images supplied by the user. Generated transparent assets were encoded to WebP with alpha preserved. The application uses the atlas cells as sprites; no remote image service is needed.\n\n' + provenance.assets.filter(a=>a.status==='generated').map(a=>`## ${a.name}\n\n${a.prompt}\n`).join('\n');
  try { const background = JSON.parse(await readFile(resolve(source,'encounter-meadow-provenance.json'),'utf8')); text += `\n## Encounter meadow\n\n${background.prompt}\n`; } catch { /* Background can be packaged separately. */ }
  await writeFile('ARTWORK.md',text);
} catch { /* Optional until all generation results arrive. */ }
