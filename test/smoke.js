"use strict";
// 深谷突擊 smoke test：
// 在 Node 裡 mock 瀏覽器環境，手動跑主迴圈，驗證完整流程：
//   標題 → 開場故事 → 關卡（移動/射擊/門/怪物/敵彈/道具/受傷/暫停）
//   → 死亡動畫 → gameover → 商店（純買賣、不刷怪）→ 新遊戲
//   → 結局故事 → 商店 → Boss×2（Dave 菇菇大王 / Tank 巨龜將軍）
//   + 雷射光束 / 攝影機左跟 / 手把校正流程 / 機槍固定頻率
//
// 跑法：node test/smoke.js

// ---------- mock 瀏覽器環境 ----------
function makeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === "createLinearGradient" || k === "createRadialGradient") return () => grad;
      if (k === "measureText") return () => ({ width: 0 });
      if (!(k in t)) t[k] = () => {};
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; },
  });
}
const sharedCtx = makeCtx(); // 共用同一個 ctx 實體：測試可暫時替換 fillText 記錄繪圖座標
const canvas = {
  width: 960,
  height: 540,
  getContext: () => sharedCtx,
  addEventListener() {},
};
const listeners = {};
const store = {};
const raf = { cb: null };
global.window = globalThis;
globalThis.addEventListener = (type, cb) => { (listeners[type] = listeners[type] || []).push(cb); };
global.document = {
  getElementById: (id) => (id === "game" ? canvas : null),
  createElement: () => ({ width: 0, height: 0, getContext: () => makeCtx() }),
  addEventListener() {},
};
global.localStorage = {
  getItem: (k) => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: (k) => { delete store[k]; },
};
global.requestAnimationFrame = (cb) => { raf.cb = cb; };

// mock 手把（測校正流程用；padActive 開關控制是否「接上」手把）
const padButtons = Array.from({ length: 17 }, () => ({ pressed: false }));
const mockPad = { connected: true, buttons: padButtons, axes: [0, 0] };
let padActive = false;
Object.defineProperty(globalThis, "navigator", {
  value: { getGamepads: () => (padActive ? [mockPad] : []) },
  configurable: true,
  writable: true,
});

// 確定性偽隨機
let seed = 20261023;
Math.random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const GROUND_Y = 470; // 與 game.js 一致
const game = require(require("path").join(__dirname, "..", "game.js"));
const { state, player } = game;

let failed = 0;
function ok(cond, msg) {
  if (cond) console.log("  ok - " + msg);
  else { failed++; console.error("  FAIL - " + msg); }
}

let now = 0;
function frames(n) {
  for (let i = 0; i < n; i++) {
    now += 16.7;
    raf.cb(now);
  }
}
function fire(type, e) { (listeners[type] || []).forEach((cb) => cb(e)); }
function key(code) {
  fire("keydown", { code, key: code, preventDefault() {} });
  fire("keyup", { code, key: code, preventDefault() {} });
}
function hold(code) { fire("keydown", { code, key: code, preventDefault() {} }); }
function release(code) { fire("keyup", { code, key: code, preventDefault() {} }); }
function skipStory() {
  while (state.mode === "story" || state.mode === "ending") game.story.skip();
}

console.log("深谷突擊 smoke test");

// ---------- 1. 標題畫面 ----------
ok(state.mode === "title", "起點是標題畫面");
frames(3);
ok(game.doors.length === 0 && game.enemies.length === 0, "標題畫面不出門不出怪");

// ---------- 2. 開場故事 ----------
key("Enter");
frames(1);
ok(state.mode === "story", "Enter 進入開場故事");
ok(game.story.idx === 0, "故事從第一行開始");
frames(100); // 100 帧 > 1.5s/行，應自動推進
ok(game.story.idx > 0, "故事會自動推進");

// ---------- 3. 跳過故事 → 開始墜落 ----------
skipStory();
ok(state.mode === "playing", "跳過故事進入關卡");
ok(player.falling === true, "主角從天上墜落");

// ---------- 4. 落地 ----------
frames(60);
ok(player.falling === false && player.onGround, "主角落地");

// ---------- 5. 移動 / 射擊 ----------
player.inv = 999; // 測試期間無敵，避免雜訊
hold("ArrowRight");
const x0 = player.x;
frames(60);
release("ArrowRight");
ok(player.x > x0 + 50, "可以向右移動");

hold("KeyJ");
frames(10);
release("KeyJ");
ok(game.bullets.length > 0, "可以射擊");

// ---------- 6. 門與怪物 ----------
frames(260);
ok(game.enemies.length > 0, "怪物會從門裡竄出來");

// ---------- 7. 敵人反擊 ----------
const er = game.makeEnemy("red", player.x + 220, GROUND_Y + 2); // 中心落在地面
er.vy = 0; er.onGround = true; er.atkCd = 0;
game.enemies.push(er);
frames(30);
ok(game.ebullets.length > 0, "紅紅怪會吐酸液");

// ---------- 8. 道具拾取 ----------
game.items.push(game.makeItem("rapid", player.x, player.y));
frames(2);
ok(player.rapidT > 7, "撿到連發道具");

// ---------- 9. 半顆心受傷 ----------
player.inv = 0;
player.x += 500; // 離開其他怪物
const hpBefore = state.hp;
game.enemies.push(game.makeEnemy("red", player.x, player.y + 12));
frames(1);
ok(state.hp === hpBefore - 1, "被怪碰到扣半顆心");

// ---------- 10. 暫停 ----------
player.inv = 999;
key("KeyP");
const t0 = state.time;
frames(3);
ok(state.paused === true && state.time === t0, "P 暫停、時間凍結");
key("KeyP");
frames(3);
ok(state.paused === false && state.time > t0, "再按 P 恢復");

// ---------- 11. 死亡動畫 → gameover ----------
state.hp = 1;
player.inv = 0;
player.x += 500;
game.enemies.push(game.makeEnemy("red", player.x, player.y + 12));
frames(1);
ok(player.dead === true && state.mode === "dying", "血量歸零進入死亡動畫");
frames(110);
ok(state.mode === "gameover", "死亡動畫結束 → gameover");

// ---------- 12. gameover → 商店 ----------
key("KeyS");
frames(1);
ok(state.mode === "shop", "gameover 按 S 進入武器商店");

// ---------- 13. 商店購買 ----------
state.gold = 1000;
game.shopBuy(1); // 機槍 300
ok(state.gold === 700 && state.weapon === "mg" && state.owned.includes("mg"), "買下機槍");
game.shopBuy(3); // 火焰槍 400
ok(state.gold === 300 && state.weapon === "flame" && state.owned.includes("flame"), "買下火焰槍");
game.shopBuy(2); // 雷射 600 → 買不起
ok(state.weapon === "flame" && !state.owned.includes("laser"), "硬幣不夠買不到雷射");
ok(store["cave_blaster_weapon"] === "flame", "武器選擇寫入 localStorage");

// ---------- 14. 商店純買賣 + 關卡賺幣 + 雷射光束 + 攝影機左跟 + 手把校正 ----------
// 14a: 商店不刷門不刷怪（舊版會在商店開門刷怪）
state.mode = "shop";
game.doors.length = 0;
game.enemies.length = 0;
frames(300);
ok(game.doors.length === 0 && game.enemies.length === 0, "商店不刷門不刷怪（純買賣）");

