import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME='e2e-player';
const players=[{id:ME,name:'YOU',lives:3,isHost:true},{id:'p2',name:'RIVAL',lives:0}];
const b=await chromium.launch();
for(const [w,h] of [[1440,900],[1366,768],[1280,551]]){
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:w,height:h},deviceScaleFactor:1});
  const p=await ctx.newPage(); const m=await installBackendMock(p);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
  m.pushToClient({type:'room_update',payload:{code:'ABCD',gameType:'word-bomb',hostId:ME,difficultyKey:'chill',players}}); await p.waitForTimeout(80);
  m.pushToClient({type:'game_started',payload:{gameType:'word-bomb'}}); await p.waitForTimeout(80);
  m.pushToClient({type:'turn_update',payload:{currentPlayerId:ME,players,combo:'at',usedWords:['CAT','HAT'],timerSeconds:30}}); await p.waitForTimeout(80);
  m.pushToClient({type:'game_over',payload:{winnerId:ME}});
  await p.locator('.game-over-overlay').waitFor(); await p.waitForTimeout(1200);
  const vis=await p.evaluate(()=>{const r=document.querySelector('.game-over-rematch'); if(!r) return 'no-rematch'; const b=r.getBoundingClientRect(); return {top:Math.round(b.top),bottom:Math.round(b.bottom),vh:window.innerHeight,visible:b.bottom<=window.innerHeight+1&&b.top>=-1};});
  console.log(`${w}x${h}: rematch=${JSON.stringify(vis)}`);
  await p.screenshot({path:`claude/gameover-pass/shots/wb-fix-${w}x${h}.png`});
  await ctx.close();
}
await b.close();
