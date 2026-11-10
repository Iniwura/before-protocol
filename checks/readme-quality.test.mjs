import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const repository=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const documents=['README.md','docs/README.md','AGENTS.md'];
const read=path=>readFile(resolve(repository,path),'utf8');

test('every local link in the canonical README, docs index and agent contract resolves',async()=>{
 const errors=[];
 for(const path of documents){
  const content=await read(path);
  const markdownLinks=/\[[^\]]+\]\(([^)]+)\)/g;
  for(const match of content.matchAll(markdownLinks)){
   let raw=match[1].trim();
   if(raw.startsWith('<')&&raw.endsWith('>'))raw=raw.slice(1,-1);
   // External URLs and anchors are not files. Avoid fetching the network in CI.
   if(/^https?:\/\//i.test(raw)||/^mailto:/i.test(raw)||raw.startsWith('#'))continue;
   const target=decodeURIComponent(raw.split('#')[0].split('?')[0]);
   if(!target)continue;
   const absolute=resolve(dirname(resolve(repository,path)),target);
   if(!absolute.startsWith(repository+'/')&&absolute!==repository){errors.push(path+' escapes repository: '+target);continue;}
   try{await stat(absolute)}catch{errors.push(path+' -> '+target+' does not exist');}
  }
 }
 assert.deepEqual(errors,[]);
});

test('main README answers the first-time judge questions with actual evidence',async()=>{
 const readme=await read('README.md');
 for(const section of ['## Why BEFORE?','## Try it in two minutes','## Real WIF transactions',
   '## Why people would return','## What runs where','## Architecture',
   '## Run and verify locally','## Security and limitations']){
   assert.ok(readme.includes(section),'Missing first-time-user section '+section);
 }
 assert.match(readme,/youtu\.be\/YC7t2mql-cI/,'Final demo must be linked');
 assert.match(readme,/ISSUE_18_MAINNET_SUPPORT_EVIDENCE/,'Mainnet receipts must be linked');
 assert.match(readme,/BTEST/,'Testnet research scope must be visible');
 assert.match(readme,/controlled mainnet acceptance tests/i,'Do not imply organic paid support');
 assert.match(readme,/No open-source license has been declared/,'Do not imply missing legal permission is a license');
});

test('documentation index distinguishes current proof from historical snapshots',async()=>{
 const docs=await read('docs/README.md');
 assert.match(docs,/## Essential submission evidence/);
 assert.match(docs,/## Historical development records/);
 assert.match(docs,/ISSUE_18_MAINNET_SUPPORT_EVIDENCE/);
 assert.match(docs,/WORLD_IS_FLAT_SUBMISSION_PACKET/);
});
