import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b=await chromium.launch();
async function view(url, {wait=1500}={}){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:390,height:844}});
  const p=await ctx.newPage(); const mock=await installBackendMock(p);
  await p.goto(url); await p.waitForTimeout(wait);
  const dv=await p.evaluate(()=>document.documentElement.getAttribute('data-view'));
  const loc=await p.evaluate(()=>location.pathname+location.search);
  const sent=mock.sentTypes().join(',');
  await ctx.close();
  return {dv,loc,sent};
}
console.log('--- clean routes ---');
for (const [path,exp] of [['/','home'],['/word-bomb','home'],['/category-blitz','home'],['/sat-rush','sat-rush'],['/chain','chain'],['/fuse','fuse']]){
  const r=await view(path); console.log(`${path.padEnd(16)} -> data-view=${(r.dv||'').padEnd(9)} url=${r.loc}  ${r.dv===exp?'OK':'*** exp '+exp}`);
}
console.log('--- legacy query still works + canonicalises ---');
for (const [url,exp,expUrl] of [['/?satrush=1','sat-rush','/sat-rush'],['/?chain=1','chain','/chain'],['/?fuse=1','fuse','/fuse']]){
  const r=await view(url); console.log(`${url.padEnd(16)} -> data-view=${(r.dv||'').padEnd(9)} url=${r.loc}  view:${r.dv===exp?'OK':'*** '+exp} url:${r.loc===expUrl?'canon OK':'*** exp '+expUrl}`);
}
console.log('--- cg NOT broken / NOT canonicalised ---');
{ const r=await view('/?cg=1'); console.log(`/?cg=1           -> data-view=${(r.dv||'').padEnd(9)} url=${r.loc}  ${r.dv==='cg-arm'&&r.loc==='/?cg=1'?'OK (kept)':'*** cg-arm + /?cg=1'}`); }
console.log('--- /room/:code sends join ---');
{ const r=await view('/room/WXYZ',{wait:2500}); console.log(`/room/WXYZ       -> data-view=${(r.dv||'')} url=${r.loc} sent=[${r.sent}]  ${r.sent.includes('join_room')?'OK (join_room sent)':'*** join_room'}`); }
await b.close();
