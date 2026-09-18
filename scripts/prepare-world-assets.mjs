import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {readFile,writeFile,stat} from 'node:fs/promises';
const [runtime,source]=process.argv.slice(2);
const sharp=createRequire(resolve(runtime,'../package.json'))('sharp');
for(const [name,width] of [['critters-a',1254],['critters-b',1254],['trail-map',900]]){
  await sharp(resolve(source,`${name}.png`)).resize({width,withoutEnlargement:true}).webp({quality:87,alphaQuality:100}).toFile(`dist/assets/${name}.webp`);
  console.log(name,(await stat(`dist/assets/${name}.webp`)).size);
}
const provenance=JSON.parse(await readFile(resolve(source,'provenance.json'),'utf8'));
const current=(await readFile('ARTWORK.md','utf8')).split('\n# Woodland expansion')[0];
const section='\n# Woodland expansion\n\nBuilt-in image generation, using PartyPoss as the style reference. Animal roster reference: [Scouting America, Connecticut Yankee Council](https://www.ctyankee.org/woodbadge/after_the_course/). These are original game characters, not official Scouting artwork.\n\n'+provenance.assets.map(a=>`## ${a.name}\n\nFinal game asset: \`dist/assets/${a.name}.webp\`.\n\n${a.prompt}\n`).join('\n');
await writeFile('ARTWORK.md',current+section);
