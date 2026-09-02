import { chromium } from '@playwright/test';
import { installBackendMock } from '../../e2e/support/backendMock.js';
const ME='e2e-player';
const wbPlayers=[{id:ME,name:'YOU',lives:3,isHost:true},{id:'p2',name:'RIVAL',lives:2}];
async function play(outcome){
  const b=await chromium.launch();
  const ctx=await b.newContext({baseURL:'http://localhost:4173',viewport:{width:390,height:844}});
  const p=await ctx.newPage(); const mock=await installBackendMock(p);
  await p.goto('/?portal=1'); await p.getByRole('img',{name:'Type a Word'}).waitFor();
  mock.pushToClient({type:'room_update',payload:{code:'WXYZ',gameType:'word-bomb',hostId:ME,difficultyKey:'chill',players:wbPlayers}}); await p.waitForTimeout(80);
  mock.pushToClient({type:'game_started',payload:{gameType:'word-bomb'}}); await p.waitForTimeout(80);
  mock.pushToClient({type:'turn_update',payload:{currentPlayerId:ME,players:wbPlayers,combo:'at',usedWords:['CAT'],timerSeconds:22}});
  await p.waitForTimeout(3200);
  mock.dropClient();
  await p.locator('.connlost-title').waitFor({timeout:4000}).catch(()=>{});
  const phase1 = (await p.locator('.connlost-title').textContent().catch(()=>''))||'';
  const boardKept = await p.locator('.game-player-bar').count();
  // socket reconnects on its own (backoff) -> app sends join_room; answer it.
  await mock.waitForSent('join_room', 12000).catch(()=>{});
  if(outcome==='fail'){
    mock.pushToClient({type:'error',payload:{message:'game_already_started'}});
  } else {
    mock.pushToClient({type:'room_update',payload:{code:'WXYZ',gameType:'word-bomb',hostId:ME,difficultyKey:'chill',players:wbPlayers}});
  }
  await p.waitForTimeout(1500);
  const phase2 = (await p.locator('.connlost-title').textContent().catch(()=>'(none)'))||'(none)';
  const overlayGone = await p.locator('.connlost-overlay').count();
  const sub = (await p.locator('.connlost-sub').textContent().catch(()=>''))||'';
  console.log(`[${outcome}] phase1="${phase1.trim()}" boardKept=${boardKept} | after-rejoin: overlay=${overlayGone} title="${phase2.trim()}" sub="${sub.trim().slice(0,60)}"`);
  await b.close();
}
await play('fail');
await play('ok');