// 14b: 關卡內殺敵賺硬幣＋分數
state.mode = "playing";
game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0;
game.bullets.length = 0; game.beams.length = 0; game.items.length = 0;
player.inv = 999;
player.falling = false; player.onGround = true; player.y = GROUND_Y - 20;
player.facing = 1;
player.x = 3000; state.camX = 2720;
const s0 = state.score, g1 = state.gold;
const vic = game.makeEnemy("red", player.x + 160, GROUND_Y - 10);
game.enemies.push(vic);
hold("KeyJ");
frames(40);
release("KeyJ");
ok(vic.hp <= 0, "關卡內射殺怪物");
ok(state.gold > g1, "關卡殺敵賺硬幣");
ok(state.score > s0, "關卡殺敵加分數");

// 14c: 雷射是一直線光束（不是一顆顆子彈，整排貫穿）
game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0;
game.bullets.length = 0; game.beams.length = 0;
state.weapon = "laser";
const vic2 = game.makeEnemy("turtle", player.x + 300, GROUND_Y + 2); // 龜 hp4，吃一次光束剩 2
vic2.vy = 0; vic2.onGround = true;
game.enemies.push(vic2);
hold("KeyJ");
frames(8);
release("KeyJ");
ok(game.beams.length > 0, "雷射發射光束（beams）");
ok(game.bullets.length === 0, "雷射不產生子彈");
ok(vic2.hp === 2, "光束直線命中造成傷害（dmg 2，龜 4→2）");

// 14d: 攝影機往左跟（玩家逼近左緣時畫面跟左）
game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0;
player.x = state.camX + 100; // 離左緣 100px（小於 140px 門檻）
const cam0 = state.camX;
frames(30);
ok(state.camX < cam0, "玩家靠左時攝影機往左跟");

// 14e: 手把校正（C 進入 → 三步指派 → 存 localStorage → 映射生效）
state.mode = "title";
padActive = true;
key("KeyC");
frames(2);
ok(state.mode === "calib", "標題按 C 進入手把校正");
padButtons[5].pressed = true;  frames(1); // 跳躍 = 5
padButtons[5].pressed = false;
padButtons[6].pressed = true;  frames(1); // 射擊 = 6
padButtons[6].pressed = false;
padButtons[3].pressed = true;  frames(1); // 確認 = 3
padButtons[3].pressed = false;
frames(1);
ok(game.gpMap.jump === 5 && game.gpMap.fire === 6 && game.gpMap.confirm === 3, "校正三步指派完成（跳5/射6/確認3）");
ok(state.mode === "title", "校正完成自動回標題");
ok(store["cave_blaster_gpmap"] !== undefined, "映射寫入 localStorage");
// 映射生效：按 6 號鍵能射擊、按 5 號鍵能跳
const g2 = state.gold;
game.startGame();
player.falling = false; player.onGround = true; player.y = GROUND_Y - 20;
player.inv = 999; player.facing = 1;
game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0;
game.bullets.length = 0; game.beams.length = 0;
state.weapon = "pistol";
padButtons[6].pressed = true;
frames(12);
padButtons[6].pressed = false;
ok(game.bullets.length > 0, "校準後按映射鍵可以射擊");
padButtons[5].pressed = true;
frames(1);
padButtons[5].pressed = false;
ok(player.jumpBuf > 0 || !player.onGround, "校準後按映射鍵可以跳躍");
// 還原給第 15 節（商店 → 新遊戲）
state.mode = "shop";
state.weapon = "flame";
game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0;
game.bullets.length = 0; game.beams.length = 0;

// ---------- 15. 商店 → 新遊戲（武器保留） ----------
key("Enter");
frames(1);
ok(state.mode === "playing" && state.weapon === "flame", "新遊戲保留已選武器");

// ---------- 16. 推進到洞口 → 結局故事 → 商店 ----------
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.x = 200 + 1200 * 10; // 正好 1200m
frames(2);
ok(state.mode === "ending", "推進 1200m 觸發結局故事");
skipStory();
ok(state.mode === "shop", "結局故事結束 → 武器商店");

// ---------- 17. Boss 1：Dave 菇菇大王 ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.inv = 999;
player.rapidT = 60;
game.spawnBoss(player.x + 160);
game.bossIntro = null; // 測試跳過登場特寫的 1.4s 凍結
ok(game.boss && game.boss.type === "king" && game.boss.name.includes("Dave"),
  "第一隻 Boss 是 Dave 菇菇大王");
hold("KeyJ");
for (let i = 0; i < 300 && game.boss; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.boss) {
    game.boss.x = player.x + 160;
    game.boss.y = GROUND_Y - game.boss.h / 2;
    game.boss.vy = 0; game.boss.vx = 0;
  }
}
release("KeyJ");
ok(game.boss === null, "菇菇大王被擊倒");
ok(state.score >= 2000, "擊倒 Boss +2000 分");

// ---------- 18. Boss 2：Tank 巨龜將軍 ----------
game.spawnBoss(player.x + 160, "turtle");
game.bossIntro = null;
ok(game.boss && game.boss.type === "turtle" && game.boss.name.includes("Tank"),
  "第二隻 Boss 是 Tank 巨龜將軍");
game.boss.hp = 1;
for (let i = 0; i < 60 && game.boss; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.boss) {
    if (game.boss.out) { game.endSlowmo(); player.freeze = 0; } // 測試跳過慢動作電影感
    game.boss.x = player.x + 160;
    game.boss.y = GROUND_Y - game.boss.h / 2;
    game.boss.vy = 0; game.boss.vx = 0;
  }
}
ok(game.boss === null, "巨龜將軍被擊倒");

// ---------- 19. Boss 3：怒怒 紅紅怪王（第三隻 Boss，死亡分裂、登場特寫） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.inv = 999;
player.rapidT = 60;
game.spawnBoss(player.x + 160, "red");
ok(game.bossIntro !== null, "Boss 出場觸發登場特寫（黑屏立繪）");
game.bossIntro = null;
ok(game.boss && game.boss.type === "red" && game.boss.name.includes("怒怒"),
  "第三隻 Boss 是 怒怒 紅紅怪王");
game.boss.hp = 3;
hold("KeyJ");
for (let i = 0; i < 60 && game.boss; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.boss) {
    game.boss.x = player.x + 160;
    game.boss.y = GROUND_Y - game.boss.h / 2;
    game.boss.vy = 0; game.boss.vx = 0;
  }
}
release("KeyJ");
ok(game.boss === null, "怒怒 紅紅怪王被擊倒");
ok(game.slowScale === 0.3, "怒怒死亡觸發慢動作電影感（0.3×）");
ok(game.nunuSplitT > 0, "怒奴分裂是延遲的（慢動作電影感，非立即）");
ok(game.enemies.filter((e) => e.type === "nunu").length === 0, "死亡瞬間 3 隻怒奴尚未出現");
player.inv = 999;
frames(130); // 等慢動作（2.0s 真實）＋延遲分裂（0.45 遊戲秒 @0.3× ≈ 1.5s 真實）
const nunu19 = game.enemies.filter((e) => e.type === "nunu");
ok(nunu19.length === 3, "怒怒死亡分裂出 3 隻第二階段「怒奴」");
ok(game.slowScale === 1, "慢動作結束後恢復正常速度");
ok(nunu19[0] && Math.max(...nunu19.map((e) => e.hp)) === 130 && nunu19.every((e) => e.score === 500),
  "怒奴：Boss 等級血量 130、500 分");
