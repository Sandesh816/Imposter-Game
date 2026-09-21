import { readFile, readdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const page=await readFile('www/index.html','utf8');
for(const filename of ['categories.js','questionCategories.js']){
    assert(page.includes(`src="${filename}"`));
    assert((await readFile(`www/${filename}`,'utf8')).length>100);
}
for(const filename of await readdir('www/assets')){
    if(!filename.endsWith('.js'))continue;
    const source=await readFile(`www/assets/${filename}`,'utf8');
    assert(!source.includes('http://127.0.0.1:9099'),'Production bundle contains an enabled Auth emulator');
    assert(!source.includes('demo-imposter-review'),'Production bundle contains demo configuration');
}
console.log('Production datasets and Firebase configuration verified.');
