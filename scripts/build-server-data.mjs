import { readFile, mkdir, writeFile } from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../', import.meta.url);
const words=vm.runInNewContext((await readFile(new URL('categories.js',root),'utf8'))+'\nCATEGORIES');
const questions=vm.runInNewContext((await readFile(new URL('questionCategories.js',root),'utf8'))+'\nQUESTION_CATEGORIES');
const catalog={...words,...Object.fromEntries(Object.entries(questions).map(([key,value])=>['q:'+key,value]))};
await mkdir(new URL('functions/generated/',root),{recursive:true});
await writeFile(new URL('functions/generated/catalog.json',root),JSON.stringify(catalog));