ok(nunu19.every((e, i) => e.nunuIdx === i + 1), "3 隻怒奴各有 ①②③ 編號（對應 3 條 Boss 級血量條）");

// ---------- 20. 彈彈怪 bouncy（永遠彈跳、撞牆反彈、吐子彈、30 硬幣） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.x = 400;
player.y = GROUND_Y - 20;
state.camX = player.x - 140; // 穩定鏡頭（主角恰在左跟分界點）
player.inv = 999;
const bo = game.makeEnemy("bouncy", player.x + 120, GROUND_Y + 12);
game.enemies.push(bo);
let minY = 9999;
for (let i = 0; i < 60; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  minY = Math.min(minY, bo.y);
}
ok(bo.hp > 0 && minY < GROUND_Y - 40, "彈彈怪落地就彈跳（彈得很高）");
// 撞左牆反彈
bo.x = state.camX + 10;
bo.vx = -2;
bo.y = GROUND_Y - 20;
bo.vy = 0;
now += 16.7; raf.cb(now);
player.inv = 999;
ok(bo.x >= state.camX + 25 && bo.vx > 0, "彈彈怪撞牆後反彈反向");
// 吐子彈
let sawBullet = false;
for (let i = 0; i < 240 && bo.hp > 0; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.ebullets.some((b) => b.color === "#c8f04a")) sawBullet = true;
}
ok(sawBullet, "彈彈怪會朝玩家吐高彈速子彈");
// 擊倒掉 30 硬幣
const g20 = state.gold;
bo.hp = 1;
player.rapidT = 60;
hold("KeyJ");
for (let i = 0; i < 60 && bo.hp > 0; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  bo.x = player.x + 120; bo.y = GROUND_Y - 14; bo.vy = 0; bo.vx = 0;
}
release("KeyJ");
ok(bo.hp <= 0, "彈彈怪被擊倒");
ok(state.gold === g20 + 30, "擊倒彈彈怪掉 30 硬幣");

