import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const b = await chromium.launch();
const ctx = await b.newContext({ baseURL:'http://localhost:4173', viewport:{width:1366,height:768}, reducedMotion:'reduce' });
const p = await ctx.newPage();
const mock = await installBackendMock(p);
const ME='e2e-player';
const ps=[{id:ME,name:'YOU',lives:3,isHost:true},{id:'p2',name:'RIVAL',lives:2}];
await p.goto('/?portal=1&x7c=1');
await p.getByRole('img', { name: 'Type a Word' }).waitFor({ state: 'visible' });
mock.pushToClient({type:'room_update',payload:{code:'ABCD',gameType:'word-bomb',hostId:ME,difficultyKey:'chill',players:ps}});
await p.waitForTimeout(80);
mock.pushToClient({type:'game_started',payload:{gameType:'word-bomb'}});
await p.waitForTimeout(80);
mock.pushToClient({type:'turn_update',payload:{currentPlayerId:ME,players:ps,combo:'str',usedWords:['X'],timerSeconds:30}});
await p.locator('.countdown-overlay').waitFor({state:'attached',timeout:8000}).catch(()=>{});
await p.locator('.countdown-overlay').waitFor({state:'detached',timeout:20000}).catch(()=>{});
await p.waitForTimeout(800);
const out = await p.evaluate(() => {
  const el = document.querySelector('.x7c-motif');
  if (!el) return { present: false };
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const par = el.parentElement;
  const pcs = getComputedStyle(par);
  return {
    present: true,
    rect: [Math.round(r.left),Math.round(r.top),Math.round(r.width),Math.round(r.height)],
    opacity: cs.opacity, bg: cs.backgroundColor, z: cs.zIndex, pos: cs.position,
    mask: (cs.maskImage||cs.webkitMaskImage||'').slice(0,70),
    maskSize: cs.maskSize||cs.webkitMaskSize,
    src: cs.getPropertyValue('--x7c-src').trim().slice(0,50),
    display: cs.display, visibility: cs.visibility,
    parent: String(par.className).slice(0,40),
    parentOverflow: pcs.overflow + '/' + pcs.overflowX + '/' + pcs.overflowY,
    parentPos: pcs.position,
  };
});
console.log(JSON.stringify(out, null, 1));
// Does it PAINT? Sample the same pixel block with the motif visible and hidden.
const sample = async () => {
  const buf = await p.screenshot({ clip: { x: 1000, y: 500, width: 240, height: 200 } });
  return p.evaluate((b64) => new Promise((res) => {
    const i = new Image();
    i.onload = () => {
      const c = document.createElement('canvas'); c.width=i.width; c.height=i.height;
      const x=c.getContext('2d'); x.drawImage(i,0,0);
      const d=x.getImageData(0,0,c.width,c.height).data;
      let r=0,g=0,bb=0,n=0;
      for(let k=0;k<d.length;k+=4){r+=d[k];g+=d[k+1];bb+=d[k+2];n++;}
      res([Math.round(r/n),Math.round(g/n),Math.round(bb/n)]);
    };
    i.src='data:image/png;base64,'+b64;
  }), buf.toString('base64'));
};
const withMotif = await sample();
await p.evaluate(() => { document.querySelector('.x7c-motif').style.display='none'; });
await p.waitForTimeout(200);
const without = await sample();
console.log('mean pixel WITH motif   :', withMotif);
console.log('mean pixel WITHOUT motif:', without);
console.log('delta                   :', withMotif.map((v,i)=>v-without[i]));
await b.close();