// ---------- 21. 鐘乳石柱（擋路、推 1 秒推開、彈彈怪撞它反彈） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.inv = 999;
const pl0 = game.pillars[0]; // 300m 處
player.x = pl0.x - 60;
state.camX = player.x - 140;
hold("KeyD");
for (let i = 0; i < 20; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
release("KeyD");
ok(player.x < pl0.x - 10, "鐘乳石柱擋住主角（280px 高，比二段跳更高）");
hold("KeyD");
for (let i = 0; i < 90; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
release("KeyD");
ok(pl0.opened, "朝柱子按住方向可推下（推到底整根沉掉）");
hold("KeyD");
for (let i = 0; i < 30; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
release("KeyD");
ok(player.x > pl0.x + 10, "推掉後可以通過");
const pl1 = game.pillars[1]; // 550m 處（還是關著）
const bo2 = game.makeEnemy("bouncy", pl1.x - 60, GROUND_Y + 12);
bo2.vx = 2;
game.enemies.push(bo2);
player.x = pl1.x - 260;
state.camX = pl1.x - 300;
for (let i = 0; i < 60 && bo2.vx > 0; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
ok(bo2.vx < 0 && bo2.x <= pl1.x - 25, "彈彈怪撞鐘乳石柱會反彈");

// ---------- 22. 暗影獵手（空中懸浮、子彈無效、俯衝撞擊擊退、甩掉消散） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.x = 3450; // 325m 處（已在 300m 鐘乳石柱之後），觸發 300m 出沒
state.camX = player.x - 140;
player.inv = 0;
for (let i = 0; i < 5; i++) { now += 16.7; raf.cb(now); }
ok(game.shadow !== null, "暗影獵手在 300m 出沒");
// 子彈無效
hold("KeyJ");
for (let i = 0; i < 40; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.shadow) { game.shadow.x = player.x + 100; game.shadow.y = player.y; }
}
release("KeyJ");
ok(game.shadow !== null, "暗影獵手子彈無效（打不死）");
// 碰到：-1 心＋強擊退＋ 2 秒冷卻（強制放到俯衝狀態、鎖死在主角身上）
player.inv = 0;
const hp22 = state.hp;
if (game.shadow) {
  game.shadow.x = player.x + 10;
  game.shadow.y = player.y;
  game.shadow.state = "swoop";
  game.shadow.swoopT = 1;
  game.shadow.vx = 0; game.shadow.vy = 0;
}
now += 16.7; raf.cb(now);
ok(state.hp === hp22 - 2, "碰到暗影獵手扣 1 顆心（2 半顆）");
ok(player.inv >= 1.9, "被碰到後 2 秒冷卻（無敵）");
ok(player.vx < -5, "被碰到後強擊退");
// 甩掉：距離 >700px 保持 5 秒 → 消散
player.inv = 999;
for (let i = 0; i < 360 && game.shadow; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.shadow) game.shadow.x = player.x - 750;
}
ok(game.shadow === null, "離暗影獵手保持遠距離 5 秒後它消散");

// ---------- 23. 機槍固定頻率（間隔不漂移、不會越來越密） ----------
state.weapon = "mg";
game.bullets.length = 0;
const shots23 = [];
hold("KeyJ");
for (let f = 1; f <= 120; f++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  for (const b of game.bullets) if (b.life > 0.98) shots23.push(f); // mg life 1.0，只抓到本幀新生成的
}
release("KeyJ");
const gaps23 = shots23.slice(1).map((f, i) => f - shots23[i]);
ok(shots23.length >= 10, "機槍持續射擊（120 幀 ≥10 發，約 15 發/秒）");
ok(Math.max(...gaps23) - Math.min(...gaps23) <= 1,
  `機槍射擊間隔固定（${Math.min(...gaps23)}-${Math.max(...gaps23)} 幀，不漂移、不越來越密）`);

// ---------- 24. 二段跳＋部分推下鐘乳石即可跳過 ----------
game.startGame();
player.falling = false; player.onGround = true;
player.y = GROUND_Y - 20; player.inv = 999;
const plx24 = game.pillars[0].x;
player.x = plx24 - 700; state.camX = player.x - 140;
// 24a：單跳 vs 雙跳高度
player.y = GROUND_Y - 20; player.onGround = true;
key("Space");
let minY1 = 9999;
for (let i = 0; i < 45; i++) { now += 16.7; raf.cb(now); player.inv = 999; minY1 = Math.min(minY1, player.y); }
player.x = plx24 - 700; state.camX = player.x - 140;
player.y = GROUND_Y - 20; player.onGround = true;
key("Space");
for (let i = 0; i < 12; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
key("Space"); // 空中第二段
let minY2 = 9999;
for (let i = 0; i < 45; i++) { now += 16.7; raf.cb(now); player.inv = 999; minY2 = Math.min(minY2, player.y); }
ok(minY2 < minY1 - 50, `二段跳：空中再跳一次，明顯比單跳高（單跳 ${(GROUND_Y - 20 - minY1).toFixed(0)}px vs 雙跳 ${(GROUND_Y - 20 - minY2).toFixed(0)}px）`);
// 24b：部分推下（不推整根）＋二段跳跳過
player.x = plx24 - 60; player.y = GROUND_Y - 20; player.onGround = true;
hold("KeyD");
for (let i = 0; i < 48; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
release("KeyD");
ok(game.pillars[0].sunk > 0.4 && game.pillars[0].sunk < 1,
  `按住方向可把柱子推矮（推下 ${Math.round(game.pillars[0].sunk * 100)}%，未整根推掉）`);
player.x = plx24 - 90; player.y = GROUND_Y - 20; player.onGround = true;
hold("KeyD");
key("Space");
for (let i = 0; i < 12; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
key("Space");
for (let i = 0; i < 90 && player.x < plx24 + 30; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
release("KeyD");
ok(player.x > plx24 + 30, "部分推矮後可二段跳跳過鐘乳石柱（不用全部推掉）");

// ---------- 25. 暗影獵手俯衝撞未推下的鐘乳石柱→反彈（石柱＝護盾） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.x = 3450;
state.camX = player.x - 140;
player.inv = 999;
for (let i = 0; i < 5; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
ok(game.shadow !== null, "25. 暗影獵手已出沒");
const pl25 = game.pillars[0]; // 300m 鐘乳石柱
player.x = pl25.x + 200; // 主角在柱子右邊（俯衝目標）
game.shadow.state = "swoop";
game.shadow.swoopT = 2;
game.shadow.x = pl25.x - 300;
game.shadow.y = GROUND_Y - 175;
game.shadow.vx = 8; game.shadow.vy = 2;
let bounced25 = false;
for (let i = 0; i < 120; i++) {
  now += 16.7; raf.cb(now);
  player.inv = 999;
  if (game.shadow && game.shadow.state === "back") { bounced25 = true; break; }
}
ok(bounced25 && game.shadow && game.shadow.vx < 0, "俯衝撞未推下的鐘乳石柱→反彈（石柱＝護盾）");

// ---------- 26. 暗影獵手 45 秒後飛離＋Boss 排程（怒怒最後） ----------
game.startGame();
player.falling = false;
player.onGround = true;
player.y = GROUND_Y - 20;
player.x = 3450;
state.camX = player.x - 140;
player.inv = 999;
for (let i = 0; i < 5; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
game.shadow.t = 45; // 已滿 45 秒
for (let i = 0; i < 5 && game.shadow && game.shadow.state !== "leaving"; i++) {
  now += 16.7; raf.cb(now); player.inv = 999;
}
ok(game.shadow && game.shadow.state === "leaving", "暗影獵手約 45 秒後開始飛離");
for (let i = 0; i < 120 && game.shadow; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
ok(game.shadow === null, "飛離後消失");
ok(game.BOSS_SCHEDULE.map((b) => b.type).join(",") === "king,turtle,red",
  "Boss 排程：400 King → 700 Tank → 1000 怒怒（最兇的放最後）");

// ---------- 27. 關卡輪替（新的突擊：主題輪流換，重試不換） ----------
ok(game.THEMES.main && game.THEMES.ice && game.THEMES.lava,
  "三套關卡主題已定義（紫晶深洞 / 冰晶洞 / 熔岩洞）");
ok(game.theme.name === game.THEMES[game.caveKey].name,
  "目前主題與關卡一致（" + game.caveKey + "）");
const before = game.caveKey;
game.newRaid();
ok(game.caveKey !== before && game.theme.name === game.THEMES[game.caveKey].name,
  "新的突擊 → 換下一個關卡主題（" + game.caveKey + "）");
const mid = game.caveKey;
game.newRaid();
ok(game.caveKey !== mid, "再輪替一次（" + game.caveKey + "）");
game.newRaid();
ok(game.caveKey === before, "三次輪替後回到原本主題（循環 main/ice/lava）");
game.startGame(); // 重試（R）不換關
ok(game.caveKey === before, "重試（startGame）不換關卡");

// ---------- 28. Boss 專屬舞台（巨門前 100m 換該 Boss 配色、擊倒後還原） ----------
game.startGame();
player.falling = false; player.onGround = true; player.y = GROUND_Y - 20;
player.inv = 999;
player.x = 3250; // 305m：進入 Dave 的領地（400-100=300m）
state.camX = player.x - 140;
for (let i = 0; i < 3; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
ok(game.bossStage === "king" && game.theme.crystal1 === game.BOSS_THEMES.king.crystal1,
  "Boss 巨門前 100m → 切換 Dave 專屬配色");
game.spawnBoss(player.x + 120); // 用排程型別（king），擊倒後不會重觸發舞台
game.bossIntro = null;
game.boss.hp = 1;
hold("KeyJ");
for (let i = 0; i < 60 && game.boss; i++) {
  now += 16.7; raf.cb(now); player.inv = 999;
  if (game.boss) {
    game.boss.x = player.x + 120;
    game.boss.y = GROUND_Y - 40;
    game.boss.vx = 0; game.boss.vy = 0;
  }
}
release("KeyJ");
ok(game.boss === null, "Dave 擊倒");
ok(game.bossStage === null && game.theme.crystal1 === game.THEMES[game.caveKey].crystal1,
  "Boss 擊倒 → 還原關卡主題");

// ---------- 29. 冰洞機制：地面超滑 ----------
(function () {
  while (game.caveKey !== "ice") game.newRaid(); // 轉到冰洞（最多 3 次）
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  game.player.vx = 4;
  frames(30);
  const iceV = game.player.vx;
  while (game.caveKey !== "main") game.newRaid(); // 主洞對照
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  game.player.vx = 4;
  frames(30);
  const mainV = game.player.vx;
  ok(iceV > 1, `冰洞打滑：30 幀後剩餘速度 ${iceV.toFixed(2)} > 1`);
  ok(mainV < 0.2, `主洞對照：30 幀後剩餘速度 ${mainV.toFixed(2)} < 0.2`);
})();

// ---------- 30. 暗影獵手隨機懸浮 ----------
(function () {
  game.startGame();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  game.player.x = 3450; // 325m（遠離 300m 觸發點，避免自動生成）
  state.camX = game.player.x - 280;
  frames(6);
  game.shadow = { x: game.player.x, y: 470 - 175, vx: 0, vy: 0, t: 0, fade: 1, farT: 0, dying: false, state: "hover", swoopT: 0, swoopCd: 99, hoverY: 470 - 175, hoverOff: 0, driftT: 1 };
  const ys = new Set();
  for (let i = 0; i < 6; i++) {
    frames(30); // 共 3 秒，driftT 0.9~2.3s 保證至少換一次
    ys.add(Math.round(game.shadow.hoverY));
  }
  ok(ys.size > 1, `暗影懸浮高度漂移：採樣到 ${ys.size} 種不同高度`);
  const off = 470 - game.shadow.hoverY;
  ok(off >= 140 && off <= 215, `懸浮高度在 140~215px 範圍內（${off.toFixed(0)}px）`);
  game.shadow = null;
})();

// ---------- 31. 環境粒子：熔岩火星 / 冰晶 ----------
(function () {
  while (game.caveKey !== "lava") game.newRaid();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  frames(45);
  const embers = game.particles.filter((p) => p.rise && (p.color === "#ff8a3c" || p.color === "#ffd070"));
  ok(embers.length > 3, `熔岩洞火星：${embers.length} 顆上升火星粒子`);
  while (game.caveKey !== "ice") game.newRaid();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  frames(45);
  const snow = game.particles.filter((p) => p.soft && (p.color === "#d5f2ff" || p.color === "#7fd4ff"));
  ok(snow.length > 3, `冰洞冰晶：${snow.length} 顆飄落冰晶粒子`);
})();

// ---------- 32. Tank 縮殼週期：伸頸（可傷）→ 縮殼（無敵、衝撞 3 次＋落石）→ 終結形態（凍結、一發打死） ----------
(function () {
  game.startGame();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  game.spawnBoss(game.player.x + 200, "turtle"); // 指定類型（不消耗排程）
  game.bossIntro = null;
  frames(3);
  const b = game.boss;
  ok(b.shell === false && b.phase === "extend", "Tank 初始伸頸（可攻擊）");
  // 強制縮殼
  b.extT = 0.05;
  frames(4);
  ok(b.shell === true && b.phase === "shell", "伸頸結束 → 縮進龜殼（無敵）");
  // 子彈對龜殼無效
  const hp0 = b.hp;
  b.x = game.player.x + 100;
  hold("KeyJ");
  frames(20);
  release("KeyJ");
  ok(b.hp === hp0, "龜殼狀態子彈不掉血（無敵）");
  // 3 次衝撞（起跳→自然落地，每次約 25 幀）
  for (let c = 0; c < 3; c++) {
    b.pauseT = 0.05;
    frames(4);
    ok(b.charging === true, `縮殼衝撞 #${c + 1} 觸發`);
    frames(35); // 等衝撞落地
  }
  ok(game.rockWarns.length === 9, "第 3 次衝撞 → 落石（9 個預警）");
  ok(b.toExtend === true, "第 3 次衝撞後 → 準備伸頸");
  frames(140); // 預警 0.8~1.2s＋石頭落地
  ok(game.groundRocks.length >= 3, `落石接地變碎石：${game.groundRocks.length} 塊`);
  ok(b.shell === false && b.phase === "extend", "衝撞＋落石結束 → 伸頸（可攻擊）");
  // 伸頸狀態 HP 歸零 → 終結形態（主角凍結、一發子彈解決）
  b.hp = 1;
  b.x = game.player.x + 80;
  frames(2);
  hold("KeyJ"); frames(1); release("KeyJ"); // 單發
  frames(15);
  ok(b.out === true && b.hp === 1, "HP 歸零 → 殼裡掉出來（HP 1）");
  ok(game.player.freeze > 0, "終結登場時主角短暫凍結");
  ok(game.slowScale === 0.35, "終結形態登場觸發慢動作電影感（0.35×）");
  game.endSlowmo(); // 測試跳過慢動作等待
  frames(80); // 等主角凍結結束（1.1s ≈ 66 幀）
  hold("KeyJ"); frames(1); release("KeyJ"); // 再單發
  frames(15);
  ok(game.boss === null, "終結形態一發子彈擊殺");
})();

// ---------- 33. 怒奴集體攻擊：3 隻分散畫面邊緣（有高有低）→ 同時朝主角齊射 → 歸位循環 ----------
(function () {
  game.startGame();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  for (let i = -1; i <= 1; i++) game.enemies.push(game.makeEnemy("nunu", game.player.x + 300 + i * 52, GROUND_Y - 13));
  game.resetNunuCd(0.5);
  frames(30); // 倒數 0.5s → 觸發
  const gs = game.enemies.filter((e) => e.type === "nunu");
  ok(gs.length === 3 && gs.every((e) => e.gmode === "gather" || e.gmode === "hold"), "3 隻怒奴進入集體攻擊模式（飛向 slot）");
  frames(80); // 到齊＋部分已齊射
  const xs = gs.map((e) => e.x), ys = gs.map((e) => e.y);
  ok(Math.max(...xs) - Math.min(...xs) > 300, `3 隻分散到畫面兩側（橫距 ${Math.max(...xs) - Math.min(...xs) | 0}px）`);
  ok(Math.max(...ys) - Math.min(...ys) > 50, `高度有高有低（縱距 ${Math.max(...ys) - Math.min(...ys) | 0}px）`);
  const shots = game.ebullets.filter((b) => b.color === "#c03535");
  ok(shots.length >= 3, `同時朝主角齊射（彈雨）：${shots.length} 發怒奴子彈`);
  frames(150); // 等全部歸位
  ok(gs.every((e) => !e.gmode), "集體攻擊結束 → 全部歸位（恢復平常攻擊）");
  ok(game.nunuGroup === "idle", "循環重設，等待下次集體攻擊");
})();

// ---------- 34. 武器升級（商店按鍵 4/5）：傷害/射速強化、上限、持久化 ----------
(function () {
  state.mode = "shop"; // 純函式測試，不需跑幀
  const d0 = state.upgDmg, r0 = state.upgRate;
  const w = game.WEAPONS[state.weapon];
  state.gold = 1000;
  game.buyUpgrade("dmg");
  ok(state.upgDmg === d0 + 1, "按 4 傷害強化：Lv+1");
  ok(state.gold === 1000 - 120, "傷害強化 Lv1 花 120 硬幣");
  ok(Math.abs(game.weaponDmg() - (w.dmg + 0.5)) < 1e-9, "武器傷害 = 基礎 + 升級等階×0.5（平衡：原 +1）");
  game.buyUpgrade("rate");
  ok(state.upgRate === r0 + 1, "按 5 射速強化：Lv+1");
  ok(Math.abs(game.weaponCd() - w.cd * 0.93) < 1e-9, "武器射擊間隔 = 基礎 ×0.93（平衡：原 ×0.9）");
  state.gold = 0;
  game.buyUpgrade("dmg");
  ok(state.upgDmg === d0 + 1, "硬幣不足：等階不變");
  state.gold = 99999;
  while (state.upgDmg < 5) game.buyUpgrade("dmg");
  while (state.upgRate < 5) game.buyUpgrade("rate");
  ok(state.upgDmg === 5 && state.upgRate === 5, "兩種升級都可升到 Lv5");
  game.buyUpgrade("dmg");
  ok(state.upgDmg === 5, "滿級後不能再升");
  ok(store["cave_blaster_upg_dmg"] === "5" && store["cave_blaster_upg_rate"] === "5", "升級等階存入 localStorage");
  state.upgDmg = d0; state.upgRate = r0; // 還原，避免影響後續測試的武器行為
})();

// ---------- 35. 成就系統：事件解鎖 / 持久化 / 標題成就頁 ----------
(function () {
  // 清場（34 測試的 buyUpgrade 已觸發過部分成就）
  game.enterShop();
  state.gold = 50;
  state.upgDmg = 0; state.upgRate = 0;
  state.owned.length = 0; state.owned.push("pistol");
  game.achUnlocked.length = 0;
  const p = game.prog;
  p.kills = 0; p.bossKing = 0; p.bossTurtle = 0; p.bossRed = 0; p.raids = 0;
  ok(game.ACHIEVEMENTS.length === 12, "定義 12 個成就");
  game.checkAch();
  ok(game.achUnlocked.length === 0, "初始全未解鎖");

  // 1) 首殺：真實射殺一隻巨龜（走 damageEnemy 完整路徑；巨龜貼地不跳，水平射擊穩命中）
  player.inv = 999;
  const er = game.makeEnemy("turtle", player.x + 120, GROUND_Y - 10);
  er.vy = 0; er.onGround = true;
  game.enemies.push(er);
  hold("KeyJ"); frames(15); release("KeyJ"); // 平衡後龜 4hp：MG 需 4 發（按住 15 幀發 5 發）
  frames(15);
  ok(game.prog.kills === 1, "擊殺有計入累計進度");
  ok(game.achUnlocked.includes("first_kill"), "成就：初嘗鮮血解鎖");
  game.prog.kills = 50; game.checkAch();
  ok(game.achUnlocked.includes("ten_kills") && game.achUnlocked.includes("fifty_kills"),
     "成就：怪物獵人＋深谷屠夫解鎖");

  // 2) Boss 類（真實 killBoss 路徑已在 3 Boss 擊殺測試驗證）
  game.prog.bossKing = 1; game.prog.bossTurtle = 1; game.prog.bossRed = 1;
  game.checkAch();
  ok(game.achUnlocked.includes("first_boss") && game.achUnlocked.includes("king_kill"),
     "成就：討伐者＋菇菇斬解鎖");
  ok(game.achUnlocked.includes("tank_kill") && game.achUnlocked.includes("red_kill"),
     "成就：平定巨龜＋怒平解鎖");

  // 3) 清關
  game.prog.raids = 1; game.checkAch();
  ok(game.achUnlocked.includes("escape"), "成就：深谷逃脫解鎖");

  // 4) 硬幣大亨：1000 硬幣
  state.gold = 1000; game.checkAch();
  ok(game.achUnlocked.includes("rich"), "成就：硬幣大亨解鎖");

  // 5) 全武裝：集齊 4 種武器（走真實 shopBuy 路徑）
  state.gold = 5000;
  game.shopBuy(1); game.shopBuy(2); game.shopBuy(3);
  ok(state.owned.length === 4, "集齊 4 種武器");
  ok(game.achUnlocked.includes("all_weapons"), "成就：全武裝解鎖");

  // 6) 升級類：首購升級＋任一滿級
  game.buyUpgrade("dmg");
  ok(game.achUnlocked.includes("upgraded"), "成就：武裝升級解鎖");
  while (state.upgDmg < 5) game.buyUpgrade("dmg");
  ok(state.upgDmg === 5, "傷害強化升到 Lv5");
  ok(game.achUnlocked.includes("maxed"), "成就：極致武裝解鎖");

  // 7) 持久化
  ok(game.achUnlocked.length === 12, "12 個成就全部解鎖");
  ok(JSON.parse(store["cave_blaster_ach"]).length === 12, "解鎖狀態存入 localStorage");
  ok(store["cave_blaster_prog"] !== undefined, "累計進度存入 localStorage");

  // 8) 標題畫面成就頁：選單循環到第 3 項 → Enter 進入 → Esc 返回
  state.mode = "title";
  key("ArrowDown"); key("ArrowDown");
  key("Enter");
  ok(state.mode === "ach", "標題選單第 3 項 Enter 進入成就頁");
  frames(2);
  key("Escape");
  ok(state.mode === "title", "Esc 返回標題");

  // 清場還原
  state.mode = "shop";
  state.upgDmg = 0; state.upgRate = 0; state.gold = 50;
})();

// ---------- 36. 站著水平射穩命中小紅怪（1px 擦頭修正回歸） ----------
(function () {
  game.enterShop();
  state.weapon = "mg";
  const rand = Math.random;
  Math.random = () => 0.999; // 禁隨機跳躍/掉落，保證小紅怪貼地
  player.inv = 999;
  const er = game.makeEnemy("red", player.x + 120, GROUND_Y + 2);
  er.vy = 0; er.onGround = true;
  game.enemies.push(er);
  hold("KeyJ"); frames(10); release("KeyJ");
  frames(12);
  Math.random = rand;
  ok(er.hp <= 0, "水平子彈命中貼地小紅怪（修正前差 1px 擦頭）");
})();

// ---------- 37. 封面圖：Node 環境無 Image 自動略過、標題畫面正常渲染 ----------
(function () {
  ok(game.coverImg == null, "Node 環境無 Image：封面自動略過（瀏覽器則載入 docs/game-cover.png）");
  state.mode = "title";
  frames(2);
  ok(state.mode === "title", "無封面時標題畫面正常渲染");
  state.mode = "shop";
})();

// ---------- 38. BGM：開關切換＋持久化＋無 AudioContext 安全 ----------
(function () {
  ok(game.BGM && typeof game.setBgm === "function", "BGM 引擎與 setBgm 已匯出");
  game.setBgm(false);
  ok(game.BGM.on === false && store["cave_blaster_bgm"] === "0", "BGM 關：寫入 localStorage=0");
  game.bgmTick(); // Node 沒有 AudioContext，不應崩
  game.setBgm(true);
  ok(game.BGM.on === true && store["cave_blaster_bgm"] === "1", "BGM 開：寫入 localStorage=1");
  game.bgmTick();
  frames(2); // frame 每幀調 bgmTick，無音訊環境安全
})();

// ---------- 39. 慢動作系統：startSlowmo/tickSlowmo/endSlowmo＋frame() 真的縮時 ----------
(function () {
  ok(game.slowScale === 1, "預設正常速度（slowScale=1）");
  game.startSlowmo(0.3, 2);
  ok(game.slowScale === 0.3, "startSlowmo(0.3, 2s) 設定時間尺度");
  game.enterShop();
  const e = game.makeEnemy("red", 600, GROUND_Y + 2);
  e.vy = 0; e.onGround = true;
  game.enemies.push(e);
  const x0 = e.x;
  frames(30); // 30 真實幀（0.5s）→ 0.3× 下只約 9 個遊戲幀
  const slowMove = Math.abs(e.x - x0);
  ok(slowMove > 8 && slowMove < 40, `慢動作中全世界以 0.3× 推進（30 真實幀小紅怪只走 ${slowMove.toFixed(1)}px，正常應 ~78px）`);
  game.endSlowmo();
  ok(game.slowScale === 1, "endSlowmo 立刻恢復正常速度");
  const x1 = e.x;
  frames(30);
  ok(Math.abs(e.x - x1) > 50, "恢復正常速度後移動量也正常");
  game.startSlowmo(0.3, 0.1);
  game.tickSlowmo(0.2);
  ok(game.slowScale === 1, "tickSlowmo：真實倒數結束後自動恢復正常速度");
})();

// ---------- 40. 怒奴重生：Boss 級身形＋獨立向量繪製＋血量條數據 ----------
(function () {
  game.startGame();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  const n = game.makeEnemy("nunu", game.player.x + 200, GROUND_Y + 2);
  n.nunuIdx = 1;
  game.enemies.push(n);
  ok(n.w === 64 && n.h === 60, "怒奴身形為 Boss 級 64×60（原 28×26，與怒怒 Boss 第一階段同級）");
  ok(n.maxHp === 130 && n.hp === 130, "怒奴有 maxHp（3 條 Boss 級血量條的依據；平衡：90→130）");
  frames(3); // 向量繪製（尖刺/兇臉/翻轉）實際執行不崩
  ok(game.enemies.includes(n), "怒奴在世界中正常存活與移動");
  n.hp = 0;
  frames(2); // 死亡路徑 OK
})();

// ---------- 41. 武器平衡：升級天花板削弱，小怪不再被秒殺 ----------
(function () {
  const d0 = state.upgDmg, r0 = state.upgRate, w0 = state.weapon;
  // (a) 升級公式：傷害每級 +0.5（原 +1）、射速每級 ×0.93（原 ×0.9）
  state.weapon = "mg"; state.upgDmg = 5; state.upgRate = 5;
  ok(Math.abs(game.weaponDmg() - 3.5) < 1e-9, "滿級機槍傷害 = 1+5×0.5 = 3.5（原 6）");
  ok(Math.abs(game.weaponCd() - 0.067 * Math.pow(0.93, 5)) < 1e-9, "滿級機槍射擊間隔 = 基礎 ×0.93^5（原 ×0.9^5）");
  ok(game.weaponDmg() < 4, "滿級傷害（3.5）< 龜 HP（4）：滿改也秒不掉小怪");
  // (b) 基礎手槍對龜（4hp）：每發 1 傷害，需 4 發（原 3 發）
  state.weapon = "pistol"; state.upgDmg = 0; state.upgRate = 0;
  game.startGame();
  game.player.falling = false; game.player.onGround = true; game.player.y = GROUND_Y - 20;
  game.player.inv = 999;
  game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0; game.bullets.length = 0;
  const t41 = game.makeEnemy("turtle", game.player.x + 120, GROUND_Y + 2);
  t41.vy = 0; t41.onGround = true;
  game.enemies.push(t41);
  hold("KeyJ");
  for (let i = 0; i < 40 && t41.hp > 0; i++) {
    now += 16.7; raf.cb(now);
    game.player.inv = 999;
    t41.x = game.player.x + 120; t41.y = GROUND_Y - 12; t41.vx = 0;
  }
  release("KeyJ");
  ok(t41.hp <= 0, "基礎手槍需 4 發擊殺龜（4hp；原 3hp 只要 3 發）");
  state.upgDmg = d0; state.upgRate = r0; state.weapon = w0;
})();

// ---------- 42. 跳躍鍵改空白：↑ / W 純瞄準（不再跳） ----------
(function () {
  game.startGame();
  player.falling = false; player.dead = false; player.onGround = true; player.y = GROUND_Y - 20; player.vx = 0;
  player.inv = 999;
  game.doors.length = 0; game.enemies.length = 0; game.ebullets.length = 0; game.bullets.length = 0;
  // (a) 空白鍵 = 跳
  key("Space");
  for (let i = 0; i < 3; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
  ok(!player.onGround && player.vy < 0, "空白鍵 = 跳躍（離地、向上）");
  // (b) ↑ 不再跳（舊行為 ArrowUp = 跳）
  player.vy = 0; player.onGround = true; player.y = GROUND_Y - 20; player.falling = false; player.vx = 0;
  hold("ArrowUp");
  for (let i = 0; i < 6; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
  ok(player.onGround, "按住 ↑ 不再跳躍（只瞄準）");
  // (c) ↑ + 射擊 = 斜上射（子彈向上）
  hold("KeyJ");
  for (let i = 0; i < 14; i++) { now += 16.7; raf.cb(now); player.inv = 999; }
  const upBullets = game.bullets.filter((b) => b.vy < -1);
  release("KeyJ");
  release("ArrowUp");
  ok(upBullets.length > 0, "↑ + 射擊 = 斜上射（子彈有向上速度）");
})();

// ---------- 43. 商店 ↑↓ 游標選單：鍵盤/手把操作 ----------
(function () {
  game.enterShop();
  ok(game.shopSel === 0, "商店游標從第 1 列開始");
  // (a) 鍵盤 ↑↓ 移動（含回繞）
  key("ArrowDown");
  ok(game.shopSel === 1, "ArrowDown → 第 2 列");
  key("ArrowUp");
  ok(game.shopSel === 0, "ArrowUp → 回第 1 列");
  key("ArrowUp");
  ok(game.shopSel === 6, "ArrowUp 回繞 → 第 7 列（開始新的突擊）");
  // (b) 空白確認第 7 列 = 開始新的突擊（離開商店）
  key("Space");
  ok(state.mode !== "shop", "確認「開始」列 = 新的突擊（離開商店）");
  game.enterShop();
  // (c) 鍵盤確認第 4 列（傷害升級）
  for (let i = 0; i < 4; i++) key("ArrowDown");
  ok(game.shopSel === 4, "移到第 4 列（傷害升級）");
  state.gold = 500;
  key("Space");
  ok(state.upgDmg === 1 && state.gold === 380, "確認第 4 列 = 買傷害升級 Lv1（-120 硬幣）");
  state.upgDmg = 0;
  // (d) 手把：十字鍵移動 + 確認鍵購買（14e 校準後 gpMap.confirm）
  padActive = true;
  game.enterShop();
  padButtons[13].pressed = true; frames(1); padButtons[13].pressed = false; frames(1);
  ok(game.shopSel === 1, "手把 ↓（13）移動游標");
  for (let i = 0; i < 3; i++) { padButtons[13].pressed = true; frames(1); padButtons[13].pressed = false; frames(1); }
  ok(game.shopSel === 4, "手把 ↓ 連續移到第 4 列");
  state.gold = 500;
  padButtons[game.gpMap.confirm].pressed = true; frames(1); padButtons[game.gpMap.confirm].pressed = false; frames(1);
  ok(state.upgDmg === 1, "手把確認鍵（映射）= 購買游標列");
  padActive = false;
  frames(2);
  state.upgDmg = 0; state.gold = 500;
})();

// ---------- 44. 暫停 / 死亡選單：遊戲中可回標題（解決「進遊戲後回不了首頁」） ----------
(function () {
  // (a) 暫停選單：P → ↑↓ 移動 → 空白確認「回標題」
  game.startGame();
  player.falling = false; player.onGround = true; player.y = GROUND_Y - 20; player.vx = 0; player.inv = 999;
  key("KeyP");
  ok(state.paused === true, "P = 暫停");
  key("ArrowDown");
  ok(game.pauseSel === 1, "暫停選單 ↓ 選中「回標題」");
  key("Space");
  ok(state.mode === "title" && state.paused === false, "暫停選單確認「回標題」（暫停 → 標題）");
  // (b) 死亡選單：3 項游標 → 「回標題」
  game.startGame();
  player.dead = true; player.deadT = 0; state.mode = "dying";
  player.falling = false; player.onGround = true; player.y = GROUND_Y - 20; player.inv = 0;
  for (let i = 0; i < 120 && state.mode !== "gameover"; i++) { now += 16.7; raf.cb(now); }
  ok(state.mode === "gameover", "死亡動畫結束 → gameover 畫面");
  ok(game.overSel === 0, "死亡選單游標預設在「再試一次」");
  key("ArrowDown"); key("ArrowDown");
  ok(game.overSel === 2, "↓↓ 移到「回標題」");
  key("Space");
  ok(state.mode === "title", "死亡選單確認「回標題」（死亡 → 標題）");
  // (c) T 快捷鍵
  game.startGame();
  player.dead = true; player.deadT = 0; state.mode = "dying";
  player.falling = false; player.onGround = true; player.y = GROUND_Y - 20; player.inv = 0;
  for (let i = 0; i < 120 && state.mode !== "gameover"; i++) { now += 16.7; raf.cb(now); }
  key("KeyT");
  ok(state.mode === "title", "T 快捷鍵：死亡畫面 → 標題");
})();

// ---------- 45. steamOS 手把備援：Enter 射擊＋校正畫面診斷不崩 ----------
(function () {
  // (a) Enter = 射擊備援鍵（steamOS 手把常被轉成鍵盤輸入，A 多映射到 Enter）
  game.startGame();
  player.falling = false; player.onGround = true; player.y = GROUND_Y - 20; player.inv = 999;
  const b0 = game.bullets.length;
  hold("Enter"); frames(5); release("Enter");
  ok(game.bullets.length > b0, "Enter 也能射擊（steamOS 模擬手把備援）");
  // (b) 無手把時的校正畫面：診斷行＋steamOS 提示可繪製（不崩）
  padActive = false;
  frames(2);
  state.mode = "calib";
  let drew = false;
  try { frames(3); drew = true; } catch (e) {}
  ok(drew, "校正畫面（未偵測到手把）診斷＋提示繪製不崩");
  state.mode = "title";
  frames(2);
})();

// ---------- 46. centeredPanel 行距回歸：字串的 .big 是 String.prototype.big（truthy），曾誤用 52px 行高把面板撐出畫面 ----------
(function () {
  const ys = [];
  const orig = sharedCtx.fillText;
  sharedCtx.fillText = (t, x, y) => ys.push(y);
  game.centeredPanel(["a", "b", "", "c", { t: "d" }, "e"]);
  sharedCtx.fillText = orig;
  ok(ys.length === 6, "centeredPanel 繪出全部 6 行");
  const step = ys.length >= 2 ? ys[1] - ys[0] : -1;
  const uniform = ys.every((yy, i) => Math.abs(yy - (ys[0] + i * step)) < 0.01);
  ok(step === 30 && uniform, "字串/物件行距一致 30px（String.prototype.big bug 會讓字串行吃 52px）");
  ok(ys.length > 0 && ys[ys.length - 1] <= 540, "centeredPanel 末行在畫面內");
})();

// ---------- 47. 標題畫面最壞情況（硬幣＋武器＋成就）：所有文字不超出畫面底邊 ----------
(function () {
  state.gold = 300;
  state.owned = ["pistol", "mg"];
  game.achUnlocked.push("first_kill");
  state.mode = "title";
  const drawn = [];
  const orig = sharedCtx.fillText;
  sharedCtx.fillText = (t, x, y) => drawn.push([String(t), y]);
  frames(2);
  sharedCtx.fillText = orig;
  ok(drawn.length > 0, "標題畫面文字有繪製");
  const offscreen = drawn.filter((d) => d[1] > 540);
  const maxY = drawn.length ? Math.max(...drawn.map((d) => d[1])) : 0;
  ok(offscreen.length === 0, `無文字超出畫面底邊（最底一行 y=${maxY.toFixed(0)}，Node 無封面時行數最多）`);
  state.mode = "shop";
})();

// ---------- 48. 主角命名 RDD8（調整版）：標題不提前破梗＋結尾紅色無人機掃描暗示 ----------
(function () {
  // (a) 不提前破梗：標題畫面不點名主角（只露在結尾）
  state.mode = "title";
  const texts = [];
  const orig = sharedCtx.fillText;
  sharedCtx.fillText = (t) => texts.push(String(t));
  frames(2);
  sharedCtx.fillText = orig;
  ok(!texts.some((t) => t.includes("主角 RDD8")), "標題畫面不提前點名主角（不 spoiler）");
  // (b) 結尾故事：紅色無人機掃描結果暗示主角叫 RDD8
  ok(game.STORY_END.some((l) => l.includes("紅色無人機")), "結尾：遠處天空忽然亮起一架紅色無人機");
  ok(game.STORY_END.some((l) => l.includes("目標 RDD8，確認存活")), "結尾掃描結果暗示主角名叫 RDD8");
  state.mode = "shop";
})();

// ---------- 49. 手機觸控選單：◀▶＝移動游標（商店/死亡/標題/暫停）＋跳＝確認 ----------
(function () {
  // (a) 商店：◀▶ 移動游標＋跳確認購買（手機買武器）
  game.enterShop();
  state.owned = ["pistol"]; state.gold = 500;
  const sel0 = game.shopSel;
  game.touch.rightEdge = true; frames(1);
  ok(game.shopSel === (sel0 + 1) % game.SHOP_ROWS, "觸控 ▶ 商店游標下移一行");
  game.touch.leftEdge = true; frames(1);
  ok(game.shopSel === sel0, "觸控 ◀ 商店游標回到原列");
  const n = (1 - game.shopSel + game.SHOP_ROWS) % game.SHOP_ROWS; // 走到機槍（列 1）
  for (let i = 0; i < n; i++) { game.touch.rightEdge = true; frames(1); }
  ok(game.shopSel === 1, "觸控 ▶ 移動游標到機槍列");
  game.touch.actionQueued = true; frames(1);
  ok(state.owned.includes("mg"), "觸控跳確認游標列：成功買下機槍");
  ok(state.gold === 200, "手機購買扣硬幣正確（500-300=200）");
  // (b) 死亡選單：◀▶ 選擇＋跳確認（手機死亡後也能進商店）
  state.mode = "gameover";
  game.touch.leftEdge = true; frames(1);
  ok(game.overSel === 0, "觸控 ◀ 死亡選單回到「再試一次」");
  game.touch.rightEdge = true; frames(1);
  ok(game.overSel === 1, "觸控 ▶ 死亡選單移到「去武器商店」");
  game.touch.actionQueued = true; frames(1);
  ok(state.mode === "shop", "觸控跳確認：死亡畫面可進武器商店");
  // (c) 標題選單：◀▶ 移動（手把校正/成就也選得到）
  state.mode = "title";
  const t0 = game.titleSel;
  game.touch.rightEdge = true; frames(1);
  ok(game.titleSel === (t0 + 1) % 3, "觸控 ▶ 標題選單下移一項（循環）");
  game.touch.leftEdge = true; frames(1);
  ok(game.titleSel === t0, "觸控 ◀ 標題選單回到原項（循環）");
  // (d) 暫停選單：◀▶＋跳確認回標題（手機遊戲中也能退出）
  game.startGame();
  state.paused = true;
  game.touch.rightEdge = true; frames(1);
  ok(game.pauseSel === 1, "觸控 ▶ 暫停選單移到「回標題」");
  game.touch.actionQueued = true; frames(1);
  ok(state.mode === "title" && !state.paused, "觸控跳確認：暫停畫面回標題");
  state.mode = "shop";
})();

// ---------- 結果 ----------
console.log(
  `mode=${state.mode} score=${state.score} hp=${state.hp} ` +
  `gold=${state.gold} weapon=${state.weapon} owned=${state.owned.join(",")}`
);
if (failed) {
  console.error(failed + " 個測試失敗");
  process.exit(1);
}
console.log("SMOKE OK 🤖");
