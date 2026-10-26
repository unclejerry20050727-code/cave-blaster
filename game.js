"use strict";

// =============================================================
//  深谷突擊 Cave Blaster
//  2D 側視角射擊遊戲（網頁版 / 純 HTML5 Canvas，無依賴）
//
//  流程：標題 → 開場故事 → 關卡（推進 1200m 到洞口）→ 結局故事 → 武器商店
//        死亡 → 死亡動畫（趴下+靈魂飄走）→ 結束畫面（可回商店）
//  經濟：關卡內殺敵賺硬幣（紅8/菇15/龜25、Boss +100），關卡間的武器商店花錢買槍
//
//  怪物（會從洞門竄跳出來，也會反擊！）：
//    - 菇菇怪 mushroom：彈跳靠近，會丟拋物線孢子（HP2, 100分）
//    - 烏龜   turtle：  慢慢走向你，會噴三發殼刺（HP3, 200分）
//    - 紅紅怪 red：     又小又多又兇，會朝你吐酸液（HP1, 50分）
//    - 怒奴 nunu：      怒怒死後分裂出的第二階段——更暗紅、更兇（HP6, 500分、三發酸液）
//    - 彈彈怪 bouncy：  永遠彈跳＋撞牆反彈，高彈速直線子彈（HP3, 250分）
//  地形：鐘乳石柱（300/550/800/1050m 各一根）——高 280px，比二段跳更高；朝它按住方向可推下（沉進地面），
//    推矮到跳得過就能二段跳跳過去（不一定要整根推掉），也能站上柱頂；彈彈怪撞到會反彈
//  二段跳：主角空中可再跳一次（第一段、第二段都能改變方向）
//  暗影獵手：300m 出沒，每關 1 隻——從空中出現，平常待在空中（主角上方漂浮），
//    偶爾預警後俯衝下來干擾主角，約 45 秒後飛離；俯衝時撞到未推下的鐘乳石會反彈（鐘乳石＝玩家護盾）；
//    子彈無效（打不死），碰到主角 -1 心＋強擊退＋2 秒冷卻；離主角 >700px 保持 5 秒會消散
//
//  Boss（每關固定排程：400 King → 700 Tank → 1000 怒怒，越代越強；最兇的放最後）：
//    登場時播放「特寫」（黑屏＋巨幅立繪＋名字，1.4s 凍結）
//    - Dave 菇菇大王（戴王冠）：孢子扇形 / 衝撞拍地 / 孢子雨（全畫面墜落）/ 召喚
//    - Tank 巨龜將軍（戴鋼盔）：殼刺扇形 / 直線衝撞 / 殼刺漩渦（放射 12 發）/ 召喚
//    - 怒怒 紅紅怪王（大紅球尖刺）：酸液三連噴 / 高速衝撞 / 尖刺放射；死亡分裂 3 隻第二階段「怒奴」（暗紅、更兇）
//
//  武器（商店用 0/1/2/3 購入或選定）：
//    - 手槍（預設） / 機槍（連發） / 雷射（一直線光束） / 火焰槍（近距）
//  道具：P=連發 8s  S=散射 8s  +=加一顆心  ★=加分
//  生命：半顆心制，每次被打扣半顆，兩下才扣一顆
//  輸入：鍵盤 / 手把（Gamepad API）/ 觸控
// =============================================================

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const W = canvas.width;    // 960
const H = canvas.height;   // 540
const GROUND_Y = 470;
const GRAVITY = 0.55;
const LEFT_WALL = 20;      // 山洞左側入口石牆
const START_X = 200;       // 主角墜落起點
const END_DIST = 1200;     // 洞口距離（公尺）
const endX = START_X + END_DIST * 10; // 洞口世界座標

// ---------------- 主題系統（關卡變體：紫晶 / 冰洞 / 熔岩洞；Boss 舞台臨時換色） ----------------
const THEMES = {
  main: { // 主洞（現行紫水晶洞）
    name: "紫晶深洞",
    bg: ["#0b0810", "#1a1420", "#241b2b"],
    rockFar: "#141019", rockMid: "#1d1626", stal: "#2a2033",
    glow: "120, 60, 140",
    ground: "#3a2f3f", groundTop: "#4a3b52", groundTex: "#554463",
    wall: "#332835", wallBlock: "#423447",
    pillar: "#8a7a96", pillarStone: "rgba(50, 40, 70, 0.5)",
    crystal1: "#9a6cff", crystal2: "#c9a5ff",
    frict: 0.8, accel: 0.9,
  },
  ice: { // 冰洞（藍白冰晶）
    name: "冰晶洞",
    bg: ["#060a14", "#0d1626", "#182642"],
    rockFar: "#0a1220", rockMid: "#101d30", stal: "#1c2c46",
    glow: "90, 170, 255",
    ground: "#2c3d58", groundTop: "#3d5578", groundTex: "#50709c",
    wall: "#263a52", wallBlock: "#365070",
    pillar: "#9fb6d2", pillarStone: "rgba(40, 60, 90, 0.5)",
    crystal1: "#7fd4ff", crystal2: "#d5f2ff",
    frict: 0.97, accel: 0.5, // 冰面：摩擦力弱、起步慢
    tip: "地面很滑，小心！",
  },
  lava: { // 熔岩洞（橘紅火光）
    name: "熔岩洞",
    bg: ["#140604", "#26100a", "#3c1c0e"],
    rockFar: "#1a0a06", rockMid: "#2c130a", stal: "#3e1c0e",
    glow: "255, 120, 40",
    ground: "#4c2616", groundTop: "#6c3820", groundTex: "#8c4c28",
    wall: "#3e1e10", wallBlock: "#562a18",
    pillar: "#b07c50", pillarStone: "rgba(90, 40, 20, 0.5)",
    crystal1: "#ff8a3c", crystal2: "#ffd070",
    frict: 0.8, accel: 0.9,
    tip: "熱氣騰騰，火星四竄",
  },
};
// Boss 專屬舞台：巨門前切換，覆蓋基礎關卡主題的少數顏色
const BOSS_THEMES = {
  king:   { bg: ["#100a18", "#1c1428", "#2a2038"], glow: "210, 170, 255", crystal1: "#c09aff", crystal2: "#e8d5ff" },
  turtle: { bg: ["#0a1216", "#14222a", "#1e3038"], glow: "120, 200, 220", crystal1: "#60c8dc", crystal2: "#b0ecf5" },
  red:    { bg: ["#160606", "#280c0c", "#3a1212"], glow: "255, 60, 50", crystal1: "#ff4a3a", crystal2: "#ff9a80" },
};
let theme = THEMES.main;   // 目前生效的主題（Boss 舞台時 = {...基礎主題, ...BOSS_THEMES[type]}）
let caveKey = "main";      // 本關基礎主題（main/ice/lava，商店後輪替）
const CAVE_ORDER = ["main", "ice", "lava"]; // 關卡輪替順序
let caveIdx = 0;           // 目前關卡（第一次突擊=main，之後每場「新的突擊」輪下一個）
let bossStage = null;      // Boss 專屬舞台（巨門前 100m 切換該 Boss 配色）

// 新的突擊（商店 → Enter）：輪替關卡主題再開始
function newRaid() {
  caveIdx = (caveIdx + 1) % CAVE_ORDER.length;
  caveKey = CAVE_ORDER[caveIdx];
  theme = THEMES[caveKey];
  startGame();
  showBanner("新的突擊——" + theme.name + (theme.tip ? "｜" + theme.tip : ""), 3);
  beep(520, 0.2, "sine", 0.04, 200);
}

// ---------------- 音效（WebAudio 簡易合成，失敗就安靜玩） ----------------
let audioCtx = null;
function beep(freq, dur, type = "square", vol = 0.04, slide = 0) {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const t0 = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t0);
    osc.stop(t0 + dur);
  } catch (e) { /* 無音效也能玩 */ }
}
const sfx = {
  shoot:  () => beep(880, 0.08, "square", 0.03, -500),
  jump:   () => beep(300, 0.12, "sine", 0.05, 300),
  hit:    () => beep(150, 0.25, "sawtooth", 0.06, -100),
  kill:   () => beep(520, 0.15, "square", 0.04, -320),
  door:   () => beep(110, 0.35, "triangle", 0.05, 70),
  land:   () => beep(90, 0.15, "triangle", 0.06, -40),
  death:  () => beep(300, 0.9, "sawtooth", 0.06, -260),
  buy:    () => { beep(660, 0.09, "square", 0.04); setTimeout(() => beep(990, 0.14, "square", 0.04), 90); },
  deny:   () => beep(140, 0.18, "square", 0.04, -40),
};

// ---------------- BGM（WebAudio 即時合成循環，零音檔；右上角按鈕開關，偏好存 localStorage） ----------------
const BGM = { on: true, master: null, step: 0, nextTime: 0 };
try { BGM.on = localStorage.getItem("cave_blaster_bgm") !== "0"; } catch (e) {}
const BGM_NOTES = { E2: 82.41, F2: 87.31, G2: 98, A2: 110, E3: 164.81, F3: 174.61, G3: 196, A3: 220, E4: 329.63, F4: 349.23, G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.26 };
// A 小調 4 小節循環（112 BPM、八分音符）：Am → F → G → E，低沉山洞節奏感
const BGM_STEPS = [
  { b: "A2", l: null }, { b: null, l: null }, { b: "A2", l: "E4" }, { b: "A3", l: null },
  { b: "A2", l: null }, { b: null, l: null }, { b: "A2", l: "C5" }, { b: "A3", l: "A4" },
  { b: "F2", l: null }, { b: null, l: null }, { b: "F2", l: "A4" }, { b: "F3", l: null },
  { b: "F2", l: null }, { b: null, l: null }, { b: "F2", l: "F4" }, { b: "F3", l: "C5" },
  { b: "G2", l: null }, { b: null, l: null }, { b: "G2", l: "B4" }, { b: "G3", l: null },
  { b: "G2", l: null }, { b: null, l: null }, { b: "G2", l: "D5" }, { b: "G3", l: "B4" },
  { b: "E2", l: null }, { b: null, l: null }, { b: "E2", l: "G4" }, { b: "E3", l: null },
  { b: "E2", l: null }, { b: null, l: null }, { b: "A2", l: "B4" }, { b: "A3", l: "E5" },
];
function wakeAudio() {
  // 瀏覽器規定音訊必須在使用者操作後才能啟動；任何按鍵/滑鼠/觸控都喚醒
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
  } catch (e) {}
}
function bgmNote(freq, t, dur, type, vol, dest) {
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(dest);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}
function bgmTick() {
  if (!BGM.on || !audioCtx) return;
  if (!BGM.master) {
    BGM.master = audioCtx.createGain();
    BGM.master.gain.value = 0.85; // 整體音量（2026-10-25 調大：之前太輕）
    BGM.master.connect(audioCtx.destination);
  }
  if (BGM.nextTime === 0) BGM.nextTime = audioCtx.currentTime + 0.1;
  const step = 60 / 112 / 2; // 八分音符
  while (BGM.nextTime < audioCtx.currentTime + 0.18) {
    const def = BGM_STEPS[BGM.step];
    if (def.b) bgmNote(BGM_NOTES[def.b], BGM.nextTime, step * 0.85, "triangle", 0.16, BGM.master);
    if (def.l) bgmNote(BGM_NOTES[def.l], BGM.nextTime, step * 0.55, "square", 0.055, BGM.master);
    BGM.step = (BGM.step + 1) % BGM_STEPS.length;
    BGM.nextTime += step;
  }
}
function setBgm(on) {
  BGM.on = !!on;
  try { localStorage.setItem("cave_blaster_bgm", BGM.on ? "1" : "0"); } catch (e) {}
  if (!BGM.on) { BGM.step = 0; BGM.nextTime = 0; }
  const b = document.getElementById("bgm-btn");
  if (b) { b.textContent = BGM.on ? "🎵" : "🔇"; b.classList.toggle("off", !BGM.on); }
}

// ---------------- 封面（標題畫面左側；Node 測試環境沒有 Image 就自動略過） ----------------
let coverImg = null;
if (typeof Image !== "undefined") {
  coverImg = new Image();
  coverImg.src = "docs/game-cover.png";
}
function coverReady() { return !!(coverImg && coverImg.complete && coverImg.naturalWidth > 0); }

// ---------------- 小工具 ----------------
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
// 確定性偽隨機（用來生成背景岩石，捲動時不會跳動）
function rnd(i) {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rectsOverlap(a, b) {
  return Math.abs(a.x - b.x) < (a.w + b.w) / 2 &&
         Math.abs(a.y - b.y) < (a.h + b.h) / 2;
}

// ---------------- 武器 ----------------
const WEAPONS = {
  pistol: { name: "手槍",   cost: 0,   cd: 0.16,  speed: 11,  dmg: 1, life: 1.4,  color: "#ffd54a", desc: "均衡萬用，無後顧之憂" },
  mg:     { name: "機槍",   cost: 300, cd: 0.067, speed: 12,  dmg: 1, life: 1.0,  color: "#ffe08a", desc: "超高射速，掃平怪群" },
  laser:  { name: "雷射",   cost: 600, cd: 0.16,  dmg: 2, life: 0.14, color: "#6ff2ff", beam: true, desc: "一直線雷射光束，貫穿直線上的一切" },
  flame:  { name: "火焰槍", cost: 400, cd: 0.04,  speed: 9,   dmg: 1, life: 0.55, color: "#ff7a3c", flame: true, spread: 0.28, desc: "火焰錐，近距離融化一切" },
};
// 商店排列（按鍵 0/1/2/3）
const SHOP = [
  { id: "pistol", cost: 0 },
  { id: "mg",     cost: 300 },
  { id: "laser",  cost: 600 },
  { id: "flame",  cost: 400 },
];
// 武器升級（商店按鍵 4/5：對所有武器生效、永久保存）
const UPGRADES = {
  dmg:  { name: "傷害強化",  max: 5, base: 120, desc: "所有武器傷害 +0.5（光束同享）" },
  rate: { name: "射速強化", max: 5, base: 150, desc: "所有武器射擊間隔 -7%（乘算）" },
};
function upgCost(kind) {
  const lv = kind === "dmg" ? state.upgDmg : state.upgRate;
  return (lv + 1) * UPGRADES[kind].base;
}
function weaponDmg() { return WEAPONS[state.weapon].dmg + state.upgDmg * 0.5; } // 平衡：每級 +0.5（原 +1，滿級不再秒殺）
function weaponCd()  { return WEAPONS[state.weapon].cd * Math.pow(0.93, state.upgRate); } // 平衡：每級 ×0.93（原 ×0.9）

// ---------------- 成就（永久保存，遊戲事件解鎖） ----------------
const ACHIEVEMENTS = [
  { id: "first_kill",  icon: "🗡️", name: "初嘗鮮血", desc: "擊敗第一隻敵人",          test: (g) => g.prog.kills >= 1 },
  { id: "ten_kills",   icon: "⚔️", name: "怪物獵人", desc: "累計擊殺 10 隻敵人",      test: (g) => g.prog.kills >= 10 },
  { id: "fifty_kills", icon: "💥", name: "深谷屠夫", desc: "累計擊殺 50 隻敵人",      test: (g) => g.prog.kills >= 50 },
  { id: "first_boss",  icon: "👑", name: "討伐者",   desc: "擊敗第一隻 Boss",         test: (g) => g.prog.bossKing + g.prog.bossTurtle + g.prog.bossRed >= 1 },
  { id: "king_kill",   icon: "🍄", name: "菇菇斬",   desc: "擊敗 Dave 菇菇大王",      test: (g) => g.prog.bossKing >= 1 },
  { id: "tank_kill",   icon: "🐢", name: "平定巨龜", desc: "擊敗 Tank 巨龜將軍",      test: (g) => g.prog.bossTurtle >= 1 },
  { id: "red_kill",    icon: "🔥", name: "怒平",     desc: "擊敗怒怒 紅紅怪王",       test: (g) => g.prog.bossRed >= 1 },
  { id: "escape",      icon: "🌅", name: "深谷逃脫", desc: "首次抵達 1200m 洞口",     test: (g) => g.prog.raids >= 1 },
  { id: "rich",        icon: "💰", name: "硬幣大亨", desc: "身上持有 1000 硬幣",      test: (g) => g.state.gold >= 1000 },
  { id: "all_weapons", icon: "🔫", name: "全武裝",   desc: "集齊 4 種武器",           test: (g) => g.state.owned.length >= 4 },
  { id: "upgraded",    icon: "⬆️", name: "武裝升級", desc: "購買第一項武器升級",      test: (g) => g.state.upgDmg + g.state.upgRate >= 1 },
  { id: "maxed",       icon: "★",  name: "極致武裝", desc: "任一武器升級達 Lv5",      test: (g) => Math.max(g.state.upgDmg, g.state.upgRate) >= 5 },
];
let prog = { kills: 0, bossKing: 0, bossTurtle: 0, bossRed: 0, raids: 0 }; // 跨局累計進度
let achUnlocked = []; // 已解鎖成就 id
try {
  const p0 = JSON.parse(localStorage.getItem("cave_blaster_prog") || "null");
  if (p0) prog = Object.assign(prog, p0);
  achUnlocked = JSON.parse(localStorage.getItem("cave_blaster_ach") || "null") || [];
} catch (e) {}
function saveAch() {
  try {
    localStorage.setItem("cave_blaster_prog", JSON.stringify(prog));
    localStorage.setItem("cave_blaster_ach", JSON.stringify(achUnlocked));
  } catch (e) {}
}
function checkAch() {
  const g = { prog, state };
  let changed = false;
  for (const a of ACHIEVEMENTS) {
    if (!achUnlocked.includes(a.id) && a.test(g)) {
      achUnlocked.push(a.id);
      changed = true;
      showBanner("🏆 成就解鎖：" + a.icon + " " + a.name, 2.6);
      beep(880, 0.12, "sine", 0.05, 0);
      beep(1318, 0.22, "sine", 0.05, 0);
    }
  }
  if (changed) saveAch();
}
const SHOP_GOLD = { red: 8, mushroom: 15, turtle: 25, bouncy: 30, nunu: 40 };

// ---------------- 故事 ----------------
const STORY_START = [
  "登山的第三天。",
  "天色漸暗，地面開始震動——",
  "「喀啦」一聲，步道崩裂了！",
  "你滾進一條漆黑的未知山洞，",
  "手裡只抓著背包裡的那把槍。",
  "洞的深處，隱隱透出紅色的光……",
];
const STORY_END = [
  "你推開最後一根鐘乳石——",
  "山洞的盡頭，竟是巨大的出口！",
  "陽光灑了進來，微風帶著青草味。",
  "菇菇怪的怒吼，慢慢消失在遠處。",
  "主角爬出洞穴，遠處天空忽然亮起一架紅色無人機。",
  "掃描結果顯示：「目標 RDD8，確認存活。」",
  "（洞的最深處，更大的影子正在甦醒……）",
];

// ---------------- 遊戲狀態 ----------------
const state = {
  mode: "title",   // title | story | playing | dying | gameover | ending | shop
  score: 0,
  hp: 6,           // 半顆心制：6 半顆 = 3 顆心
  camX: 0,
  time: 0,
  best: 0,
  gold: 0,         // 商店硬幣
  owned: ["pistol"], // 已擁有的武器
  weapon: "pistol",  // 下一局使用的武器
  upgDmg: 0,   // 武器升級：傷害 +N（0~5）
  upgRate: 0,  // 武器升級：射速 cd×0.93^N（0~5）
  paused: false,
};
try {
  state.best = +(localStorage.getItem("cave_blaster_best") || 0);
  state.gold = +(localStorage.getItem("cave_blaster_gold") || 0);
  state.owned = JSON.parse(localStorage.getItem("cave_blaster_owned") || "null") || ["pistol"];
  if (!state.owned.includes("pistol")) state.owned.unshift("pistol");
  state.weapon = localStorage.getItem("cave_blaster_weapon") || "pistol";
  if (!state.owned.includes(state.weapon)) state.weapon = "pistol";
  state.upgDmg = +(localStorage.getItem("cave_blaster_upg_dmg") || 0);
  state.upgRate = +(localStorage.getItem("cave_blaster_upg_rate") || 0);
} catch (e) {}

function saveShop() {
  try {
    localStorage.setItem("cave_blaster_gold", String(state.gold));
    localStorage.setItem("cave_blaster_owned", JSON.stringify(state.owned));
    localStorage.setItem("cave_blaster_weapon", state.weapon);
    localStorage.setItem("cave_blaster_upg_dmg", String(state.upgDmg));
    localStorage.setItem("cave_blaster_upg_rate", String(state.upgRate));
  } catch (e) {}
}
function saveBest() {
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem("cave_blaster_best", String(state.best)); } catch (e) {}
  }
}

const player = {};
let bullets = [], beams = [], enemies = [], doors = [], particles = [], popups = [];
let pillars = []; // 鐘乳石柱 {x, w, h, open, opened}——可推動的地形
let ebullets = [];       // 敵方射擊
let items = [];          // 掉落的道具
let ambientT = 0;        // 關卡環境粒子計時（熔岩火星 / 冰晶雪）
let rockWarns = [];      // 落石預警 {x, t}（Tank 第 3 次縮殼衝撞）
let groundRocks = [];    // 落地碎石 {x, w, t}
let nunuGroup = "idle";  // 怒奴集體攻擊："idle" | "active"（分散畫面邊緣有高有低→齊射→歸位）
let nunuGroupCd = 4;     // 下次集體攻擊倒數（秒）
let nunuSplitT = 0;      // 怒奴延遲分裂倒數（遊戲秒，慢動作下被放大）
let nunuSplitX = 0, nunuSplitY = 0; // 怒奴分裂點
let boss = null;
// Boss 出場排程（每關固定：400 King → 700 Tank → 1000 怒怒；最兇的放最後）
const BOSS_SCHEDULE = [
  { dist: 400, type: "king" },
  { dist: 700, type: "turtle" },
  { dist: 1000, type: "red" },
];
let bossIdx = 0;                    // 排程中下一隻 Boss
const bossGen = { king: 0, red: 0, turtle: 0 }; // 每種 Boss 第幾代
let bossIntro = null;               // Boss 登場特寫 {t, dur, type, name}
let shadow = null;                  // 暗影獵手 {x, y, t, fade, farT, dying}（打不死，只能甩掉）
let shadowSpawned = false;          // 本關是否已出過暗影獵手
let banner = null;       // 中央大字提示 {text, t, dur}
let doorTimer = 2;       // 下一扇門的倒數（秒）
let fallDone = false;    // 主角是否已落地
let maxDist = 0;         // 最遠推進距離（公尺）
let shake = 0;           // 螢幕震動
let dt60 = 1;            // 以 60fps 為基準的幀倍率（物理計算用）

const BOSS_NAMES = { king: "Dave 菇菇大王", red: "怒怒 紅紅怪王", turtle: "Tank 巨龜將軍" };

function reset() {
  state.mode = "playing";
  state.score = 0;
  state.hp = 6;
  state.camX = 0;
  state.time = 0;
  state.paused = false;
  maxDist = 0;
  fallDone = false;
  shake = 0;
  doorTimer = 1.6;
  boss = null;
  bossIdx = 0;
  bossGen.king = 0;
  bossGen.red = 0;
  bossGen.turtle = 0;
  bossIntro = null;
  bossStage = null;
  theme = THEMES[caveKey]; // 重試/新關都從基礎關卡主題開始（Boss 舞台色在 updateDoors 裡重新觸發）
  shadow = null;
  shadowSpawned = false;
  banner = null;
  bullets = []; beams = []; enemies = []; doors = []; particles = []; popups = [];
  ebullets = []; items = [];
  rockWarns = []; groundRocks = [];
  nunuGroup = "idle"; nunuGroupCd = 4;
  nunuSplitT = 0; slowScale = 1; slowmoT = 0; // 分裂倒數＋慢動作重設
  pillars = [300, 550, 800, 1050].map((m) => ({ x: START_X + m * 10, w: 40, h: 280, sunk: 0, opened: false })); // 280px 高：比二段跳（~230px）更高
  Object.assign(player, {
    x: START_X, y: -120, vx: 0, vy: 0,
    w: 26, h: 40,
    onGround: false,
    airJumps: 0,    // 空中剩餘跳躍次數（落地跳後剩 1 次）
    facing: 1,
    inv: 0,          // 無敵時間（秒）
    fireAcc: 0,      // 射擊累加器（秒，累積滿一個週期就發射）
    fireHeld: false, // 射擊鍵是否按住（按下瞬間首發立即）
    jumpBuf: 0,      // 跳躍緩衝（秒）
    walkT: 0,        // 走路動畫計時
    falling: true,   // 還在從天上掉下來
    rapidT: 0,       // 連發剩餘時間
    spreadT: 0,      // 散射剩餘時間
    dead: false,
    deadT: 0,        // 死亡動畫計時
    freeze: 0,       // 凍結時間（Boss 終結登場，輸入無效）
  });
}

// ---------------- 輸入（鍵盤 + 手把 + 觸控） ----------------
const keys = Object.create(null);
function pressed(...codes) { return codes.some((c) => keys[c]); }

// 手把（Gamepad API）
const gp = { left: false, right: false, up: false, down: false, upEdge: false, downEdge: false, fire: false, connected: false, pressed: new Set() };
let gpPrev = new Set(), gpEdge = new Set();
// 手把按鍵校正（各廠牌映射不一，讓玩家自己指定；存 localStorage）
const GP_DEFAULTS = { jump: 0, fire: 2, confirm: 9, pause: 1 };
const GP_NAMES = ["A", "B", "X", "Y", "LB", "RB", "LT", "RT", "Back", "Start", "L3", "R3", "↑", "↓", "←", "→"];
const gpMap = Object.assign({}, GP_DEFAULTS);
let calibStep = 0; // 0=跳 1=射 2=確認
let titleSel = 0;   // 標題選單：0=開始墜落 1=手把校正
let pauseSel = 0;   // 暫停選單：0=繼續 1=回標題
let overSel = 0;    // 死亡選單：0=再試一次 1=去商店 2=回標題
try {
  Object.assign(gpMap, JSON.parse(localStorage.getItem("cave_blaster_gpmap") || "null") || {});
} catch (e) {}
function saveGpMap() {
  try { localStorage.setItem("cave_blaster_gpmap", JSON.stringify(gpMap)); } catch (e) {}
}
function enterCalib() {
  state.mode = "calib";
  calibStep = 0;
  state.paused = false;
}
function pollGamepad() {
  gpEdge = new Set();
  gp.connected = false;
  if (typeof navigator === "undefined" || !navigator.getGamepads) return;
  let pad = null;
  try {
    const pads = navigator.getGamepads();
    for (const p of pads) if (p && p.connected) { pad = p; break; }
  } catch (e) {}
  if (!pad) { gpPrev = new Set(); return; }
  gp.connected = true;
  const now = new Set();
  for (let i = 0; i < pad.buttons.length; i++) if (pad.buttons[i] && pad.buttons[i].pressed) now.add(i);
  for (const i of now) if (!gpPrev.has(i)) gpEdge.add(i);
  const ax = pad.axes[0] || 0;
  gp.left = now.has(14) || ax < -0.3;
  gp.right = now.has(15) || ax > 0.3;
  gp.up = now.has(12);
  gp.down = now.has(13);
  gp.upEdge = gp.up && !gpPrev.has(12);
  gp.downEdge = gp.down && !gpPrev.has(13);
  gp.fire = now.has(gpMap.fire) || now.has(4) || now.has(5) || now.has(6) || now.has(7); // 校準射擊鍵 + 觸發器備援
  gp.pressed = now;
  gpPrev = now;
}

// 觸控（left/right 的 Edge = 選單移動邊緣觸發；選單畫面 ◀＝上、▶＝下）
const touch = { left: false, right: false, fire: false, actionQueued: false, jumpQueued: false, leftEdge: false, rightEdge: false };
let btnJumpEl = null;
function setupTouch() {
  if (typeof document === "undefined" || !document.getElementById) return;
  const bind = (id, on, off) => {
    const el = document.getElementById(id);
    if (!el) return;
    const start = (e) => { e.preventDefault(); on(); };
    const end = (e) => { e.preventDefault(); if (off) off(); };
    el.addEventListener("touchstart", start, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("mousedown", start);
    el.addEventListener("mouseup", end);
    el.addEventListener("mouseleave", end);
  };
  bind("btn-left", () => { touch.left = true; touch.leftEdge = true; }, () => { touch.left = false; });
  bind("btn-right", () => { touch.right = true; touch.rightEdge = true; }, () => { touch.right = false; });
  bind("btn-fire", () => { touch.fire = true; }, () => { touch.fire = false; });
  bind("btn-jump", () => {
    touch.jumpQueued = true;
    // 非戰鬥畫面（含暫停）時，跳躍鍵也當「確認」用（商店＝確認游標列）
    if (state.mode !== "playing" || state.paused) touch.actionQueued = true;
  });
  btnJumpEl = document.getElementById("btn-jump");
  try {
    if (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) {
      const ui = document.getElementById("touch-ui");
      if (ui) ui.style.display = "flex";
    }
  } catch (e) {}
}

function inLeft()  { return pressed("ArrowLeft", "KeyA") || touch.left || gp.left; }
function inRight() { return pressed("ArrowRight", "KeyD") || touch.right || gp.right; }
function inUp()    { return pressed("ArrowUp", "KeyW") || gp.up; }
function inDown()  { return pressed("ArrowDown", "KeyS") || gp.down; }
function inFire()  { return pressed("KeyJ", "KeyZ", "KeyX", "Enter") || touch.fire || gp.fire; } // Enter = steamOS 模擬鍵盤手把的射擊備援鍵
function currentAim() {
  let dx = player.facing, dy = 0;
  if (inUp()) dy = -1;
  else if (inDown()) dy = 1;
  return { dx, dy };
}

window.addEventListener("keydown", (e) => {
  wakeAudio(); // 首次按鍵 = 使用者操作，允許啟動音訊（BGM 就能響了）
  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) e.preventDefault();
  // 跳躍用「按下瞬間」觸發（僅空白鍵；↑ / W 純瞄準斜射、不再跳；商店是選單、空白＝確認）
  if (!keys[e.code] && e.code === "Space") {
    if (state.mode === "playing" &&
        !player.falling && !player.dead && (player.onGround || player.airJumps > 0)) {
      player.jumpBuf = 0.15;
    }
  }
  const fresh = !keys[e.code];
  keys[e.code] = true;
  if (!fresh) return;
  const isAction = e.code === "Enter" || e.code === "Space";
  if (e.code === "KeyP" && state.mode === "playing") { state.paused = !state.paused; if (state.paused) pauseSel = 0; }
  if (state.mode === "playing" && state.paused) {
    // 暫停選單：↑↓ / W S 移動、空白 / Enter 確認、T 直接回標題
    if (e.code === "ArrowUp" || e.code === "KeyW") pauseSel = 0;
    else if (e.code === "ArrowDown" || e.code === "KeyS") pauseSel = 1;
    else if (e.code === "KeyT") { state.paused = false; state.mode = "title"; }
    else if (isAction) { state.paused = false; if (pauseSel === 1) state.mode = "title"; }
  } else if (state.mode === "title") {
    if (e.code === "ArrowUp" || e.code === "ArrowDown" || e.code === "KeyW" || e.code === "KeyS") titleSel = (titleSel + 1) % 3;
    else if (e.code === "KeyC") enterCalib();
    else if (isAction) (titleSel === 0 ? startStory() : titleSel === 1 ? enterCalib() : (state.mode = "ach"));
  } else if (state.mode === "ach") {
    if (isAction || e.code === "Escape") state.mode = "title";
  } else if (state.mode === "calib") {
    if (e.code === "Escape" || e.code === "Enter") state.mode = "title";
  } else if (state.mode === "story" || state.mode === "ending") {
    if (isAction) story.skip();
  } else if (state.mode === "gameover") {
    if (e.code === "KeyR" || e.code === "Enter") startGame();
    else if (e.code === "KeyS") enterShop();
    else if (e.code === "KeyT") state.mode = "title"; // T = 回標題（快捷）
    else if (e.code === "ArrowUp" || e.code === "KeyW") overSel = 0;
    else if (e.code === "ArrowDown") overSel = (overSel + 1) % 3;
    else if (e.code === "Space") { if (overSel === 1) enterShop(); else if (overSel === 2) state.mode = "title"; else startGame(); }
  } else if (state.mode === "shop") {
    if (e.code === "Enter") newRaid();
    else if (e.code === "Space") shopConfirm(); // 空白＝確認游標列（手把 A/Start 走 frame 的 actionEdge）
    else if (e.code === "ArrowUp" || e.code === "KeyW") shopSel = (shopSel + SHOP_ROWS - 1) % SHOP_ROWS;
    else if (e.code === "ArrowDown" || e.code === "KeyS") shopSel = (shopSel + 1) % SHOP_ROWS;
    else if (e.code.startsWith("Digit") || e.code.startsWith("Numpad")) {
      const n = +e.code.slice(-1);
      if (n >= 0 && n < SHOP.length) shopBuy(n);
      else if (n === 4) buyUpgrade("dmg");
      else if (n === 5) buyUpgrade("rate");
    }
  }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });
window.addEventListener("pointerdown", wakeAudio); // 滑鼠/觸控同樣喚醒音訊

// 故事控制器（自動逐行，按鍵可快轉）
const story = {
  lines: [], idx: 0, t: 0, per: 1.5,
  start(lines) { this.lines = lines; this.idx = 0; this.t = 0; },
  skip() {
    if (this.idx < this.lines.length - 1) { this.idx++; this.t = 0; }
    else this.finish();
  },
  finish() {
    if (state.mode === "story") reset();          // 開始墜落
    else if (state.mode === "ending") enterShop();
  },
};
function startStory() {
  state.mode = "story";
  story.start(STORY_START);
  beep(220, 0.4, "sine", 0.04, 80);
}
function startGame() { reset(); }

// ---------------- 商店 ----------------
function enterShop() {
  state.mode = "shop";
  state.camX = 0;
  state.time = 0;
  state.paused = false;
  bullets = []; beams = []; enemies = []; doors = []; ebullets = []; items = [];
  particles = []; popups = [];
  boss = null;
  doorTimer = 1.2;
  Object.assign(player, {
    x: 180, y: GROUND_Y - 20, vx: 0, vy: 0,
    w: 26, h: 40,
    onGround: true, falling: false, dead: false,
    airJumps: 0,
    inv: 0, fireAcc: 0, fireHeld: false, jumpBuf: 0, walkT: 0,
    rapidT: 0, spreadT: 0, facing: 1,
    freeze: 0,
  });
  shopSel = 0;
  showBanner("武器商店：↑↓ 選擇、空白/A 購買，Enter 開始新的突擊！", 3);
  checkAch(); // 成就：硬幣/全武器/升級類（商店是這些成就的主要觸發點）
}

// 商店游標選單：4 武器＋2 升級＋1「開始新的突擊」（鍵盤 ↑↓ / 手把十字鍵 / 觸控）
const SHOP_ROWS = 7;
let shopSel = 0;
function shopConfirm() {
  if (shopSel < 4) shopBuy(shopSel);
  else if (shopSel === 4) buyUpgrade("dmg");
  else if (shopSel === 5) buyUpgrade("rate");
  else newRaid();
}

function shopBuy(i) {
  const s = SHOP[i];
  if (!s) return;
  const w = WEAPONS[s.id];
  if (!state.owned.includes(s.id)) {
    if (state.gold >= s.cost) {
      state.gold -= s.cost;
      state.owned.push(s.id);
      showBanner(`購買成功：${w.name}！`, 1.6);
      sfx.buy();
    } else {
      showBanner(`硬幣不夠…（還差 ${s.cost - state.gold}）`, 1.6);
      sfx.deny();
      return; // 買不到就不換裝
    }
  }
  state.weapon = s.id;
  saveShop();
  checkAch(); // 成就：全武裝/硬幣
}

function buyUpgrade(kind) {
  const u = UPGRADES[kind];
  const lv = kind === "dmg" ? state.upgDmg : state.upgRate;
  if (lv >= u.max) { showBanner(u.name + " 已經滿級了！", 1.2); sfx.deny(); return; }
  const cost = upgCost(kind);
  if (state.gold < cost) {
    showBanner(`硬幣不夠…（還差 ${cost - state.gold}）`, 1.6);
    sfx.deny();
    return;
  }
  state.gold -= cost;
  if (kind === "dmg") state.upgDmg++; else state.upgRate++;
  showBanner(`${u.name} Lv.${kind === "dmg" ? state.upgDmg : state.upgRate}！`, 1.6);
  sfx.buy();
  saveShop();
  checkAch(); // 成就：武裝升級/極致武裝
}

// ---------------- 生成 ----------------
function pickDoorType() {
  const r = Math.random();
  return r < 0.12 ? "bouncy" : r < 0.5 ? "red" : r < 0.82 ? "mushroom" : "turtle"; // 紅紅怪最多，彈彈怪稀有
}

function spawnDoor() {
  // 關卡：門出現在畫面右側邊緣；主角推進一段後，偶爾從左側邊緣出現
  const fromLeft = state.camX > 300 && Math.random() < 0.3;
  const x = fromLeft
    ? Math.max(60, player.x - 320 - Math.random() * 80)
    : state.camX + W - 120 - Math.random() * 80;
  const type = pickDoorType();
  const count = type === "red" ? 2 + Math.floor(Math.random() * 3)
             : type === "bouncy" ? 1
             : 1 + Math.floor(Math.random() * 2);
  doors.push({
    x, y: GROUND_Y, type, count,
    age: 0,         // 當前階段持續時間
    next: 0.25,     // 距離下次竄出敵人的倒數
    phase: 0,       // 0=警示 1=大開 2=關閉中
    closeT: 0,
  });
}

function makeEnemy(type, x, y) {
  const e = {
    x, y: y - 12,
    vx: 0, vy: -7 - Math.random() * 2.5, // 從門裡「竄跳」出來
    facing: -1,
    t: Math.random() * 10,
    onGround: false,
    type,
    atkCd: 1.5 + Math.random() * 2, // 攻擊冷卻
    atkState: 0,   // 1=正在蓄力
    atkT: 0,
  };
  if (type === "mushroom") Object.assign(e, { w: 34, h: 30, hp: 3, score: 100 }); // 平衡：2→3
  else if (type === "turtle")   Object.assign(e, { w: 40, h: 24, hp: 4, score: 200 }); // 平衡：3→4
  else if (type === "bouncy")   Object.assign(e, { w: 28, h: 28, hp: 4, score: 250 }); // 平衡：3→4
  else if (type === "nunu")     Object.assign(e, { w: 64, h: 60, hp: 130, maxHp: 130, score: 500 }); // 第二階段怒怒：Boss 級身形（同怒怒第一階段）＋ Boss 級血量（平衡：90→130）
  else                           Object.assign(e, { w: 22, h: 20, hp: 2, score: 50 }); // 平衡：1→2
  if (type === "bouncy") e.vx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random()); // 初速水平彈跳
  return e;
}

function spawnFromDoor(d) {
  enemies.push(makeEnemy(d.type, d.x, d.y));
  burst(d.x, d.y - 16, 5, "#9a86a8");
}

function spawnBossDoor() {
  // 巨門：Boss 登場
  const x = Math.max(player.x + 320, state.camX + W - 140);
  doors.push({ x, y: GROUND_Y, type: "boss", count: 1, age: 0, next: 0, phase: 0, closeT: 0, boss: true });
}

function spawnBoss(x, typeOverride) {
  const sched = BOSS_SCHEDULE[bossIdx];
  const type = typeOverride || (sched ? sched.type : "king");
  if (!typeOverride && sched) bossIdx++;
  bossGen[type]++;
  const gen = bossGen[type];
  const hp = type === "king" ? 110 + (gen - 1) * 40   // 平衡：80→110
         : type === "red" ? 130 + (gen - 1) * 50      // 平衡：90→130
         : 150 + (gen - 1) * 60;                      // 平衡：110→150
  const name = BOSS_NAMES[type] + (gen > 1 ? " " + gen + " 代" : "");
  boss = {
    type, gen, name,
    x, y: GROUND_Y - 60, vx: 0, vy: -8,
    w: type === "king" ? 74 : type === "red" ? 64 : 92,
    h: type === "king" ? 88 : type === "red" ? 60 : 58,
    hp, maxHp: hp,
    t: 0, facing: -1, atkCd: 2.5,
    onGround: false, slamming: false, charging: false,
    // Tank 縮殼週期：extend（可傷）↔ shell（無敵，衝撞 3 次，第 3 次落石）→ out（終結形態）
    shell: false, out: false, phase: "extend", extT: 4.5,
    chargeCount: 0, pauseT: 0, toExtend: false, chargeT: 0,
    // 代數強化：彈速更快、攻擊冷卻更短
    spd: 1 + 0.06 * (gen - 1),
    cdMul: Math.max(0.7, 1 - 0.07 * (gen - 1)),
  };
  // 登場特寫：凍結 1.4 秒，黑屏巨幅立繪
  bossIntro = { t: 0, dur: 1.4, type, name };
  player.inv = Math.max(player.inv, 1.5); // 特寫期間無敵
  sfx.door();
  shake = 0.4;
}

// 落石：Tank 第 3 次縮殼衝撞觸發（預警 → 石頭砸落 → 碎石留地）
function triggerRockfall(dir) {
  showBanner("落石！！", 1.6);
  beep(90, 0.5, "sawtooth", 0.06, -60);
  for (let i = 0; i < 9; i++) {
    const x = player.x + (Math.random() - 0.5) * 500 + dir * 80;
    rockWarns.push({ x, t: 0.8 + Math.random() * 0.4 });
  }
}

// Boss HP 歸零：Tank 不會立刻死——「殼裡掉出來」進入終結形態（主角凍結 1 秒，一發子彈解決）
function bossTakeOut() {
  if (boss.type === "turtle" && !boss.out) {
    boss.out = true;
    boss.shell = false;
    boss.phase = "out";
    boss.hp = 1;
    boss.charging = false;
    boss.vx = 0;
    player.freeze = 1.1; // 主角短暫凍結
    showBanner("巨龜將軍從殼裡掉出來——一發子彈解決他！", 2.4);
    startSlowmo(0.35, 2.0); // 終結形態登場：慢動作電影感（一發解決時立刻恢復正常）
    burst(boss.x, boss.y, 30, "#8cc86a");
    burst(boss.x, boss.y - 24, 20, "#d8e8c0");
    shake = 0.6;
    beep(160, 0.6, "sawtooth", 0.05, -120);
    return;
  }
  killBoss();
}

function killBoss() {
  const b = boss;
  if (b.out) endSlowmo(); // Tank 終結形態被一發解決 → 慢動作結束
  state.score += 2000;
  state.gold += 100;
  state.hp = Math.min(6, state.hp + 2);
  showBanner(b.name + " 被擊倒了！+2000分 +100硬幣" + (b.type === "red" ? "……但它分裂了！" : ""), 2.8);
  burst(b.x, b.y, 30, "#ff8a5c");
  burst(b.x, b.y, 20, "#e04040");
  // 掉落三個道具
  for (const type of ["heal", "rapid", "spread"]) {
    items.push(makeItem(type, b.x + (Math.random() - 0.5) * 80, b.y - 20));
  }
  beep(80, 0.6, "sawtooth", 0.06, -40);
  sfx.kill();
  shake = 0.6;
  // 怒怒 Boss 死亡分裂：慢動作電影感 → 0.45 遊戲秒後 3 隻「怒奴」在死亡點爆開（第二階段：暗紅、Boss 級血量、更兇）
  if (b.type === "red") {
    nunuSplitT = 0.45; nunuSplitX = b.x; nunuSplitY = b.y;
    startSlowmo(0.3, 2.0);
    burst(b.x, b.y, 24, "#8a1a1a");
  }
  // Boss 舞台結束：還原關卡主題
  bossStage = null;
  theme = THEMES[caveKey];
  boss = null;
  bossIntro = null;
  const bKey = { king: "bossKing", turtle: "bossTurtle", red: "bossRed" }[b.type];
  if (bKey) prog[bKey]++;
  checkAch(); // 成就：Boss 類＋硬幣
  saveShop();
}

function showBanner(text, dur) {
  banner = { text, t: 0, dur };
}

function burst(x, y, n, color) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = 1 + Math.random() * 3;
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1,
      life: 0.35 + Math.random() * 0.35,
      size: 2 + Math.random() * 3,
      color,
    });
  }
}

// ---------------- 道具 ----------------
const ITEM_INFO = {
  rapid:  { color: "#e05252", label: "P",  name: "連發" },
  spread: { color: "#5278e0", label: "S",  name: "散射" },
  heal:   { color: "#52c052", label: "+",  name: "加血" },
  gem:    { color: "#e0b83c", label: "★",  name: "分數" },
};

function makeItem(type, x, y) {
  return {
    type, x, y,
    vx: (Math.random() - 0.5) * 3,
    vy: -4 - Math.random() * 2,
    t: Math.random() * 6,
    life: 12,   // 12 秒後消失
    onGround: false,
  };
}

function applyItem(it) {
  const p = player;
  if (it.type === "rapid") {
    p.rapidT = 8;
    popups.push({ x: it.x, y: it.y - 18, text: "連發 8s", life: 0.8 });
  } else if (it.type === "spread") {
    p.spreadT = 8;
    popups.push({ x: it.x, y: it.y - 18, text: "散射 8s", life: 0.8 });
  } else if (it.type === "heal") {
    if (state.hp >= 6) {
      state.score += 200;
      popups.push({ x: it.x, y: it.y - 18, text: "血量滿 → +200", life: 0.8 });
    } else {
      state.hp = Math.min(6, state.hp + 2);
      popups.push({ x: it.x, y: it.y - 18, text: "+1 顆心", life: 0.8 });
    }
  } else { // gem
    state.score += 300;
    popups.push({ x: it.x, y: it.y - 18, text: "+300", life: 0.8 });
  }
  burst(it.x, it.y, 8, ITEM_INFO[it.type].color);
  beep(980, 0.09, "sine", 0.045, 300);
}

function dropLoot(e) {
  // 掉率：烏龜最高、怒奴（mini-boss）次之、菇菇中等、紅紅怪偶爾掉
  const chance = e.type === "turtle" ? 0.30 : e.type === "nunu" ? 0.25 : e.type === "mushroom" ? 0.18 : 0.07;
  if (Math.random() > chance) return;
  const r = Math.random();
  const type = r < 0.3 ? "rapid" : r < 0.6 ? "spread" : r < 0.85 ? "heal" : "gem";
  items.push(makeItem(type, e.x, e.y - 10));
}

// ---------------- 像素素材（ASCII 像素圖 → canvas，手繪風） ----------------
const PAL = {
  r: "#c85a3a",  // 主角帽子
  h: "#f2c9a0",  // 主角膚色
  e: "#26202a",  // 眼睛
  j: "#4a7fd4",  // 主角外套
  p: "#3b4a6b",  // 主角褲子
  b: "#6b4a2f",  // 主角靴子
  m: "#e04040",  // 菇帽
  w: "#ffffff",  // 白
  c: "#f0e0c0",  // 菇身
  k: "#e8d5b0",  // 菇腳
  s: "#4e8f3a",  // 龜殼
  q: "#3c6e2c",  // 龜殼紋
  g: "#8cc86a",  // 龜綠
  t: "#e33b3b",  // 紅紅怪
  u: "#a82828",  // 紅紅怪腳
};

function makeSprite(rows, scale) {
  const w = rows[0].length, h = rows.length;
  for (const row of rows) {
    if (row.length !== w) throw new Error("sprite row width mismatch: " + row);
  }
  const c = document.createElement("canvas");
  c.width = w * scale; c.height = h * scale;
  const g = c.getContext("2d");
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const ch = rows[j][i];
      if (ch === ".") continue;
      g.fillStyle = PAL[ch] || "#f0f";
      g.fillRect(i * scale, j * scale, scale, scale);
    }
  }
  return c;
}

const PLAYER_HEAD = [
  "....rrrrrr..",
  "...rrrrrrrr.",
  "...rrrrrrr..",
  "...hhhhhhh..",
  "...hehheh...",
  "...hhhhhhh..",
  "....hhhhh...",
  "..jjjjjjjj..",
  ".jjjjjjjjjj.",
  ".jjjjjjjjjj.",
  ".jjjjjjjjjj.",
];
const SPR = {
  playerA: makeSprite([...PLAYER_HEAD,
    "..pppppppp..",
    "..pppppppp..",
    "..pp....pp..",
    "..bb....bb..",
  ], 2),
  playerB: makeSprite([...PLAYER_HEAD,
    "..pp....pp..",
    ".pp......pp.",
    ".bb......bb.",
  ], 2),
  mushroom: makeSprite([
    "....mmmm....",
    "..mmmmmmmm..",
    ".mwmmmmmwmm.",
    ".mmmmmmmmmm.",
    "mmmmmmmmmmmm",
    "mmmmmmmmmmmm",
    "..cccccccc..",
    "..ceecceec..",
    "..cccccccc..",
    "...kk..kk...",
    "..kk....kk..",
  ], 3),
  turtle: makeSprite([
    ".........gggg.",
    ".........gegg.",
    ".ssssssssssss.",
    ".sqssqssqssss.",
    ".ssssssssssss.",
    "ssssssssssssss",
    "ssssssssssssss",
    ".gg..gg..gggg.",
    ".gg..gg..gggg.",
  ], 3),
  red: makeSprite([
    "..tttttt..",
    ".tttttttt.",
    ".twwttwwt.",
    "ttwettwett",
    "tttttttttt",
    "tttttttttt",
    ".tttttttt.",
    "..uu..uu..",
  ], 2),
};

// ---------------- 更新 ----------------
function updatePlayer(dt) {
  const p = player;
  // 關卡機制：冰洞地面超滑（摩擦力弱、起步慢）
  const cave = THEMES[caveKey];
  const maxV = 4.2, accel = cave.accel || 0.9;
  if (p.freeze > 0) p.freeze -= dt; // 凍結（Boss 終結登場）：輸入無效

  if (!p.falling && p.freeze <= 0) {
    // 左右移動
    let move = 0;
    if (inLeft()) move -= 1;
    if (inRight()) move += 1;
    if (move !== 0) {
      p.vx += move * accel * dt60;
      p.facing = move;
      p.walkT += dt;
    } else {
      p.vx *= Math.pow(cave.frict ?? 0.8, dt60); // 冰洞 0.97＝打滑
      if (Math.abs(p.vx) < 0.02) p.vx = 0;
    }
    p.vx = clamp(p.vx, -maxV, maxV);

    // 跳躍（按下瞬間有緩衝；空中可再跳一次＝二段跳，空中可改變方向）
    p.jumpBuf -= dt;
    if (p.jumpBuf > 0) {
      if (p.onGround) {
        p.vy = -11.5;
        p.onGround = false;
        p.airJumps = 1;
        p.jumpBuf = 0;
        sfx.jump();
        burst(p.x, GROUND_Y - 2, 5, "#b9a58a");
      } else if (p.airJumps > 0) {
        p.airJumps = 0;
        p.vy = -11;
        p.jumpBuf = 0;
        beep(430, 0.1, "sine", 0.05, 260);
        burst(p.x, p.y + p.h / 2, 8, "#c9a5ff");
      }
    }

    // 射擊：固定週期累加器——頻率完全一致（不受螢幕刷新率/幀抖動影響、不漂移、不突發）
    const fireInt = weaponCd() * (p.rapidT > 0 ? 0.5 : 1);
    if (inFire()) {
      if (!p.fireHeld) p.fireAcc = fireInt; // 按下瞬間：首發立即
      p.fireHeld = true;
      p.fireAcc += dt;
      while (p.fireAcc >= fireInt) {
        p.fireAcc -= fireInt;
        const aim = currentAim();
        if (p.spreadT > 0) shootSpread(aim.dx, aim.dy);
        else shoot(aim.dx, aim.dy);
      }
    } else {
      p.fireHeld = false;
      p.fireAcc = 0;
    }
  }

  // 道具效果倒數
  if (p.rapidT > 0) p.rapidT -= dt;
  if (p.spreadT > 0) p.spreadT -= dt;

  // 重力與位移
  p.vy += GRAVITY * dt60;
  p.x += p.vx * dt60;
  p.y += p.vy * dt60;
  if (p.x < LEFT_WALL + p.w / 2) { p.x = LEFT_WALL + p.w / 2; p.vx = 0; }
  // 鐘乳石柱：擋路；朝它按住方向可把它「推下」（慢慢沉進地面）
  // 推到矮到跳得過就可以跳過，不一定要全部推掉；也能站上柱頂
  let onPillar = false;
  for (const pl of pillars) {
    if (pl.opened) continue;
    const ph = pl.h * (1 - pl.sunk); // 目前高度
    if (ph < 14) {
      pl.opened = true;
      sfx.door();
      burst(pl.x, GROUND_Y - 30, 18, "#b9a58a");
      showBanner("整根推下去了！", 1.2);
      continue;
    }
    const top = GROUND_Y - ph;
    const half = pl.w / 2 + p.w / 2 - 6;
    const pBottom = p.y + p.h / 2;
    if (Math.abs(p.x - pl.x) < half) {
      const tol = Math.max(6, p.vy + 4); // 快速下落時放寬落地判定
      if (pBottom <= top + tol && p.vy >= 0) {
        // 落在柱頂
        p.y = top - p.h / 2;
        p.vy = 0;
        onPillar = true;
      } else if (pBottom > top + tol) {
        // 側面碰撞：擋住
        const side = p.x < pl.x ? -1 : 1; // 玩家在柱子哪一側
        p.x = pl.x + side * half;
        p.vx = 0;
        // 推：朝柱子按住方向 → 把它往下推
        const inputDir = inLeft() ? -1 : inRight() ? 1 : 0;
        if (inputDir === -side) {
          pl.sunk = Math.min(1, pl.sunk + dt / 1.2);
          if (Math.random() < 0.3) burst(pl.x + side * pl.w / 2, GROUND_Y - 6 - Math.random() * Math.min(50, ph), 1, "#cbb794");
        }
      }
    }
  }
  if (state.mode === "shop" && p.x > W - 300) { p.x = W - 300; p.vx = 0; } // 商店場地右界

  // 落地（地面或柱頂）
  if (p.y + p.h / 2 >= GROUND_Y) {
    if (p.falling) {
      p.falling = false;
      fallDone = true;
      burst(p.x, GROUND_Y, 14, "#b9a58a");
      sfx.land();
    }
    p.y = GROUND_Y - p.h / 2;
    p.vy = 0;
    p.onGround = true;
  } else {
    p.onGround = onPillar;
  }

  if (p.inv > 0) p.inv -= dt;
}

function shoot(dx, dy) {
  const p = player;
  const w = WEAPONS[state.weapon];
  if (w.beam) { fireBeam(dx, dy); return; }
  let gx, gy;
  if (dy < -0.5)      { gx = p.x + dx * 8; gy = p.y - 24; }
  else if (dy > 0.5)  { gx = p.x + dx * 8; gy = p.y + 18; }
  else                { gx = p.x + p.facing * 16; gy = p.y - 5; }
  // 火焰有隨機散射角
  let a = 0;
  if (w.flame) a = (Math.random() - 0.5) * w.spread * 2;
  const c = Math.cos(a), s = Math.sin(a);
  const vx = (dx * c - dy * s) * w.speed;
  const vy = (dx * s + dy * c) * w.speed;
  bullets.push({
    x: gx, y: gy, vx, vy,
    life: w.life, w: state.weapon, dmg: weaponDmg(),
    color: w.color,
    pierce: !!w.pierce,
    flame: !!w.flame,
    r: w.flame ? 3 : 0,
    hit: null, hitBoss: false,
  });
  particles.push({ x: gx, y: gy, vx: 0, vy: 0, life: 0.06, size: w.flame ? 10 : 7, color: w.color });
  // 音效（每把槍不同）
  if (state.weapon === "laser") beep(1400, 0.1, "sawtooth", 0.025, -900);
  else if (state.weapon === "flame") beep(160, 0.06, "sawtooth", 0.015, 60);
  else if (state.weapon === "mg") beep(700, 0.05, "square", 0.02, -350);
  else sfx.shoot();
}

// 散射：朝 ±11.5° 各多打一顆
function shootSpread(dx, dy) {
  for (const a of [-0.2, 0, 0.2]) {
    const c = Math.cos(a), s = Math.sin(a);
    shoot(dx * c - dy * s, dx * s + dy * c);
  }
}

// 雷射：發射一道「一直線光束」（不是一顆顆子彈，整排直接貫穿）
function fireBeam(dx, dy) {
  const p = player;
  const w = WEAPONS.laser;
  const ang = Math.atan2(dy, dx);
  let gx, gy;
  if (dy < -0.5)      { gx = p.x + dx * 8; gy = p.y - 24; }
  else if (dy > 0.5)  { gx = p.x + dx * 8; gy = p.y + 18; }
  else                { gx = p.x + dx * 14; gy = p.y - 5; }
  const L = 760;
  let x2 = gx + Math.cos(ang) * L, y2 = gy + Math.sin(ang) * L;
  // 射到地面就止
  if (y2 > GROUND_Y - 2 && y2 > gy) {
    const k = (GROUND_Y - 2 - gy) / (y2 - gy);
    x2 = gx + (x2 - gx) * k;
    y2 = GROUND_Y - 2;
  }
  beams.push({ x1: gx, y1: gy, x2, y2, t: 0, life: 0.14, dmg: weaponDmg(), hit: new Set(), hitBoss: false, color: w.color });
  particles.push({ x: gx, y: gy, vx: 0, vy: 0, life: 0.06, size: 10, color: w.color });
  beep(1400, 0.12, "sawtooth", 0.03, -900);
}

// 點到線段的最短距離（光束命中判定用）
function ptSegDist(px, py, b) {
  const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
  const L2 = dx * dx + dy * dy;
  const t = L2 ? clamp(((px - b.x1) * dx + (py - b.y1) * dy) / L2, 0, 1) : 0;
  return Math.hypot(px - (b.x1 + dx * t), py - (b.y1 + dy * t));
}

// 光束線段是否掃過 Boss（沿線取樣點判定）
function beamHitsBoss(b) {
  const steps = Math.max(1, Math.ceil(Math.hypot(b.x2 - b.x1, b.y2 - b.y1) / 12));
  for (let i = 0; i <= steps; i++) {
    const x = b.x1 + (b.x2 - b.x1) * (i / steps);
    const y = b.y1 + (b.y2 - b.y1) * (i / steps);
    if (Math.abs(x - boss.x) < boss.w / 2 + 4 && Math.abs(y - boss.y) < boss.h / 2 + 4) return true;
  }
  return false;
}

// 敵人受創（子彈 / 光束共用）
function damageEnemy(e, dmg, color) {
  e.hp -= dmg;
  burst(e.x, e.y, 4, color);
  if (e.hp <= 0) {
    const color2 = e.type === "mushroom" ? "#e04040" : e.type === "turtle" ? "#6fae4e" : "#e33b3b";
    burst(e.x, e.y, 12, color2);
    sfx.kill();
    // 關卡殺敵：分數＋硬幣雙賺（商店不再有戰鬥）
    const g = SHOP_GOLD[e.type];
    state.gold += g;
    state.score += e.score;
    popups.push({ x: e.x, y: e.y - 22, text: "+" + e.score, life: 0.9 });
    popups.push({ x: e.x, y: e.y - 2, text: "+" + g + " 硬幣", life: 0.9, color: "#ffd54a" });
    dropLoot(e);
    prog.kills++; checkAch(); // 成就：擊殺類＋硬幣
  } else {
    beep(200, 0.05, "square", 0.02);
  }
}

function updateDoors(dt) {
  if (state.mode === "shop") return; // 商店不刷怪：關卡殺敵賺硬幣、商店花錢
  // Boss 專屬舞台：Boss 巨門前 100m 切換該 Boss 的配色
  if (state.mode === "playing" &&
      bossIdx < BOSS_SCHEDULE.length && !boss && !bossIntro && !bossStage) {
    const next = BOSS_SCHEDULE[bossIdx];
    if (maxDist >= next.dist - 100) {
      bossStage = next.type;
      theme = { ...THEMES[caveKey], ...BOSS_THEMES[next.type] };
      showBanner("進入「" + BOSS_NAMES[next.type] + "」的領地……", 2.2);
      beep(180, 0.5, "sawtooth", 0.04, -60);
    }
  }
  // 關卡：距離到了就開 Boss 巨門（洞口前 150m 內不出門）
  if (state.mode === "playing" &&
      bossIdx < BOSS_SCHEDULE.length &&
      !boss && !bossIntro && !doors.some((d) => d.boss) &&
      maxDist >= BOSS_SCHEDULE[bossIdx].dist && maxDist < END_DIST - 150) {
    spawnBossDoor();
  }
  // Boss 期間不出普通門
  const bossBusy = boss !== null || doors.some((d) => d.boss);
  doorTimer -= dt;
  if (doorTimer <= 0 && !bossBusy) {
    spawnDoor();
    const diff = Math.min(1, state.time / 120); // 120 秒內難度爬升
    doorTimer = (2.6 - 1.4 * diff) * (0.7 + Math.random() * 0.6);
  }
  for (const d of doors) {
    d.age += dt;
    const warnT = d.boss ? 1.8 : 1.1;
    if (d.phase === 0 && d.age > warnT) {
      d.phase = 1; d.age = 0; sfx.door();
      if (d.boss) { spawnBoss(d.x); d.count = 0; }
    }
    if (d.phase === 1) {
      d.next -= dt;
      if (d.count > 0 && d.next <= 0) {
        spawnFromDoor(d);
        d.count--;
        d.next = 0.3;
      }
      if (d.count === 0 && d.age > 0.8) { d.phase = 2; d.age = 0; }
    }
    if (d.phase === 2) {
      d.closeT = d.age;
      if (d.age > 0.4) d.dead = true;
    }
  }
  doors = doors.filter((d) => !d.dead && d.x > state.camX - 500 && d.x < state.camX + W + 500);
}

function updateEnemies(dt) {
  const p = player;
  // 怒奴集體攻擊（第二階段）：≥2 隻時，分散到畫面邊緣（有高有低）→ 同時朝主角齊射 → 歸位
  const nunus = enemies.filter((e) => e.type === "nunu" && e.hp > 0);
  if (nunuGroup === "idle") {
    nunuGroupCd -= dt;
    if (nunuGroupCd <= 0 && nunus.length >= 2) {
      nunuGroup = "active";
      const heights = [GROUND_Y - 200, GROUND_Y - 255, GROUND_Y - 110]; // 有高有低
      nunus.forEach((e, i) => {
        const n = nunus.length;
        e.gmode = "gather";
        e.gx = state.camX + 90 + (i * (W - 180)) / Math.max(1, n - 1);
        e.gy = heights[i % 3];
        e.vy = 0;
      });
      showBanner("⚠ 怒奴集體攻擊！", 1.6);
      beep(240, 0.3, "square", 0.04, 160);
    }
  } else if (nunuGroup === "active" && (nunus.length === 0 || nunus.every((e) => !e.gmode))) {
    nunuGroup = "idle";
    nunuGroupCd = 7 + Math.random() * 3;
  }
  for (const e of enemies) {
    e.t += dt;
    const dir = p.x > e.x ? 1 : -1;
    const dist = Math.abs(p.x - e.x);
    const targetable = !p.falling && !p.dead;
    // 攻擊冷卻與蓄力
    e.atkCd -= dt;
    if (e.atkState === 1) {
      e.atkT -= dt;
      if (e.atkT <= 0) {
        e.atkState = 0;
        enemyAttack(e, dir);
      }
    } else if (targetable && e.atkCd <= 0) {
      if (e.type === "red" && dist > 60 && dist < 460 && e.onGround) {
        e.atkState = 1; e.atkT = 0.4; e.atkCd = 2.2 + Math.random() * 1.4;
      } else if (e.type === "nunu" && !e.gmode && dist > 60 && dist < 480 && e.onGround) {
        e.atkState = 1; e.atkT = 0.45; e.atkCd = 1.9 + Math.random() * 1.2; // 第二階段：更兇更勤
      } else if (e.type === "turtle" && dist > 50 && dist < 280) {
        e.atkState = 1; e.atkT = 0.5; e.atkCd = 2.6 + Math.random() * 1.6;
      } else if (e.type === "mushroom" && dist > 80 && dist < 420 && e.onGround) {
        e.atkState = 1; e.atkT = 0.35; e.atkCd = 3 + Math.random() * 1.5;
      } else if (e.type === "bouncy" && dist > 50 && dist < 420) {
        e.atkState = 1; e.atkT = 0.25; e.atkCd = 1.8 + Math.random();
      }
    }
    const attacking = e.atkState === 1;
    if (e.type === "mushroom") {
      if (e.onGround && !attacking) e.vy = -6.5 - Math.random(); // 一直彈跳
      e.vx = attacking ? 0 : dir * 1.6;
      if (attacking && e.onGround) e.vy = -4; // 起跳丟孢子
    } else if (e.type === "turtle") {
      e.vx = attacking ? 0 : dir * 1.2;
    } else if (e.type === "bouncy") {
      // 彈彈怪：落地就彈起（vy 固定 -13，彈跳更高～154px），水平速度保持、撞牆才反向
      if (e.onGround) e.vy = -13;
    } else if (e.type === "nunu") {
      // 怒奴（第二階段）：比紅紅怪稍慢但更兇；集體攻擊時由 gmode 控制
      e.vx = e.gmode ? 0 : (attacking ? 0 : dir * 2.2);
    } else { // red：又小又快又兇
      e.vx = attacking ? 0 : dir * 2.6;
      if (!attacking && e.onGround && Math.random() < 0.03) e.vy = -5;
    }
    e.facing = dir;

    e.vy += e.gmode ? 0 : GRAVITY * dt60; // 集體攻擊模式：自由飛行（忽略重力）
    e.x += e.vx * dt60;
    e.y += e.vy * dt60;
    if (e.y + e.h / 2 >= GROUND_Y) {
      e.y = GROUND_Y - e.h / 2;
      e.vy = 0;
      e.onGround = true;
    } else {
      e.onGround = false;
    }

    // 彈彈怪：撞左牆與螢幕左右邊界反彈（像彈珠一樣關在畫面裡）；撞鐘乳石柱也反彈
    if (e.type === "bouncy") {
      if (e.x < state.camX + 26) { e.x = state.camX + 26; e.vx = Math.abs(e.vx); }
      else if (e.x > state.camX + W - 26) { e.x = state.camX + W - 26; e.vx = -Math.abs(e.vx); }
      for (const pl of pillars) {
        if (pl.opened) continue;
        const ph = pl.h * (1 - pl.sunk);
        if (ph < 14) continue;
        const top = GROUND_Y - ph;
        const half = pl.w / 2 + e.w / 2 - 4;
        // 只擋「身體確實碰到柱身」的弹珠（彈得比矮柱還高時可以彈過去）
        if (Math.abs(e.x - pl.x) < half && e.y + e.h / 2 > top + 4) {
          const side = e.x < pl.x ? -1 : 1;
          e.x = pl.x + side * half;
          e.vx = side === -1 ? -Math.abs(e.vx) : Math.abs(e.vx);
        }
      }
    }

    // 怒奴集體攻擊：飛向分配的畫面邊緣 slot / 懸停齊射 / 歸位
    if (e.gmode) {
      const dx = e.gx - e.x, dy = e.gy - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.gmode === "gather") {
        if (d > 10) {
          e.x += (dx / d) * 5 * dt60;
          e.y += (dy / d) * 5 * dt60;
        } else {
          e.gmode = "hold";
          e.gt = 0.3;
        }
      } else if (e.gmode === "hold") {
        e.x = e.gx;
        e.y = e.gy + Math.sin(e.t * 6) * 6; // 懸停擺動
        e.gt -= dt;
        if (e.gt <= 0) {
          // 同時朝主角三發（彈雨）
          const base = Math.atan2(p.y - e.y, p.x - e.x);
          for (let i = -1; i <= 1; i++) {
            const a = base + i * 0.16;
            ebullets.push({ x: e.x, y: e.y, vx: Math.cos(a) * 5.4, vy: Math.sin(a) * 5.4, r: 6, life: 4, color: "#c03535", grav: false });
          }
          beep(500, 0.08, "square", 0.035, -250);
          e.gmode = "return";
          e.gx = e.x;
          e.gy = GROUND_Y - e.h / 2;
        }
      } else if (e.gmode === "return") {
        if (d > 10) {
          e.x += (dx / d) * 4.5 * dt60;
          e.y += (dy / d) * 4.5 * dt60;
        } else {
          e.gmode = null;
        }
      }
    }

    // 碰到玩家就受傷（沒有踩頭這回事！）
    if (p.inv <= 0 && !p.falling && !p.dead && rectsOverlap(e, p)) hurtPlayer(dir);
  }
  enemies = enemies.filter(
    (e) => e.hp > 0 && e.x > state.camX - 260 && e.x < state.camX + W + 260
  );
}

// ---------------- 暗影獵手（打不死的空中獵者：懸浮＋預警俯衝） ----------------
const SHADOW_HOVER = 175; // 懸浮高度（離地 px；比二段跳最高點安全，但俯衝會下來）
function updateShadow(dt) {
  if (!shadow) return;
  const s = shadow, p = player;
  s.t += dt;
  const dist = p.x - s.x;
  if (s.dying) {
    s.fade -= dt / 0.8;
    if (s.fade <= 0) { shadow = null; burst(s.x, s.y, 16, "#4a3a6a"); }
    return;
  }
  // ~900m 劇情光柱：強制消散
  if (maxDist >= 900) {
    s.dying = true;
    showBanner("一道光柱掃過——暗影消散了", 2.2);
    beep(880, 0.6, "sine", 0.03, -500);
    return;
  }
  // 約 45 秒後：飛離畫面
  if (s.t >= 45 && s.state !== "leaving") {
    s.state = "leaving";
    s.vx = (p.x > s.x ? -1 : 1) * 2.5;
    s.vy = -5;
    showBanner("暗影獵手飛離了……", 2);
    beep(140, 0.5, "sine", 0.03, -300);
  }
  if (s.state === "leaving") {
    s.x += s.vx * dt60;
    s.y += s.vy * dt60;
    if (s.y < -60) shadow = null;
    return;
  }
  if (s.state === "enter") {
    // 從畫面上方降下到懸浮高度，同時橫向靠近主角正上方
    s.y += s.vy * dt60;
    if (Math.abs(dist) > 26) s.x += Math.sign(dist) * 1.6 * dt60;
    if (s.y >= GROUND_Y - SHADOW_HOVER) { s.y = GROUND_Y - SHADOW_HOVER; s.state = "hover"; }
  } else if (s.state === "hover") {
    // 懸浮在主角上方（追速 3.0 < 主角 4.2，一直跑可以甩掉）
    // 隨機漂移：每 0.9~2.3 秒換懸浮高度（離地 140~215px）與橫向偏移（±90px），不死板
    s.driftT -= dt;
    if (s.driftT <= 0) {
      s.hoverY = GROUND_Y - (140 + Math.random() * 75);
      s.hoverOff = Math.random() * 180 - 90;
      s.driftT = 0.9 + Math.random() * 1.4;
    }
    const ty = s.hoverY + Math.sin(s.t * 2.2) * 10;
    const tx = p.x + s.hoverOff;
    s.y += (ty - s.y) * Math.min(1, dt * 4);
    if (Math.abs(tx - s.x) > 8) s.x += Math.sign(tx - s.x) * 3.0 * dt60;
    s.swoopCd -= dt;
    if (s.swoopCd <= 0 && Math.abs(dist) < 420) {
      s.state = "warn";
      s.swoopT = 0.7;
      s.swoopCd = 4 + Math.random() * 2.5;
    }
  } else if (s.state === "warn") {
    // 在主角正上方顫動預警——閃避或站到鐘乳石柱後的關鍵時刻
    s.swoopT -= dt;
    s.x += (p.x - s.x) * Math.min(1, dt * 5);
    s.y = GROUND_Y - SHADOW_HOVER + Math.sin(s.t * 30) * 3;
    if (Math.random() < 0.25) beep(760, 0.05, "square", 0.025, -150);
    if (s.swoopT <= 0) {
      s.state = "swoop";
      s.swoopT = 1.6; // 俯衝最長持續
      const dx = p.x - s.x, dy = p.y - s.y;
      const len = Math.hypot(dx, dy) || 1;
      const spd = 8.2; // 快於主角（4.2）但躲得掉
      s.vx = (dx / len) * spd;
      s.vy = (dy / len) * spd;
      beep(300, 0.25, "sawtooth", 0.04, 400); // 颳風聲
    }
  } else if (s.state === "swoop") {
    s.x += s.vx * dt60;
    s.y += s.vy * dt60;
    s.swoopT -= dt;
    // 俯衝時撞到未推下的鐘乳石柱 → 反彈（鐘乳石柱＝主角的護盾）
    for (const pl of pillars) {
      if (pl.opened) continue;
      const ph = pl.h * (1 - pl.sunk);
      if (ph < 20) continue;
      const top = GROUND_Y - ph;
      const half = pl.w / 2 + 14;
      if (Math.abs(s.x - pl.x) < half && s.y > top) {
        const side = s.x < pl.x ? -1 : 1;
        s.x = pl.x + side * half;
        s.vx = side * Math.abs(s.vx);
        burst(s.x, s.y, 8, "#9a7ae0");
        beep(200, 0.1, "square", 0.04, -100);
        s.state = "back";
        break;
      }
    }
    if (s.state === "swoop") {
      if (s.y >= GROUND_Y - 22) { s.y = GROUND_Y - 22; burst(s.x, s.y + 8, 6, "#6a4a9a"); s.state = "back"; } // 撞地折返
      if (s.swoopT <= 0) s.state = "back";
    }
  } else if (s.state === "back") {
    // 飛回主角上方的隨機懸浮位
    const ty = s.hoverY, tx = p.x + s.hoverOff;
    s.y += (ty - s.y) * Math.min(1, dt * 3);
    s.x += (tx - s.x) * Math.min(1, dt * 3);
    if (Math.abs(s.y - ty) < 8 && Math.abs(s.x - tx) < 30) s.state = "hover";
  }
  // 靠近時心跳音（紅色脈動見 drawHunter）
  s.bbT = (s.bbT || 0) + dt;
  if (Math.hypot(p.x - s.x, p.y - s.y) < 200 && s.bbT > 0.9) {
    s.bbT = 0;
    beep(70, 0.12, "sine", 0.05);
    beep(55, 0.1, "sine", 0.04);
  }
  // 碰到主角：-1 顆心（2 半顆）＋強擊退＋2 秒冷卻
  if (p.inv <= 0 && !p.falling && !p.dead &&
      Math.abs(s.x - p.x) < 26 && Math.abs(s.y - p.y) < 34) {
    const kd = p.x < s.x ? -1 : 1; // 擊退方向：遠離暗影
    state.hp -= 2;
    p.inv = 2;
    p.vy = -8;
    p.vx = kd * 10;
    shake = 0.35;
    sfx.hit();
    burst(p.x, p.y, 12, "#b06bff");
    if (state.hp <= 0) {
      p.dead = true;
      p.deadT = 0;
      state.mode = "dying";
      saveBest();
      saveShop();
      burst(p.x, p.y, 24, "#ff8a5c");
      sfx.death();
    }
  }
  // 甩掉：距離 >700px 保持 5 秒 → 消散
  if (Math.abs(dist) > 700) {
    s.farT += dt;
    if (s.farT >= 5) {
      s.dying = true;
      showBanner("暗影消散了……", 2);
      beep(140, 0.5, "sine", 0.03, -300);
    }
  } else {
    s.farT = 0;
  }
}

// 三種怪物的攻擊（射程比上一版更遠）
function enemyAttack(e, dir) {
  const p = player;
  if (e.type === "red") {
    // 朝玩家吐酸液（又準又遠）
    const ang = Math.atan2((p.y - 6) - e.y, p.x - e.x);
    ebullets.push({ x: e.x + dir * 8, y: e.y - 2, vx: Math.cos(ang) * 5.2, vy: Math.sin(ang) * 5.2, r: 4, life: 5, color: "#8ee04a", grav: false });
    beep(700, 0.06, "square", 0.02, -300);
  } else if (e.type === "nunu") {
    // 怒奴（第二階段）：三發暗紅酸液連噴（比紅紅怪更快更準）
    const ang = Math.atan2((p.y - 6) - e.y, p.x - e.x);
    for (const a of [-0.18, 0, 0.18]) {
      const aa = ang + a;
      ebullets.push({ x: e.x + Math.cos(aa) * 10, y: e.y + Math.sin(aa) * 10, vx: Math.cos(aa) * 5.8, vy: Math.sin(aa) * 5.8, r: 4, life: 5, color: "#c03535", grav: false });
    }
    beep(620, 0.07, "square", 0.025, -250);
  } else if (e.type === "turtle") {
    // 朝玩家方向噴三發殼刺
    for (const a of [-0.16, 0, 0.16]) {
      ebullets.push({ x: e.x + dir * 18, y: e.y - 2, vx: Math.cos(a) * 4.4 * dir, vy: Math.sin(a) * 4.4, r: 4, life: 5, color: "#a8d080", grav: false });
    }
    beep(320, 0.1, "square", 0.025, -120);
  } else if (e.type === "bouncy") {
    // 高彈速直線子彈（瞄準玩家）
    const ang = Math.atan2(p.y - e.y, p.x - e.x);
    ebullets.push({ x: e.x + Math.cos(ang) * 14, y: e.y + Math.sin(ang) * 14, vx: Math.cos(ang) * 6, vy: Math.sin(ang) * 6, r: 5, life: 5, color: "#c8f04a", grav: false });
    beep(600, 0.07, "square", 0.025, -150);
  } else { // mushroom
    // 起跳後丟出拋物線孢子
    ebullets.push({ x: e.x, y: e.y - 14, vx: dir * (1.8 + Math.random() * 0.8), vy: -5.4, r: 5, life: 6, color: "#c8e080", grav: true });
    beep(520, 0.08, "triangle", 0.025, 200);
  }
}

function updateEBullets(dt) {
  const p = player;
  for (const b of ebullets) {
    b.life -= dt;
    if (b.grav) b.vy += GRAVITY * 0.55 * dt60;
    b.x += b.vx * dt60;
    b.y += b.vy * dt60;
    if (b.y > GROUND_Y - 2 && b.grav) {
      if (b.rock) {
        // 落石接地 → 變成碎石（要二段跳跨過去）
        groundRocks.push({ x: b.x, w: 56, t: 2.6 });
        burst(b.x, GROUND_Y - 2, 8, "#9a8a76");
        shake = Math.max(shake, 0.2);
      } else {
        burst(b.x, GROUND_Y - 2, 4, b.color);
      }
      b.life = 0;
    }
    if (p.inv <= 0 && !p.falling && !p.dead &&
        Math.abs(b.x - p.x) < p.w / 2 + b.r &&
        Math.abs(b.y - p.y) < p.h / 2 + b.r) {
      hurtPlayer(b.vx > 0 ? -1 : 1);
      b.life = 0;
    }
  }
  ebullets = ebullets.filter(
    (b) => b.life > 0 && b.x > state.camX - 320 && b.x < state.camX + W + 320
  );
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.life -= dt;
    b.x += b.vx * dt60;
    b.y += b.vy * dt60;
    if (b.flame) b.r = Math.min(11, 3 + (0.55 - b.life) * 14);
    if (b.y > GROUND_Y - 2) { b.life = 0; burst(b.x, GROUND_Y - 2, 3, b.color); continue; }
    const hitR = b.flame ? b.r + 2 : 6; // 6：站著水平射可穩命中小怪（5 會差 1px 擦頭）
    for (const e of enemies) {
      if (e.hp <= 0) continue;
      if (b.pierce && b.hit && b.hit.includes(e)) continue;
      if (Math.abs(b.x - e.x) < e.w / 2 + hitR &&
          Math.abs(b.y - e.y) < e.h / 2 + hitR) {
        if (b.pierce) { if (!b.hit) b.hit = []; b.hit.push(e); }
        else b.life = 0;
        damageEnemy(e, b.dmg, b.color);
        break;
      }
    }
    if (b.life > 0 && boss && b.y < GROUND_Y) {
      if (b.pierce && b.hitBoss) { /* 貫穿已命中過 */ }
      else if (Math.abs(b.x - boss.x) < boss.w / 2 + 8 &&
               Math.abs(b.y - boss.y) < boss.h / 2 + 8) {
        if (boss.shell) {
          // 龜殼無敵：子彈彈開
          burst(b.x, b.y, 4, "#a8d080");
          beep(900, 0.05, "square", 0.025, -300);
          b.life = 0;
        } else {
          boss.hp -= b.dmg;
          burst(b.x, b.y, 6, b.color);
          if (b.pierce) b.hitBoss = true;
          else b.life = 0;
          beep(240, 0.06, "square", 0.03);
          if (boss.hp <= 0) bossTakeOut();
        }
      }
    }
  }
  bullets = bullets.filter(
    (b) => b.life > 0 && b.x > state.camX - 320 && b.x < state.camX + W + 320
  );
}

function updateBeams(dt) {
  for (const b of beams) {
    b.t += dt;
    if (b.t > b.life) continue;
    // 光束命中直線上的所有敵人（每道光束各打一次）
    for (const e of enemies) {
      if (e.hp <= 0 || b.hit.has(e)) continue;
      if (ptSegDist(e.x, e.y, b) < Math.max(e.w, e.h) / 2 + 8) {
        b.hit.add(e);
        damageEnemy(e, b.dmg, b.color);
      }
    }
    if (boss && !b.hitBoss && beamHitsBoss(b)) {
      b.hitBoss = true;
      if (boss.shell) {
        burst(boss.x - boss.facing * 20, boss.y, 6, b.color);
        beep(900, 0.05, "square", 0.025, -300);
      } else {
        boss.hp -= b.dmg;
        burst(boss.x - boss.facing * 20, boss.y, 6, b.color);
        beep(240, 0.06, "square", 0.03);
        if (boss.hp <= 0) bossTakeOut();
      }
    }
  }
  beams = beams.filter((b) => b.t < b.life);
}

function updateItems(dt) {
  const p = player;
  for (const it of items) {
    it.t += dt;
    it.life -= dt;
    if (!it.onGround) {
      it.vy += GRAVITY * 0.7 * dt60;
      it.x += it.vx * dt60;
      it.y += it.vy * dt60;
      if (it.y > GROUND_Y - 10) { it.y = GROUND_Y - 10; it.onGround = true; it.vy = 0; }
    }
    if (state.mode !== "shop" &&
        Math.abs(it.x - p.x) < 26 && Math.abs(it.y - p.y) < 30) {
      applyItem(it);
      it.life = 0;
    }
  }
  items = items.filter((it) => it.life > 0 && it.x > state.camX - 200 && it.x < state.camX + W + 200);
}

// ---------------- Boss ----------------
function updateBoss(dt) {
  const b = boss, p = player;
  b.t += dt;
  b.atkCd -= dt;
  const dir = p.x > b.x ? 1 : -1;
  const dist = Math.abs(p.x - b.x);
  b.facing = dir;

  if (b.type === "king") {
    // 走位：在地面上彈跳接近
    if (b.onGround && !b.slamming) { b.vy = -7; b.vx = dir * 1.3; }
    // 攻擊
    if (b.atkCd <= 0 && !b.slamming) {
      const roll = Math.random();
      if (roll < 0.34 && dist > 120) {
        // 孢子彈幕：5 發扇形
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        for (let i = -2; i <= 2; i++) {
          const a = base + i * 0.18;
          ebullets.push({ x: b.x + dir * 30, y: b.y - 10, vx: Math.cos(a) * 4.6 * b.spd, vy: Math.sin(a) * 4.6 * b.spd, r: 6, life: 5, color: "#c8e080", grav: false });
        }
        beep(380, 0.12, "square", 0.03, -150);
        b.atkCd = 2.4 * b.cdMul + Math.random();
      } else if (roll < 0.62) {
        // 衝撞拍地
        b.slamming = true;
        b.vx = dir * 3.6 * (1 + 0.12 * (b.gen - 1));
        if (b.onGround) b.vy = -9;
        b.atkCd = 3 * b.cdMul + Math.random();
      } else if (roll < 0.82) {
        // 孢子雨：孢子從全畫面上方墜落
        const n = 8 + b.gen * 2;
        for (let i = 0; i < n; i++) {
          ebullets.push({ x: state.camX + 70 + Math.random() * (W - 140), y: -20 - Math.random() * 80, vx: (Math.random() - 0.5), vy: 0.4, r: 5, life: 8, color: "#c8e080", grav: true });
        }
        beep(240, 0.3, "triangle", 0.03, -140);
        burst(b.x, b.y - 40, 10, "#c8e080");
        b.atkCd = 3.2 * b.cdMul + Math.random();
      } else {
        // 召喚菇菇（2 代起 3 隻）
        const n = b.gen > 1 ? 3 : 2;
        for (let i = 0; i < n; i++) enemies.push(makeEnemy("mushroom", b.x - 70 + i * 70, b.y + 20));
        burst(b.x, b.y, 10, "#e04040");
        beep(180, 0.2, "sawtooth", 0.03, 60);
        b.atkCd = 3.2 * b.cdMul + Math.random();
      }
    }
    // 落地震屏
    if (b.slamming && b.onGround) {
      b.slamming = false;
      b.vx = 0;
      shake = 0.4;
      burst(b.x, GROUND_Y, 16, "#b9a58a");
      sfx.land();
    }
  } else if (b.type === "red") {
    // 怒怒 紅紅怪王：高速彈跳接近
    if (b.onGround && !b.charging) { b.vy = -9; b.vx = dir * 2.2; }
    if (b.atkCd <= 0 && !b.charging) {
      const roll = Math.random();
      if (roll < 0.45 && dist > 100) {
        // 酸液三連噴：3 發高速直線酸液朝玩家
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        for (let i = 0; i < 3; i++) {
          const a = base + (i - 1) * 0.1;
          ebullets.push({ x: b.x + dir * 26, y: b.y - 6, vx: Math.cos(a) * 6.2 * b.spd, vy: Math.sin(a) * 6.2 * b.spd, r: 6, life: 4, color: "#ff6a4a", grav: false });
        }
        beep(520, 0.1, "square", 0.03, -200);
        b.atkCd = 2.2 * b.cdMul + Math.random() * 0.6;
      } else if (roll < 0.85) {
        // 高速衝撞（比 Tank 快）
        b.charging = true;
        b.vx = dir * 5.8 * (1 + 0.1 * (b.gen - 1));
        if (b.onGround) b.vy = -10;
        b.atkCd = 2.6 * b.cdMul + Math.random();
      } else {
        // 尖刺放射：10 發
        const n = 10, base = Math.random() * Math.PI * 2;
        for (let i = 0; i < n; i++) {
          const a = base + (i / n) * Math.PI * 2;
          ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 3.6 * b.spd, vy: Math.sin(a) * 3.6 * b.spd, r: 5, life: 6, color: "#ff6a4a", grav: false });
        }
        beep(300, 0.16, "square", 0.035, -150);
        b.atkCd = 2.8 * b.cdMul + Math.random();
      }
    }
    if (b.charging && b.onGround) {
      b.charging = false;
      b.vx = 0;
      shake = 0.5;
      burst(b.x, GROUND_Y, 16, "#b9a58a");
      sfx.land();
    }
  } else {
    // Tank 巨龜將軍：縮殼週期——伸頸（可傷，原技能）↔ 縮殼（無敵，衝撞 3 次，第 3 次落石）
    if (b.phase === "out") {
      // 終結形態：殼裂開，慢速爬向主角（可傷，一發打死）
      if (b.onGround && !b.charging) { b.vy = -4; b.vx = dir * 0.6; }
    } else if (b.shell) {
      // 縮殼狀態（無敵）：追蹤主角衝撞最多 3 次（每次前重新瞄準當前位置）
      if (b.pauseT > 0) {
        b.pauseT -= dt;
        b.vx *= Math.pow(0.75, dt60);
        if (b.pauseT <= 0 && b.toExtend) {
          b.shell = false; b.phase = "extend"; b.extT = 4.5; b.toExtend = false;
          showBanner("巨龜伸頸——可攻擊了！", 1.8);
          beep(340, 0.2, "square", 0.04, 200);
        }
      } else if (!b.charging) {
        b.chargeCount++;
        b.charging = true;
        b.chargeT = 0.2; // 起跳保護：避免同幀就被判定「落地」
        b.vx = dir * (5.2 + 0.4 * (b.gen - 1));
        if (b.onGround) b.vy = -7;
        b.atkCd = 2.6 * b.cdMul;
        beep(150, 0.15, "sawtooth", 0.04, 120);
      }
      if (b.charging) {
        if (b.chargeT > 0) b.chargeT -= dt;
        if (b.chargeT <= 0 && b.onGround) {
        b.charging = false;
        b.vx = 0;
        shake = 0.5;
        burst(b.x, GROUND_Y, 18, "#b9a58a");
        sfx.land();
        if (b.chargeCount >= 3) {
          triggerRockfall(dir); // 第 3 次衝撞 → 落石！
          b.chargeCount = 0;
          b.toExtend = true;
          b.pauseT = 2.0; // 落石後短暫停歇，再伸頸
        } else {
          b.pauseT = 0.6;
        }
        }
      }
    } else {
      // 伸頸狀態：可被攻擊，保留原技能
      b.extT -= dt;
      if (b.onGround && !b.charging) { b.vy = -6; b.vx = dir * 1.0; }
      if (b.atkCd <= 0 && !b.charging) {
        const roll = Math.random();
        if (roll < 0.42) {
          // 殼刺彈幕：7 發朝玩家扇形
          const base = Math.atan2(p.y - b.y, p.x - b.x);
          for (let i = -3; i <= 3; i++) {
            const a = base + i * 0.14;
            ebullets.push({ x: b.x + dir * 40, y: b.y, vx: Math.cos(a) * 4.4 * b.spd, vy: Math.sin(a) * 4.4 * b.spd, r: 5, life: 6, color: "#a8d080", grav: false });
          }
          beep(320, 0.14, "square", 0.035, -150);
          b.atkCd = 2.6 * b.cdMul + Math.random();
        } else if (roll < 0.8) {
          // 殼刺漩渦：放射 12 發
          const n = 12, base = b.t * 0.7;
          for (let i = 0; i < n; i++) {
            const a = base + (i / n) * Math.PI * 2;
            ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 3.4 * b.spd, vy: Math.sin(a) * 3.4 * b.spd, r: 5, life: 6, color: "#a8d080", grav: false });
          }
          beep(300, 0.2, "square", 0.035, -160);
          b.atkCd = 3 * b.cdMul + Math.random();
        } else {
          // 召喚紅紅怪（2 代起 3 隻）
          const n = b.gen > 1 ? 3 : 2;
          for (let i = 0; i < n; i++) enemies.push(makeEnemy("red", b.x - 60 + i * 60, b.y + 20));
          burst(b.x, b.y, 10, "#e33b3b");
          beep(180, 0.2, "sawtooth", 0.03, 60);
          b.atkCd = 3 * b.cdMul + Math.random();
        }
      }
      if (b.extT <= 0) {
        // 縮進龜殼（無敵）
        b.shell = true; b.phase = "shell"; b.chargeCount = 0; b.pauseT = 0.8;
        showBanner("巨龜縮進殼裡——無敵！", 1.8);
        beep(120, 0.25, "sine", 0.05, -80);
      }
    }
  }

  b.vy += GRAVITY * dt60;
  b.x += b.vx * dt60;
  b.y += b.vy * dt60;
  if (b.y + b.h / 2 >= GROUND_Y) {
    b.y = GROUND_Y - b.h / 2;
    b.vy = 0;
    b.onGround = true;
  } else {
    b.onGround = false;
  }
  b.x = Math.max(b.x, state.camX + 60);
  b.x = Math.min(b.x, state.camX + W - 60);

  // 撞到玩家
  if (p.inv <= 0 && !p.falling && !p.dead &&
      Math.abs(b.x - p.x) < (b.w + p.w) / 2 &&
      Math.abs(b.y - p.y) < (b.h + p.h) / 2) {
    hurtPlayer(dir);
  }
}

// ---------------- 受傷 / 死亡 ----------------
function hurtPlayer(knockDir) {
  if (state.mode !== "playing") return;
  state.hp--; // 每次扣半顆心
  player.inv = 1.5;
  player.vy = -6;
  player.vx = knockDir * 4;
  shake = 0.35;
  sfx.hit();
  burst(player.x, player.y, 10, "#ff6b6b");
  if (state.hp <= 0) {
    player.dead = true;
    player.deadT = 0;
    state.mode = "dying";
    saveBest();
    saveShop(); // 死前賺到的硬幣保留
    burst(player.x, player.y, 24, "#ff8a5c");
    burst(player.x, player.y, 16, "#4a7fd4");
    sfx.death();
  }
}

// ---------------- 粒子 / 飄字 ----------------
function updateFx(dt) {
  for (const p of particles) {
    p.life -= dt;
    p.x += p.vx * dt60;
    p.y += p.vy * dt60;
    if (!p.rise) p.vy += (p.soft ? 0.02 : 0.15) * dt60; // rise＝持續上升（火星）/ soft＝慢墜（冰晶）
  }
  particles = particles.filter((p) => p.life > 0);
  for (const p of popups) {
    p.life -= dt;
    p.y -= 30 * dt;
  }
  popups = popups.filter((p) => p.life > 0);
  if (shake > 0) shake = Math.max(0, shake - dt * 1.8);
}

// ---------------- 攝影機 ----------------
function updateCamera(dt) {
  if (player.falling) return;
  if (player.x - 280 > state.camX) {
    // 往右推進：畫面跟隨，讓主角維持在畫面左側 280px
    state.camX += (player.x - 280 - state.camX) * Math.min(1, 6 * dt);
  } else if (player.x < state.camX + 140) {
    // 往左走：主角逼近畫面左緣（140px）時，畫面跟著往左，不會走出畫面
    state.camX += (player.x - 140 - state.camX) * Math.min(1, 8 * dt);
  }
  state.camX = Math.max(0, state.camX);
}

// ---------------- 主更新 ----------------
function update(dt) {
  dt60 = dt * 60;

  if (state.mode === "title") {
    state.time += dt;
    state.camX = (state.time * 12) % 3000;
    return;
  }

  if (state.mode === "story" || state.mode === "ending") {
    state.time += dt;
    state.camX += 0.6 * dt60;
    story.t += dt;
    if (story.t > story.per) story.skip();
    return;
  }

  if (state.mode === "dying") {
    const p = player;
    p.deadT += dt;
    p.vy += GRAVITY * dt60;
    p.x += p.vx * dt60;
    p.y += p.vy * dt60;
    p.vx *= Math.pow(0.9, dt60);
    if (p.y + p.h / 2 >= GROUND_Y) { p.y = GROUND_Y - p.h / 2; p.vy = 0; }
    if (p.inv > 0) p.inv -= dt;
    updateEnemies(dt);
    updateEBullets(dt);
    updateFx(dt);
    if (p.deadT > 1.5) { overSel = 0; state.mode = "gameover"; }
    return;
  }

  if (state.mode !== "playing" && state.mode !== "shop") return;
  if (state.paused) return;

  state.time += dt;

  // Boss 登場特寫：凍結戰鬥，只推進特效
  if (bossIntro) {
    bossIntro.t += dt;
    if (bossIntro.t >= bossIntro.dur) bossIntro = null;
    updateFx(dt);
    return;
  }

  // 中央提示倒數
  if (banner) {
    banner.t += dt;
    if (banner.t > banner.dur) banner = null;
  }

  if (state.mode === "playing") {
    // 怒奴延遲分裂（慢動作電影感）：倒數完畢，3 隻怒奴在死亡點爆開
    if (nunuSplitT > 0) {
      nunuSplitT -= dt;
      if (nunuSplitT <= 0) {
        for (let i = -1; i <= 1; i++) {
          const ne = makeEnemy("nunu", nunuSplitX + i * 80, nunuSplitY + 10);
          ne.nunuIdx = i + 2; // ①②③ 對應頂部 3 條 Boss 級血量條
          enemies.push(ne);
        }
        burst(nunuSplitX, nunuSplitY, 24, "#8a1a1a");
        nunuGroupCd = 3; // 分裂後 3 秒開始第一次集體攻擊
      }
    }
    // 關卡環境粒子：熔岩洞＝火星上升、冰洞＝冰晶飄落
    ambientT -= dt;
    if (ambientT <= 0) {
      if (caveKey === "lava") {
        ambientT = 0.06;
        particles.push({ x: state.camX + Math.random() * W, y: GROUND_Y - 4, vx: (Math.random() - 0.5) * 0.5, vy: -(0.8 + Math.random() * 1.4), life: 1.4 + Math.random(), size: 2 + Math.random() * 2, color: Math.random() < 0.5 ? "#ff8a3c" : "#ffd070", rise: true });
      } else if (caveKey === "ice") {
        ambientT = 0.1;
        particles.push({ x: state.camX + Math.random() * W, y: -6, vx: (Math.random() - 0.5) * 0.6, vy: 0.5 + Math.random() * 0.7, life: 3.5, size: 1.5 + Math.random() * 2, color: Math.random() < 0.5 ? "#d5f2ff" : "#7fd4ff", soft: true });
      } else {
        ambientT = 0.5;
      }
    }
    // 落石：預警倒數 → 生成落石；碎石倒數＋撞主角
    for (const rw of rockWarns) {
      rw.t -= dt;
      if (rw.t <= 0) {
        ebullets.push({ x: rw.x, y: -20, vx: 0, vy: 2.6, r: 11, life: 6, color: "#9a8a76", grav: true, rock: true });
        beep(200, 0.08, "square", 0.03, -150);
      }
    }
    rockWarns = rockWarns.filter((rw) => rw.t > 0);
    for (const gr of groundRocks) gr.t -= dt;
    groundRocks = groundRocks.filter((gr) => gr.t > 0);
    const pl = player;
    if (pl.inv <= 0 && !pl.falling && !pl.dead) {
      for (const gr of groundRocks) {
        if (Math.abs(pl.x - gr.x) < gr.w / 2 + pl.w / 2 - 8 && pl.y + pl.h / 2 > GROUND_Y - 22) {
          hurtPlayer(pl.x < gr.x ? -1 : 1);
          break;
        }
      }
    }
    updateCamera(dt);
    // 推進距離 = 最遠推進
    maxDist = Math.max(maxDist, (player.x - START_X) / 10);
    // 暗影獵手：300m 出沒，每關 1 隻（從空中出現）
    if (!shadow && !shadowSpawned && maxDist >= 300) {
      shadowSpawned = true;
      shadow = {
        x: Math.max(state.camX + 100, Math.min(state.camX + W - 100, player.x - 220)),
        y: -40, // 從畫面上方 descend
        vx: 0, vy: 3.5,
        t: 0, fade: 1, farT: 0, dying: false,
        state: "enter", swoopT: 0, swoopCd: 2.5,
        hoverY: GROUND_Y - SHADOW_HOVER, hoverOff: 0, driftT: 1, // 懸浮隨機漂移
      };
      showBanner("⚠ 暗影獵手出沒！（子彈無效，用鐘乳石柱擋它的俯衝）", 2.8);
      sfx.door();
    }
    // 到達洞口 → 結局
    if (maxDist >= END_DIST) {
      state.mode = "ending";
      story.start(STORY_END);
      saveBest();
      saveShop();
      prog.raids++; checkAch(); // 成就：清關
      beep(660, 0.5, "sine", 0.05, 200);
      return;
    }
  }

  updatePlayer(dt);
  if (state.mode === "shop") state.camX = 0; // 商店鏡頭鎖死
  updateDoors(dt);
  updateEnemies(dt);
  if (state.mode === "playing") updateShadow(dt);
  if (boss) updateBoss(dt);
  updateBullets(dt);
  updateBeams(dt);
  updateEBullets(dt);
  updateItems(dt);
  updateFx(dt);
}

// ---------------- 繪圖 ----------------
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, theme.bg[0]);
  g.addColorStop(0.7, theme.bg[1]);
  g.addColorStop(1, theme.bg[2]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // 遠景岩層（視差 0.25）
  ctx.fillStyle = theme.rockFar;
  const off1 = (state.camX * 0.25) % 320;
  for (let i = -1; i < W / 320 + 2; i++) {
    const bx = i * 320 - off1;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND_Y);
    ctx.lineTo(bx + 60, 140 + rnd(i + 10) * 90);
    ctx.lineTo(bx + 160, 220 + rnd(i + 20) * 80);
    ctx.lineTo(bx + 320, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
  // 中景岩層（視差 0.5）
  ctx.fillStyle = theme.rockMid;
  const off2 = (state.camX * 0.5) % 260;
  for (let i = -1; i < W / 260 + 2; i++) {
    const bx = i * 260 - off2;
    ctx.beginPath();
    ctx.moveTo(bx, GROUND_Y);
    ctx.lineTo(bx + 80, 240 + rnd(i + 40) * 70);
    ctx.lineTo(bx + 180, 320 + rnd(i + 50) * 60);
    ctx.lineTo(bx + 260, GROUND_Y);
    ctx.closePath();
    ctx.fill();
  }
  // 鐘乳石（視差 0.9）
  ctx.fillStyle = theme.stal;
  const off3 = state.camX * 0.9;
  const start = Math.floor(off3 / 90);
  for (let i = start; i < start + W / 90 + 2; i++) {
    const bx = i * 90 - off3;
    const len = 30 + rnd(i) * 70;
    ctx.beginPath();
    ctx.moveTo(bx - 12, 0);
    ctx.lineTo(bx + 12, 0);
    ctx.lineTo(bx, len);
    ctx.closePath();
    ctx.fill();
  }
  // 洞穴深处的微光
  const glowX = W * 0.8;
  const rg = ctx.createRadialGradient(glowX, 300, 20, glowX, 300, 400);
  rg.addColorStop(0, `rgba(${theme.glow}, 0.10)`);
  rg.addColorStop(1, `rgba(${theme.glow}, 0)`);
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, H);
}

function drawGround() {
  ctx.fillStyle = theme.ground;
  ctx.fillRect(0, GROUND_Y, W, H - GROUND_Y);
  ctx.fillStyle = theme.groundTop;
  ctx.fillRect(0, GROUND_Y, W, 8);
  // 地表紋理（跟著鏡頭走）
  ctx.fillStyle = theme.groundTex;
  const off = state.camX % 40;
  for (let x = -off; x < W; x += 40) {
    ctx.fillRect(x, GROUND_Y + 18, 22, 4);
    ctx.fillRect(x + 18, GROUND_Y + 38, 14, 4);
  }
}

function drawLeftWall() {
  ctx.fillStyle = theme.wall;
  ctx.fillRect(0, 0, LEFT_WALL, GROUND_Y);
  ctx.fillStyle = theme.wallBlock;
  for (let y = 10; y < GROUND_Y; y += 46) {
    ctx.fillRect(0, y, LEFT_WALL - 4, 30);
  }
}

function drawShopWall() {
  // 商店場地右側的石牆（面板在更右邊）
  const wx = W - 278;
  ctx.fillStyle = theme.wall;
  ctx.fillRect(wx, 0, 20, GROUND_Y);
  ctx.fillStyle = theme.wallBlock;
  for (let y = 10; y < GROUND_Y; y += 46) {
    ctx.fillRect(wx + 2, y, 16, 30);
  }
}

// 洞口（關卡終點）
function drawExit() {
  const ex = endX;
  if (ex - state.camX > W + 400) return;
  // 從洞口灑進來的光
  const g = ctx.createLinearGradient(ex - 150, 0, ex + 250, 0);
  g.addColorStop(0, "rgba(255, 240, 180, 0)");
  g.addColorStop(0.55, "rgba(255, 240, 180, 0.22)");
  g.addColorStop(1, "rgba(255, 250, 220, 0.7)");
  ctx.fillStyle = g;
  ctx.fillRect(ex - 150, 0, 400, GROUND_Y);
  // 洞口拱門
  ctx.fillStyle = "#241b2b";
  ctx.beginPath();
  ctx.moveTo(ex, GROUND_Y);
  ctx.lineTo(ex, 140);
  ctx.quadraticCurveTo(ex + 130, 40, ex + 260, 140);
  ctx.lineTo(ex + 260, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  // 洞口內的亮光
  ctx.fillStyle = "rgba(255, 245, 200, 0.92)";
  ctx.beginPath();
  ctx.moveTo(ex + 28, GROUND_Y);
  ctx.lineTo(ex + 28, 168);
  ctx.quadraticCurveTo(ex + 130, 82, ex + 232, 168);
  ctx.lineTo(ex + 232, GROUND_Y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#8a7a5a";
  ctx.font = "bold 22px monospace";
  ctx.textAlign = "center";
  ctx.fillText("EXIT", ex + 130, GROUND_Y - 34);
}

function drawDoor(d) {
  const blink = d.phase === 0 && Math.floor(d.age * 8) % 2 === 0;
  const open = d.phase === 1;
  const closing = d.phase === 2;
  const dw = d.boss ? 76 : 46;
  const dh = d.boss ? 104 : 64;
  ctx.save();
  ctx.translate(d.x, d.y);
  // 門框
  ctx.fillStyle = "#4a3b5a";
  ctx.fillRect(-dw / 2 - 6, -dh - 6, dw + 12, dh + 6);
  // 門洞
  ctx.fillStyle = blink ? "#5a1f1f" : open ? "#0d0a12" : "#1c1424";
  roundRect(-dw / 2, -dh, dw, dh, 10);
  ctx.fill();
  if (open) {
    // 門內幽光
    const g = ctx.createRadialGradient(0, -dh / 2, 4, 0, -dh / 2, dw);
    g.addColorStop(0, d.boss ? "rgba(255, 80, 60, 0.5)" : "rgba(140, 90, 200, 0.4)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-dw, -dh, dw * 2, dh * 2);
  }
  if (closing) {
    // 關門動畫
    const t = 1 - d.closeT / 0.4;
    ctx.fillStyle = "#4a3b5a";
    ctx.fillRect(-dw / 2, -dh, dw, dh * t);
  }
  if (d.boss) {
    // Boss 巨門上的王冠紋
    ctx.fillStyle = blink ? "#ffd54a" : "#8a6a2a";
    ctx.beginPath();
    ctx.moveTo(-dw / 2 + 8, -dh / 2 - 12);
    ctx.lineTo(-dw / 2 + 18, -dh / 2 - 26);
    ctx.lineTo(-dw / 2 + 30, -dh / 2 - 12);
    ctx.lineTo(0, -dh / 2 - 30);
    ctx.lineTo(dw / 2 - 30, -dh / 2 - 12);
    ctx.lineTo(dw / 2 - 18, -dh / 2 - 26);
    ctx.lineTo(dw / 2 - 8, -dh / 2 - 12);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

// 影子
function drawShadow(x, w, alpha = 0.25) {
  ctx.fillStyle = `rgba(0,0,0,${alpha})`;
  ctx.beginPath();
  ctx.ellipse(x, GROUND_Y + 3, w, 4, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawEnemy(e) {
  drawShadow(e.x, e.w * 0.42);
  if (e.type === "bouncy") { drawBouncy(e); return; }
  const isNunu = e.type === "nunu";
  const spr = isNunu ? null : e.type === "mushroom" ? SPR.mushroom : e.type === "turtle" ? SPR.turtle : SPR.red;
  const baseY = e.y + e.h / 2;
  let sx = 1, sy = 1;
  if (e.type === "mushroom" && !e.onGround) { sy = 1.08; sx = 0.94; } // 彈跳拉長
  if (e.type === "red") { const sq = 1 + Math.sin(e.t * 18) * 0.08; sx = 1 / sq; sy = sq; } // 蠕動
  const topY = baseY - (isNunu ? 40 : spr.height); // 身體頂端（警示標記高度）
  // 蓄力提示
  if (e.atkState === 1) {
    ctx.fillStyle = `rgba(255, 90, 90, ${0.5 + Math.sin(e.t * 25) * 0.4})`;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", e.x, topY - 8);
  }
  // 集體攻擊預警（怒奴）
  if (isNunu && e.gmode && e.gmode !== "return") {
    ctx.fillStyle = `rgba(255, 120, 60, ${0.6 + Math.sin(e.t * 15) * 0.4})`;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("⚠", e.x, topY - 22);
  }
  if (isNunu) { drawNunu(e); return; }
  ctx.save();
  ctx.translate(e.x, baseY);
  ctx.scale(e.facing * sx, sy);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, -spr.width / 2, -spr.height);
  ctx.restore();
}

// 怒奴（第二階段怒怒）：怒怒 Boss 第一階段的迷你版——暗紅尖刺球＋兇臉（獨立向量繪製，非紅怪換色 copy）
function drawNunu(e) {
  const baseY = e.y + e.h / 2;
  const f = e.facing;
  const sq = 1 + Math.sin(e.t * 18) * 0.08; // 蠕動（與紅紅怪同節奏）
  ctx.save();
  ctx.translate(e.x, baseY);
  ctx.scale(f / sq, sq);
  ctx.rotate(Math.sin(e.t * 8) * 0.06);
  // 尖刺（環繞 10 支，比 Boss 的 8 支更密＝更兇）
  ctx.fillStyle = "#6a1414";
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a - 0.2) * 26, Math.sin(a - 0.2) * 26);
    ctx.lineTo(Math.cos(a) * 38, Math.sin(a) * 38);
    ctx.lineTo(Math.cos(a + 0.2) * 26, Math.sin(a + 0.2) * 26);
    ctx.closePath();
    ctx.fill();
  }
  // 身體（暗紅球）
  ctx.fillStyle = "#8a1e1e";
  ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
  // 高光
  ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
  ctx.beginPath(); ctx.ellipse(-9, -13, 9, 5.5, -0.5, 0, Math.PI * 2); ctx.fill();
  // 兇臉（白眼暗紅瞳；座標一律朝右，由 scale(f,1) 翻轉方向）
  ctx.fillStyle = "#fff";
  ctx.beginPath(); ctx.ellipse(8, -6, 7.5, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(22, -6, 6.5, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#26202a";
  ctx.beginPath(); ctx.arc(9.5, -4, 3.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(23, -4, 3.2, 0, Math.PI * 2); ctx.fill();
  // 怒眉
  ctx.strokeStyle = "#26202a";
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(16, -12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(30, -17); ctx.lineTo(18, -12); ctx.stroke();
  // 嘴（張開怒吼）
  ctx.fillStyle = "#26202a";
  ctx.beginPath(); ctx.ellipse(13, 13, 11, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#c23a2a";
  ctx.beginPath(); ctx.ellipse(13, 16, 6.5, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// 彈彈怪：壓縮拉伸的彈珠（向量繪製，照封面美術風）
function drawBouncy(e) {
  const baseY = e.y + e.h / 2;
  const sy = e.onGround ? 0.78 : Math.min(1.25, 1 + Math.abs(e.vy) * 0.02);
  const sx = 1 / sy;
  const r = 14;
  if (e.atkState === 1) {
    ctx.fillStyle = `rgba(255, 90, 90, ${0.5 + Math.sin(e.t * 25) * 0.4})`;
    ctx.font = "bold 14px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", e.x, baseY - r * sy - 10);
    ctx.textAlign = "left";
  }
  ctx.save();
  ctx.translate(e.x, baseY);
  ctx.scale(sx, sy);
  // 球身（螢光綠）
  ctx.fillStyle = "#b8e04a";
  ctx.beginPath(); ctx.arc(0, -r, r, 0, Math.PI * 2); ctx.fill();
  // 高光
  ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
  ctx.beginPath(); ctx.ellipse(-5, -r - 6, 4, 3, -0.6, 0, Math.PI * 2); ctx.fill();
  // 臉（朝玩家）
  const f = e.facing;
  ctx.fillStyle = "#26202a";
  ctx.beginPath(); ctx.arc(f * 5, -r - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(f * 11, -r - 2, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = "#26202a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(f * 8, -r + 4, 4, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
  // 落地衝擊線
  if (e.onGround) {
    ctx.strokeStyle = "rgba(184, 224, 74, 0.6)";
    ctx.lineWidth = 2;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(s * 17, 0, 6, Math.PI, 2 * Math.PI);
      ctx.stroke();
    }
  }
  ctx.restore();
}

// 鐘乳石柱：石柱＋紫晶（封面美術風）；被推開時整根往上滑進天花板
function drawPillars() {
  for (const pl of pillars) {
    const x = pl.x;
    const ph = pl.h * (1 - pl.sunk); // 目前高度（被推下後變矮）
    const topY = GROUND_Y - ph;
    if (pl.opened || topY > GROUND_Y - 4) continue; // 整根推下：看不見
    // 石柱（上窄下寬，鐘乳石造型）
    ctx.fillStyle = theme.pillar;
    ctx.beginPath();
    ctx.moveTo(x - 20, GROUND_Y);
    ctx.lineTo(x - 14, topY + 10);
    ctx.lineTo(x - 5, topY);
    ctx.lineTo(x + 5, topY);
    ctx.lineTo(x + 14, topY + 10);
    ctx.lineTo(x + 20, GROUND_Y);
    ctx.closePath();
    ctx.fill();
    // 石紋
    ctx.strokeStyle = theme.pillarStone;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 10, GROUND_Y - 12); ctx.lineTo(x - 8, topY + 16); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + 10, GROUND_Y - 12); ctx.lineTo(x + 8, topY + 16); ctx.stroke();
    // 紫晶（照封面美術風格）
    ctx.fillStyle = theme.crystal1;
    ctx.beginPath();
    ctx.moveTo(x - 17, GROUND_Y - 24);
    ctx.lineTo(x - 12, GROUND_Y - 46);
    ctx.lineTo(x - 6, GROUND_Y - 24);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = theme.crystal2;
    ctx.beginPath();
    ctx.moveTo(x + 8, GROUND_Y - 20);
    ctx.lineTo(x + 13, GROUND_Y - 42);
    ctx.lineTo(x + 18, GROUND_Y - 20);
    ctx.closePath(); ctx.fill();
    // 推下提示 + 進度條（走近才顯示）
    if (Math.abs(player.x - pl.x) < 260) {
      const canHop = ph <= 190; // 二段跳最高 ~200px，留點餘裕
      const blink = 0.5 + Math.sin(state.time * 6) * 0.4;
      ctx.fillStyle = `rgba(255, 213, 74, ${blink.toFixed(2)})`;
      ctx.font = "bold 12px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        pl.sunk > 0 && canHop ? "⬆ 已夠矮，二段跳跳過去！" : "⬅➡ 按住推下（推矮可跳過）",
        x, topY - 22
      );
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(x - 22, topY - 14, 44, 5);
      ctx.fillStyle = "#ffb066";
      ctx.fillRect(x - 21, topY - 13, 42 * pl.sunk, 3);
      ctx.textAlign = "left";
    }
  }
}

// 暗影獵手：半透明黑影＋發光眼（漂浮、拖尾）
function drawHunter() {
  if (!shadow) return;
  const s = shadow;
  const x = s.x, y = s.y;
  ctx.save();
  ctx.globalAlpha = Math.max(0, 0.75 * s.fade);
  // 紫色光暈
  const g = ctx.createRadialGradient(x, y, 4, x, y, 34);
  g.addColorStop(0, "rgba(120, 80, 200, 0.3)");
  g.addColorStop(1, "rgba(120, 80, 200, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - 36, y - 36, 72, 72);
  // 黑影人形（下擺破爛）
  ctx.fillStyle = "#171021";
  ctx.beginPath();
  ctx.moveTo(x - 14, y + 22);
  ctx.quadraticCurveTo(x - 17, y - 8, x - 8, y - 20);
  ctx.quadraticCurveTo(x, y - 28, x + 8, y - 20);
  ctx.quadraticCurveTo(x + 17, y - 8, x + 14, y + 22);
  for (let i = 3; i >= -3; i--) ctx.lineTo(x + i * 4.6, y + 22 + (i % 2 === 0 ? 5 : -2));
  ctx.closePath();
  ctx.fill();
  // 靠近玩家時紅色邊緣脈動
  if (!s.dying && Math.abs(player.x - x) < 200) {
    const pulse = 0.35 + Math.sin(state.time * 8) * 0.25;
    ctx.strokeStyle = `rgba(255, 60, 60, ${Math.max(0, pulse).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // 俯衝預警：頭頂閃紅「！」
  if (s.state === "warn") {
    const pulse = 0.55 + Math.sin(state.time * 25) * 0.45;
    ctx.fillStyle = `rgba(255, 80, 60, ${Math.max(0, pulse).toFixed(2)})`;
    ctx.font = "bold 22px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", x, y - 30);
    ctx.textAlign = "left";
  }
  // 發光眼（朝玩家）
  const f = player.x > x ? 1 : -1;
  ctx.fillStyle = "#d8c0ff";
  ctx.beginPath(); ctx.arc(x + f * 4, y - 13, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(x + f * 10, y - 13, 2.6, 0, Math.PI * 2); ctx.fill();
  // 消散中的粒子
  if (s.dying && Math.random() < 0.5) {
    ctx.fillStyle = "rgba(150, 110, 220, 0.5)";
    ctx.fillRect(x - 12 + Math.random() * 24, y - 20 + Math.random() * 40, 2, 2);
  }
  ctx.restore();
}

function drawBoss(b) {
  drawShadow(b.x, b.w * 0.55, 0.3);
  const x = b.x, y = b.y, f = b.facing;
  ctx.save();
  ctx.translate(x, y);
  if (b.type === "king") {
    const wob = Math.sin(b.t * 6) * 0.05;
    ctx.rotate(wob * f);
    // 腳
    ctx.fillStyle = "#e8d5b0";
    ctx.beginPath(); ctx.ellipse(-20, b.h / 2 - 6, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(20, b.h / 2 - 6, 13, 9, 0, 0, Math.PI * 2); ctx.fill();
    // 身體
    ctx.fillStyle = "#f0e0c0";
    roundRect(-34, -14, 68, 56, 20);
    ctx.fill();
    // 憤怒的眼睛
    ctx.fillStyle = "#26202a";
    ctx.beginPath(); ctx.ellipse(f * 10, 2, 6, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f * 26, 2, 5, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#26202a";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(f * 2, -10); ctx.lineTo(f * 18, -4); ctx.stroke();
    // 嘴
    ctx.fillStyle = "#26202a";
    ctx.beginPath(); ctx.arc(f * 14, 16, 7, 0, Math.PI); ctx.fill();
    // 大菇帽
    ctx.fillStyle = "#e04040";
    ctx.beginPath();
    ctx.moveTo(-46, -10);
    ctx.quadraticCurveTo(0, -78, 46, -10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f5f0e6";
    for (const [dx, dy, r] of [[-24, -28, 7], [4, -40, 9], [26, -24, 6]]) {
      ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.fill();
    }
    // 王冠
    ctx.fillStyle = "#ffd54a";
    ctx.beginPath();
    ctx.moveTo(-20, -52);
    ctx.lineTo(-14, -70);
    ctx.lineTo(-4, -54);
    ctx.lineTo(4, -72);
    ctx.lineTo(14, -54);
    ctx.lineTo(22, -68);
    ctx.lineTo(26, -50);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#e04040";
    ctx.beginPath(); ctx.arc(4, -60, 3.5, 0, Math.PI * 2); ctx.fill();
    // 衝撞警告
    if (b.slamming) {
      ctx.strokeStyle = "rgba(255, 213, 74, 0.7)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(-f * (44 + i * 10), -20 + i * 18);
        ctx.lineTo(-f * (66 + i * 10), -20 + i * 18);
        ctx.stroke();
      }
    }
  } else if (b.type === "red") {
    // 怒怒 紅紅怪王：大紅球＋尖刺＋兇臉（封面美術風）
    const wob = Math.sin(b.t * 8) * 0.08;
    ctx.rotate(wob);
    // 尖刺（環繞）
    ctx.fillStyle = "#a82323";
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a - 0.25) * 28, Math.sin(a - 0.25) * 28);
      ctx.lineTo(Math.cos(a) * 40, Math.sin(a) * 40);
      ctx.lineTo(Math.cos(a + 0.25) * 28, Math.sin(a + 0.25) * 28);
      ctx.closePath();
      ctx.fill();
    }
    // 身體（大紅球）
    ctx.fillStyle = "#e33b3b";
    ctx.beginPath(); ctx.arc(0, 0, 32, 0, Math.PI * 2); ctx.fill();
    // 高光
    ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
    ctx.beginPath(); ctx.ellipse(-10, -14, 10, 6, -0.5, 0, Math.PI * 2); ctx.fill();
    // 兇臉（白眼紅瞳）
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.ellipse(f * 8, -6, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(f * 24, -6, 7, 9, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#26202a";
    ctx.beginPath(); ctx.arc(f * 10, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(f * 25, -4, 3.5, 0, Math.PI * 2); ctx.fill();
    // 怒眉
    ctx.strokeStyle = "#26202a";
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(f * 0, -19); ctx.lineTo(f * 16, -13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(f * 33, -18); ctx.lineTo(f * 19, -13); ctx.stroke();
    // 嘴（張開怒吼）
    ctx.fillStyle = "#26202a";
    ctx.beginPath(); ctx.ellipse(f * 14, 14, 12, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ff6a4a";
    ctx.beginPath(); ctx.ellipse(f * 14, 18, 7, 4, 0, 0, Math.PI * 2); ctx.fill();
    // 衝撞警告
    if (b.charging) {
      ctx.strokeStyle = "rgba(255, 106, 74, 0.7)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-f * (40 + i * 10), -16 + i * 10);
        ctx.lineTo(-f * (62 + i * 10), -16 + i * 10);
        ctx.stroke();
      }
    }
  } else {
    // Tank 巨龜將軍
    if (b.shell) {
      // 縮殼：頭手腳全縮，只剩龜殼（無敵）
      ctx.fillStyle = "#4e8f3a";
      ctx.beginPath(); ctx.arc(0, 12, 44, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#3c6e2c"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(-14, 12, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.beginPath(); ctx.arc(14, 12, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
      ctx.fillStyle = "#3c6e2c";
      ctx.fillRect(-44, 10, 88, 8);
      // 無敵微光
      ctx.strokeStyle = `rgba(180, 230, 160, ${(0.35 + Math.sin(b.t * 6) * 0.25).toFixed(2)})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 8, 49, Math.PI, 0); ctx.stroke();
      if (b.charging) {
        ctx.strokeStyle = "rgba(168, 208, 128, 0.7)";
        ctx.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(-f * (50 + i * 12), -14 + i * 12);
          ctx.lineTo(-f * (76 + i * 12), -14 + i * 12);
          ctx.stroke();
        }
      }
    } else if (b.out) {
      // 終結形態：龜殼裂開＋脆弱身體露出（一發子彈就能解決）
      ctx.fillStyle = "#3f7430";
      ctx.beginPath(); ctx.arc(0, 20, 40, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = "#2a4a20"; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-12, -19); ctx.lineTo(-2, -8); ctx.lineTo(9, -16); ctx.stroke();
      ctx.fillStyle = "#cfe8b0";
      ctx.beginPath(); ctx.arc(0, -4, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#26202a";
      ctx.fillRect(-8, -8, 4, 6); ctx.fillRect(4, -8, 4, 6);
      if (Math.sin(b.t * 10) > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, -4, 17, 0, Math.PI * 2); ctx.stroke();
      }
    } else {
    // 伸頸（可攻擊）：原姿態
    const swing = Math.sin(b.t * 9) * 4;
    // 腳（4 隻）
    ctx.strokeStyle = "#6fae4e";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    for (const [dx, ph] of [[-30, 0], [-12, 1.6], [12, 1.6], [30, 0]]) {
      ctx.beginPath();
      ctx.moveTo(dx, 14);
      ctx.lineTo(dx + Math.sin(b.t * 8 + ph) * (b.charging ? 10 : 5), b.h / 2 - 4);
      ctx.stroke();
    }
    // 殼（大穹頂）
    ctx.fillStyle = "#4e8f3a";
    ctx.beginPath();
    ctx.arc(0, 12, 44, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // 殼紋
    ctx.strokeStyle = "#3c6e2c";
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(-14, 12, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    ctx.beginPath(); ctx.arc(14, 12, 26, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
    // 殼邊
    ctx.fillStyle = "#3c6e2c";
    ctx.fillRect(-44, 10, 88, 8);
    // 頭
    ctx.fillStyle = "#8cc86a";
    ctx.beginPath(); ctx.arc(f * 50, 4, 13, 0, Math.PI * 2); ctx.fill();
    // 怒眼
    ctx.fillStyle = "#26202a";
    ctx.fillRect(f * 52 - 2, -2, 6, 8);
    ctx.strokeStyle = "#26202a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(f * 44, -8);
    ctx.lineTo(f * 60, -3);
    ctx.stroke();
    // 鋼盔
    ctx.fillStyle = "#6b7280";
    ctx.beginPath();
    ctx.arc(f * 50, -4, 13, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(f * 50 - 15, -6, 30, 4);
    ctx.fillStyle = "#4b5563";
    ctx.fillRect(f * 50 - 2, -18, 4, 6);
    ctx.fillStyle = "#9aa3ad";
    ctx.beginPath(); ctx.arc(f * 50, -19, 2.5, 0, Math.PI * 2); ctx.fill();
    // 衝撞警告
    if (b.charging) {
      ctx.strokeStyle = "rgba(168, 208, 128, 0.7)";
      ctx.lineWidth = 3;
      for (let i = 0; i < 4; i++) {
        ctx.beginPath();
        ctx.moveTo(-f * (50 + i * 12), -14 + i * 12);
        ctx.lineTo(-f * (76 + i * 12), -14 + i * 12);
        ctx.stroke();
      }
    }
    } // /伸頸姿態
  }
  ctx.restore();
}

// Boss 登場特寫：黑屏＋巨幅立繪＋名字大標（通用，所有 Boss 共用）
function drawBossIntro() {
  const bi = bossIntro;
  const k = bi.t / bi.dur;
  const fade = k < 0.15 ? k / 0.15 : k > 0.78 ? Math.max(0, (1 - k) / 0.22) : 1;
  if (fade <= 0) return;
  ctx.fillStyle = "rgba(5, 2, 8," + (0.88 * fade).toFixed(3) + ")";
  ctx.fillRect(0, 0, W, H);
  const cx = W / 2, cy = H / 2 - 16;
  // 紅色光暈
  const g = ctx.createRadialGradient(cx, cy, 20, cx, cy, 230);
  g.addColorStop(0, "rgba(255, 60, 40," + (0.4 * fade).toFixed(3) + ")");
  g.addColorStop(1, "rgba(255, 60, 40, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(cx - 250, cy - 250, 500, 500);
  // 巨幅立繪：重用 Boss 立繪函式放大
  const sc = bi.type === "king" ? 2.6 : bi.type === "red" ? 3.2 : 2.8;
  const pop = 0.92 + 0.08 * Math.min(1, k * 8);
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.translate(cx, cy);
  ctx.scale(sc * pop, sc * pop);
  drawBoss({ type: bi.type, x: 0, y: 0, w: 0, h: 0, t: bi.t * 2, facing: -1, slamming: false, charging: false });
  ctx.restore();
  // 底部紅色斜帶＋名字
  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = "rgba(224, 64, 64, 0.88)";
  ctx.beginPath();
  ctx.moveTo(0, H - 148);
  ctx.lineTo(W, H - 108);
  ctx.lineTo(W, H - 58);
  ctx.lineTo(0, H - 98);
  ctx.closePath();
  ctx.fill();
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 17px monospace";
  ctx.fillText("! W A R N I N G !", W / 2, H - 158);
  ctx.fillStyle = "#fff";
  ctx.font = "bold 42px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
  ctx.fillText(bi.name, W / 2, H - 74);
  ctx.restore();
  ctx.textAlign = "left";
}

// 死亡動畫：主角趴下 + 靈魂飄走
function drawDeath() {
  const p = player;
  const fall = clamp(p.deadT / 0.5, 0, 1);
  const spr = SPR.playerA;
  ctx.save();
  ctx.translate(p.x, p.y + p.h / 2); // 以腳為軸
  ctx.rotate(p.facing * fall * Math.PI * 0.47);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, -spr.width / 2, -spr.height);
  ctx.restore();
  // 靈魂
  if (p.deadT > 0.6) {
    const st = clamp((p.deadT - 0.6) / 1.4, 0, 1);
    const a = Math.max(0, 1 - st) * 0.9;
    const sx = p.x + Math.sin(st * 9) * 10;
    const sy = GROUND_Y - 46 - st * 70;
    ctx.globalAlpha = a;
    ctx.fillStyle = "#cfe8ff";
    ctx.beginPath();
    ctx.arc(sx, sy, 9 - st * 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * 0.55;
    ctx.beginPath();
    ctx.ellipse(sx, sy - 14, 9, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawGun(p) {
  const aim = currentAim();
  const ang = Math.atan2(aim.dy, aim.dx);
  const wid = state.weapon;
  ctx.save();
  ctx.translate(p.x + aim.dx * 6, p.y - 4);
  ctx.rotate(ang);
  if (wid === "laser") {
    ctx.fillStyle = "#2a4a5a";
    ctx.fillRect(2, -3, 16, 6);
    ctx.fillStyle = "#6ff2ff";
    ctx.fillRect(16, -2, 9, 4);
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = "#6ff2ff";
    ctx.beginPath(); ctx.arc(25, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  } else if (wid === "flame") {
    ctx.fillStyle = "#5a3a2a";
    ctx.fillRect(0, -5, 10, 10);
    ctx.fillStyle = "#8a4a2a";
    ctx.fillRect(8, -4, 9, 8);
  } else if (wid === "mg") {
    ctx.fillStyle = "#3a3f4a";
    ctx.fillRect(0, -3, 24, 6);
    ctx.fillStyle = "#2a2e38";
    ctx.fillRect(10, 2, 5, 9); // 彈匣
  } else {
    ctx.fillStyle = "#3a3f4a";
    ctx.fillRect(0, -2.5, 16, 5);
    ctx.fillRect(13, -2.5, 3, 9);
  }
  // 手
  ctx.fillStyle = "#f2c9a0";
  ctx.beginPath(); ctx.arc(4, 0, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  const p = player;
  if (p.dead) { drawDeath(); return; }
  if (p.inv > 0 && p.inv < 1.5 && Math.floor(p.inv * 12) % 2 === 0) return; // 無敵閃爍
  drawShadow(p.x, 13);
  const walking = p.onGround && Math.abs(p.vx) > 0.5;
  const spr = walking ? (Math.floor(p.walkT / 0.12) % 2 ? SPR.playerB : SPR.playerA) : SPR.playerA;
  const baseY = p.y + p.h / 2;
  ctx.save();
  ctx.translate(p.x, baseY);
  if (p.falling) ctx.rotate(Math.sin(state.time * 20) * 0.12);
  ctx.scale(p.facing, 1);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(spr, -spr.width / 2, -spr.height);
  ctx.restore();
  drawGun(p);
  if (p.falling) {
    ctx.fillStyle = "#ffe9a8";
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "center";
    ctx.fillText("啊——！", p.x, baseY - spr.height - 10);
  }
  // 凍結（Boss 終結登場）：白色冰凍閃爍
  if (p.freeze > 0) {
    ctx.fillStyle = `rgba(220, 240, 255, ${(0.35 + Math.sin(state.time * 20) * 0.2).toFixed(2)})`;
    ctx.fillRect(p.x - 16, p.y - 24, 32, 48);
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (b.flame) {
      const a = clamp(b.life / 0.55, 0, 1);
      ctx.globalAlpha = 0.25 + 0.6 * a;
      ctx.fillStyle = "#ff7a3c";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffd54a";
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = b.color;
      const len = b.w === "mg" ? 14 : 12;
      if (Math.abs(b.vx) >= Math.abs(b.vy)) ctx.fillRect(b.x - len / 2, b.y - 2, len, 4);
      else ctx.fillRect(b.x - 2, b.y - len / 2, 4, len);
    }
  }
}

// 雷射光束：外層光暈 + 內層亮線 + 白色核心
function drawBeams() {
  for (const b of beams) {
    const a = clamp(1 - b.t / b.life, 0, 1);
    const draw = (width, alpha, color) => {
      ctx.globalAlpha = alpha * a;
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    };
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    draw(14, 0.18, b.color);
    draw(6, 0.5, b.color);
    draw(2.5, 0.95, "#ffffff");
    ctx.restore();
  }
}

function drawEBullets() {
  for (const b of ebullets) {
    ctx.fillStyle = b.color;
    ctx.globalAlpha = 0.9;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawItem(it) {
  const info = ITEM_INFO[it.type];
  const bob = it.onGround ? Math.sin(it.t * 5) * 3 : 0;
  const y = it.y + bob;
  // 快消失閃爍
  if (it.life < 3 && Math.floor(it.life * 6) % 2 === 0) return;
  ctx.save();
  ctx.translate(it.x, y);
  ctx.fillStyle = info.color;
  roundRect(-11, -11, 22, 22, 6);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#fff";
  ctx.font = "bold 13px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.label, 0, 1);
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function drawFx() {
  for (const p of particles) {
    ctx.globalAlpha = clamp(p.life * 2.5, 0, 1);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
  for (const p of popups) {
    ctx.globalAlpha = clamp(p.life * 2, 0, 1);
    ctx.fillStyle = p.color || "#ffe9a8";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function drawHeart(x, y, size, fill) {
  // fill: 0 | 0.5 | 1（半顆心制）
  ctx.save();
  ctx.translate(x, y);
  const s = size;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(0, s * 0.35);
    ctx.bezierCurveTo(0, 0, -s * 0.18, -s * 0.35, -s * 0.5, -s * 0.35);
    ctx.bezierCurveTo(-s * 0.85, -s * 0.35, -s * 0.95, s * 0.1, -s * 0.6, s * 0.35);
    ctx.lineTo(0, s * 0.95);
    ctx.lineTo(s * 0.6, s * 0.35);
    ctx.bezierCurveTo(s * 0.95, s * 0.1, s * 0.85, -s * 0.35, s * 0.5, -s * 0.35);
    ctx.bezierCurveTo(s * 0.18, -s * 0.35, 0, 0, 0, s * 0.35);
    ctx.closePath();
  };
  if (fill > 0) {
    ctx.fillStyle = "#ff5a5a";
    if (fill >= 1) {
      path();
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.rect(-s, -s, s, s * 2.2);
      ctx.clip();
      path();
      ctx.fill();
    }
  }
  path();
  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

function drawHud() {
  // 左上：分數 / 距離 / 武器
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = "bold 18px monospace";
  ctx.fillText("分數 " + state.score, 16, 30);
  ctx.font = "14px monospace";
  ctx.fillStyle = "#b9a8c8";
  ctx.fillText("最遠 " + Math.floor(maxDist) + "m", 16, 52);
  const upgStr = (state.upgDmg ? " 傷害+" + state.upgDmg : "") + (state.upgRate ? " 射速+" + state.upgRate : "");
  ctx.fillText("武器 " + WEAPONS[state.weapon].name + upgStr, 16, 72);
  if (gp.connected) {
    ctx.fillStyle = "#7dd87d";
    ctx.font = "12px monospace";
    ctx.fillText("🎮 手把已連接", 16, 90);
  }
  // 右上：半顆心制血條
  for (let i = 0; i < 3; i++) {
    const fill = clamp(state.hp - i * 2, 0, 2) / 2;
    drawHeart(W - 32 - (2 - i) * 30, 24, 15, fill);
  }
  ctx.textAlign = "right";
  ctx.font = "14px monospace";
  ctx.fillStyle = "#b9a8c8";
  ctx.fillText("最高 " + state.best, W - 16, 54);

  if (state.mode !== "playing") return;

  // Boss 血條 或 洞口進度條
  if (boss) {
    const bw = 420, bx = W / 2 - bw / 2, by = 22;
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(bx - 4, by - 4, bw + 8, 26);
    ctx.fillStyle = "#5a2020";
    ctx.fillRect(bx, by, bw, 14);
    ctx.fillStyle = "#ff5a5a";
    ctx.fillRect(bx, by, bw * clamp(boss.hp / boss.maxHp, 0, 1), 14);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb0b0";
    ctx.font = "bold 13px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.fillText(boss.name, W / 2, by + 32);
  } else if (nunuSplitT > 0 || enemies.some((e) => e.type === "nunu" && e.hp > 0)) {
    // 怒奴（第二階段）：3 條 Boss 級血量條垂直堆疊，對應 ①②③
    const bw = 420, bx = W / 2 - bw / 2;
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffb0b0";
    ctx.font = "bold 12px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.fillText("怒奴（第二階段）", W / 2, 14);
    for (let i = 0; i < 3; i++) {
      const n = enemies.find((e) => e.type === "nunu" && e.nunuIdx === i + 1);
      const by = 20 + i * 18;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(bx - 2, by - 2, bw + 4, 14);
      ctx.fillStyle = "#5a2020";
      ctx.fillRect(bx, by, bw, 10);
      if (n && n.hp > 0) {
        ctx.fillStyle = "#ff5a5a";
        ctx.fillRect(bx, by, bw * clamp(n.hp / n.maxHp, 0, 1), 10);
      }
      ctx.textAlign = "right";
      ctx.fillStyle = n && n.hp > 0 ? "#ffb0b0" : "rgba(255, 176, 176, 0.3)";
      ctx.font = "bold 10px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
      ctx.fillText(["①", "②", "③"][i], bx - 6, by + 9);
    }
  } else {
    const bw = 280, bx = W / 2 - bw / 2, by = 16;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(bx - 2, by - 2, bw + 4, 12);
    ctx.fillStyle = "#6b5a8a";
    ctx.fillRect(bx, by, bw, 8);
    ctx.fillStyle = "#ffd54a";
    ctx.fillRect(bx, by, bw * clamp(maxDist / END_DIST, 0, 1), 8);
    ctx.textAlign = "center";
    ctx.fillStyle = "#b9a8c8";
    ctx.font = "12px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.fillText(`洞口 ${Math.floor(maxDist)}/${END_DIST} m`, W / 2, by + 24);
  }

  // 效果倒數
  const p = player;
  let ex = 16, ey = H - 64;
  ctx.textAlign = "left";
  ctx.font = "bold 14px monospace";
  if (p.rapidT > 0) {
    ctx.fillStyle = "#ff8a8a";
    ctx.fillText("P 連發 " + p.rapidT.toFixed(1) + "s", ex, ey);
    ey -= 20;
  }
  if (p.spreadT > 0) {
    ctx.fillStyle = "#8aa8ff";
    ctx.fillText("S 散射 " + p.spreadT.toFixed(1) + "s", ex, ey);
  }
}

function drawShopUI() {
  const x0 = W - 252;
  ctx.fillStyle = "rgba(10, 8, 14, 0.92)";
  ctx.fillRect(x0, 0, 252, H);
  ctx.strokeStyle = "#4a3b5a";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x0, 0); ctx.lineTo(x0, H); ctx.stroke();
  let y = 54;
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffd54a";
  ctx.font = "bold 26px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
  ctx.fillText("武器商店", x0 + 20, y);
  y += 36;
  ctx.fillStyle = "#ffe9a8";
  ctx.font = "bold 20px monospace";
  ctx.fillText("硬幣 " + state.gold, x0 + 20, y);
  y += 28;
  ctx.fillStyle = "#b9a8c8";
  ctx.font = "13px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
  ctx.fillText("關卡打怪賺硬幣，花錢換好槍、升級！", x0 + 20, y);
  y += 40;
  for (let i = 0; i < SHOP.length; i++) {
    const s = SHOP[i], w = WEAPONS[s.id];
    const owned = state.owned.includes(s.id);
    const sel = state.weapon === s.id;
    const canBuy = state.gold >= s.cost;
    const cur = shopSel === i;
    ctx.fillStyle = cur ? "rgba(138,255,160,0.14)" : sel ? "rgba(255, 213, 74, 0.14)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(x0 + 12, y - 22, 228, 44);
    if (cur || sel) {
      ctx.strokeStyle = cur ? "#8affa0" : "#ffd54a";
      ctx.strokeRect(x0 + 12, y - 22, 228, 44);
    }
    ctx.fillStyle = cur ? "#8affa0" : sel ? "#ffd54a" : owned ? "#e8e0f0" : (canBuy ? "#c8c0d8" : "#6a6478");
    ctx.font = "bold 17px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.fillText((cur ? "▶ " : "") + (i === 0 ? "0" : String(i)) + "  " + w.name, x0 + 22, y);
    ctx.textAlign = "right";
    const right = sel ? "▶ 使用中" : owned ? "✓ 已擁有" : s.cost + " 硬幣";
    ctx.fillText(right, x0 + 230, y);
    ctx.textAlign = "left";
    y += 46;
  }
  y += 2;
  // 武器升級（按鍵 4/5；游標列 4/5）
  let upIdx = 4;
  for (const [key2, kind, base] of [["4", "dmg", 120], ["5", "rate", 150]]) {
    const lv = kind === "dmg" ? state.upgDmg : state.upgRate;
    const maxed = lv >= 5;
    const cost = (lv + 1) * base;
    const canBuy = !maxed && state.gold >= cost;
    const cur = shopSel === upIdx;
    ctx.fillStyle = cur ? "rgba(138,255,160,0.14)" : canBuy ? "rgba(154, 208, 255, 0.10)" : "rgba(255,255,255,0.04)";
    ctx.fillRect(x0 + 12, y - 20, 228, 40);
    if (cur) { ctx.strokeStyle = "#8affa0"; ctx.strokeRect(x0 + 12, y - 20, 228, 40); }
    ctx.fillStyle = cur ? "#8affa0" : canBuy ? "#9ad0ff" : maxed ? "#ffd54a" : "#6a6478";
    ctx.font = "bold 17px 'Microsoft JhengHei', monospace";
    ctx.fillText((cur ? "▶ " : "") + key2 + "  " + UPGRADES[kind].name + (lv > 0 ? " Lv." + lv : ""), x0 + 22, y);
    ctx.textAlign = "right";
    ctx.fillText(maxed ? "★ 滿級" : cost + " 硬幣", x0 + 230, y);
    ctx.textAlign = "left";
    y += 46;
    upIdx++;
  }
  // 第 7 列：開始新的突擊（游標列 6）
  {
    const cur = shopSel === 6;
    ctx.fillStyle = cur ? "rgba(138,255,160,0.14)" : "rgba(255,255,255,0.05)";
    ctx.fillRect(x0 + 12, y - 20, 228, 40);
    if (cur) { ctx.strokeStyle = "#8affa0"; ctx.strokeRect(x0 + 12, y - 20, 228, 40); }
    ctx.fillStyle = cur ? "#8affa0" : "#c8c0d8";
    ctx.font = "bold 17px 'Microsoft JhengHei', monospace";
    ctx.fillText((cur ? "▶ " : "") + "開始新的突擊", x0 + 22, y);
    ctx.textAlign = "right";
    ctx.fillText("Enter", x0 + 230, y);
    ctx.textAlign = "left";
    y += 46;
  }
  y += 4;
  ctx.fillStyle = "#9ad0ff";
  ctx.font = "13px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
  const lines = wrapText(WEAPONS[state.weapon].desc, 24);
  for (const ln of lines) {
    ctx.fillText(ln, x0 + 20, y);
    y += 18;
  }
  y += 24;
  ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 300) * 0.4;
  ctx.fillStyle = "#8affa0";
  ctx.font = "bold 15px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
  ctx.fillText("↑↓ 選擇 / 空白或 A 確認", x0 + 20, y);
  ctx.fillText("0-5 快捷 / Enter 新的突擊", x0 + 20, y + 22);
  ctx.globalAlpha = 1;
}

function wrapText(text, maxChars) {
  const out = [];
  let cur = "";
  for (const ch of text) {
    cur += ch;
    if (cur.length >= maxChars) { out.push(cur); cur = ""; }
  }
  if (cur) out.push(cur);
  return out;
}

// ---------------- 覆蓋畫面 ----------------
function centeredPanel(lines, cx = W / 2) {
  ctx.textAlign = "center";
  // 注意：字串的 .big 是 String.prototype.big（函式、truthy）——判斷 big 必須先排除字串，否則字串行會吃 52px 行高、把面板撐出畫面
  const hOf = (ln) => (typeof ln === "object" && ln.big) ? 52 : 30;
  let total = 0;
  for (const ln of lines) total += hOf(ln);
  const scale = total > H - 50 ? (H - 50) / total : 1; // 內容太高時壓縮行距、底部不超出
  let y = Math.max(44, (H - total * scale) / 2 + 30); // 行數多時往上緊湊、不超出畫面上緣
  for (const ln of lines) {
    if (typeof ln === "string") {
      ctx.fillStyle = "#fff";
      ctx.font = "16px monospace";
      ctx.fillText(ln, cx, y);
    } else {
      ctx.fillStyle = ln.color || "#fff";
      ctx.font = ln.big ? "bold 44px monospace" : "bold 18px monospace";
      ctx.fillText(ln.t, cx, y);
    }
    y += hOf(ln) * scale;
  }
}

function drawOverlay() {
  if (state.mode === "title") {
    ctx.fillStyle = "rgba(8, 6, 12, 0.72)";
    ctx.fillRect(0, 0, W, H);
    // 左側：遊戲封面（2:3 直式）；文字面板移到右側
    let textCx = W / 2;
    if (coverReady()) {
      const cw = 267, ch = 400, cx0 = 44, cy0 = (H - ch) / 2;
      ctx.save();
      ctx.shadowColor = "rgba(170, 80, 255, 0.55)";
      ctx.shadowBlur = 26;
      ctx.fillStyle = "#161022";
      roundRect(cx0 - 7, cy0 - 7, cw + 14, ch + 14, 10);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.drawImage(coverImg, cx0, cy0, cw, ch);
      ctx.strokeStyle = "rgba(255, 213, 74, 0.45)";
      ctx.lineWidth = 2;
      roundRect(cx0 - 7, cy0 - 7, cw + 14, ch + 14, 10);
      ctx.stroke();
      ctx.restore();
      textCx = 613; // 封面右邊界 318 → 文字置中於 318..920 之間
    }
    // 封面已含遊戲標題 logo，有封面時就不重疊畫大字
    const lines = coverReady() ? [] : [
      { t: "深谷突擊", big: true, color: "#ffd54a" },
      { t: "CAVE BLASTER", color: "#9ad0ff" },
      "",
    ];
    lines.push(
      "你掉進未知山洞，只能朝前打，打到洞口為止。",
      "推進 " + END_DIST + " 公尺脫離山洞，清關後能回商店買槍！",
      "",
      { t: "← → / A D 移動　空白 跳（二段跳；↑ / W 只瞄上射）", color: "#9ad0ff" },
      { t: "按住 J / Z / X 射擊（搭配 ↑↓ 斜射）", color: "#9ad0ff" },
      { t: "手把：搖桿/十字鍵移動（C 校正）　P 暫停", color: "#9ad0ff" },
      ""
    );
    if (state.gold > 0 || state.owned.length > 1) {
      lines.push({ t: `硬幣 ${state.gold}   目前武器：${WEAPONS[state.weapon].name}`, color: "#ffd54a" });
    }
    if (gp.connected) {
      lines.push({ t: `🎮 手把：跳=${GP_NAMES[gpMap.jump]} 射=${GP_NAMES[gpMap.fire]} 確認=${GP_NAMES[gpMap.confirm]}`, color: "#9ad0ff" });
    }
    if (achUnlocked.length > 0) {
      lines.push({ t: `🏆 已解鎖成就 ${achUnlocked.length}/${ACHIEVEMENTS.length}`, color: "#ffd54a" });
    }
    lines.push("");
    lines.push({ t: "▶ 開始墜落", color: titleSel === 0 ? "#8affa0" : "#6a6478" });
    lines.push({ t: "  手把校正（按鍵映射不對就來這裡）", color: titleSel === 1 ? "#8affa0" : "#6a6478" });
    lines.push({ t: "  🏆 成就（" + achUnlocked.length + "/" + ACHIEVEMENTS.length + "）", color: titleSel === 2 ? "#8affa0" : "#6a6478" });
    lines.push({ t: "↑↓ 選擇 ・ Enter / 空白 確認 ・ C 直接開校正", color: "#6a6478" });
    lines.push({ t: "作者：阿弟 RDD8", color: "#5a5468" });
    centeredPanel(lines, textCx);
  } else if (state.mode === "ach") {
    // 成就列表（雙欄）
    ctx.fillStyle = "rgba(8, 6, 12, 0.94)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 30px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
    ctx.fillText("🏆 成就", W / 2, 56);
    ctx.fillStyle = "#b9a8c8";
    ctx.font = "bold 16px monospace";
    ctx.fillText(achUnlocked.length + " / " + ACHIEVEMENTS.length + " 已解鎖", W / 2, 86);
    ctx.textAlign = "left";
    const x0 = W / 2 - 460, x1 = W / 2 + 20;
    ACHIEVEMENTS.forEach((a, i) => {
      const x = i < 6 ? x0 : x1, y = 128 + (i % 6) * 62;
      const got = achUnlocked.includes(a.id);
      ctx.fillStyle = got ? "#ffd54a" : "#5a5468";
      ctx.font = "bold 19px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.fillText((got ? "✅ " : "🔒 ") + a.icon + " " + a.name, x, y);
      ctx.fillStyle = got ? "#b9a8c8" : "#454054";
      ctx.font = "14px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.fillText("    " + a.desc, x, y + 24);
    });
    ctx.textAlign = "center";
    ctx.fillStyle = "#8affa0";
    ctx.font = "bold 15px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.globalAlpha = 0.6 + Math.sin(performance.now() / 300) * 0.4;
    ctx.fillText("Enter / Esc 回標題", W / 2, H - 34);
    ctx.globalAlpha = 1;
  } else if (state.mode === "calib") {
    ctx.fillStyle = "rgba(8, 6, 12, 0.94)";
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffd54a";
    ctx.font = "bold 30px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
    ctx.fillText("🎮 手把校正", W / 2, 80);
    if (!gp.connected) {
      ctx.fillStyle = "#ff8a5c";
      ctx.font = "bold 20px monospace";
      ctx.fillText("未偵測到手把，請先接上", W / 2, 130);
      // 診斷：瀏覽器實際看到的手把（含未連接的殘留項目）
      let diag = "瀏覽器 getGamepads()：無項目";
      try {
        const pads = navigator.getGamepads();
        const ids = [];
        for (const p of pads) if (p) ids.push((p.id || "無名稱").slice(0, 22) + (p.connected ? "（已連接）" : "（未連接）"));
        if (ids.length > 0) diag = "瀏覽器 getGamepads()：" + ids.join("、");
      } catch (e) {}
      ctx.fillStyle = "#9a8fa5";
      ctx.font = "12px monospace";
      ctx.fillText(diag, W / 2, 160);
      // Steam Deck / steamOS 專用提示（平台限制：瀏覽器常拿不到手把，輸入被轉成鍵盤）
      ctx.fillStyle = "#b9a8c8";
      ctx.font = "14px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
      ctx.fillText("在 Steam Deck / steamOS 玩？手把常被瀏覽器轉成鍵盤輸入，", W / 2, 205);
      ctx.fillText("Gamepad API 看不到 → 移動、跳躍有效，但射擊按不到。對策：", W / 2, 231);
      ctx.fillStyle = "#9ad0ff";
      ctx.fillText("① 遊戲中按住 Enter 也能射擊（本遊戲已支援）", W / 2, 261);
      ctx.fillText("② Steam 設定 → 控制器：改「模擬鍵盤／滑鼠」模板或關手把模式", W / 2, 287);
      ctx.fillText("③ 或用桌面模式的瀏覽器玩（Gamepad API 較有機會偵測到）", W / 2, 313);
      ctx.fillStyle = "#8affa0";
      ctx.font = "16px monospace";
      ctx.fillText("[Esc / Enter] 回標題", W / 2, H - 50);
    } else {
      const prompts = [
        "① 請按你想用做【跳躍】的按鍵",
        "② 請按你想用做【射擊】的按鍵",
        "③ 請按你想用做【確認 / OK】的按鍵",
      ];
      ctx.fillStyle = "#fff";
      ctx.font = "bold 22px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.fillText(prompts[calibStep], W / 2, 145);
      const sJump = calibStep >= 1 ? GP_NAMES[gpMap.jump] : "?";
      const sFire = calibStep >= 2 ? GP_NAMES[gpMap.fire] : "?";
      const sConf = calibStep >= 3 ? GP_NAMES[gpMap.confirm] : "?";
      ctx.fillStyle = "#b9a8c8";
      ctx.font = "bold 18px monospace";
      ctx.fillText(`跳躍: ${sJump}    射擊: ${sFire}    確認: ${sConf}`, W / 2, 190);
      // 16 格按鍵表（標準映射順序），亮的格子 = 你現在按到的
      const gx0 = W / 2 - (8 * 46) / 2;
      for (let i = 0; i < 16; i++) {
        const col = i % 8, row = Math.floor(i / 8);
        const x = gx0 + col * 46 + 23, y = 285 + row * 62;
        const on = gp.pressed.has(i);
        ctx.fillStyle = on ? "#ffd54a" : "rgba(255,255,255,0.07)";
        roundRect(x - 20, y - 20, 40, 40, 8);
        ctx.fill();
        ctx.strokeStyle = on ? "#fff" : "#4a3b5a";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = on ? "#1a1420" : "#b9a8c8";
        ctx.font = "bold 13px monospace";
        ctx.fillText(GP_NAMES[i], x, y - 2);
        ctx.font = "10px monospace";
        ctx.fillStyle = on ? "#1a1420" : "#6a6478";
        ctx.fillText(String(i), x, y + 12);
      }
      ctx.fillStyle = "#b9a8c8";
      ctx.font = "14px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.fillText("按下任一按鍵即指派給目前步驟；上方亮起的格子 = 你實際按到的（各手把映射可能不同）", W / 2, 440);
      ctx.fillStyle = "#8affa0";
      ctx.fillText("按 Back（8 號）或 Esc 離開校正", W / 2, H - 50);
    }
    ctx.textAlign = "left";
  } else if (state.mode === "story" || state.mode === "ending") {
    ctx.fillStyle = "rgba(8, 6, 12, 0.88)";
    ctx.fillRect(0, 0, W, H);
    if (state.mode === "ending") {
      ctx.fillStyle = "#ffd54a";
      ctx.font = "bold 24px 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("—— 結 局 ——" , W / 2, 90);
    }
    ctx.textAlign = "center";
    let y = state.mode === "ending" ? 150 : 130;
    for (let i = 0; i <= story.idx && i < story.lines.length; i++) {
      const cur = i === story.idx;
      ctx.globalAlpha = cur ? clamp(story.t / 0.3, 0, 1) : 0.85;
      ctx.fillStyle = i === 0 ? "#ffd54a" : "#e8e0f0";
      ctx.font = (i === 0 ? "bold 24px" : "20px") + " 'Microsoft JhengHei', 'Noto Sans TC', sans-serif";
      ctx.fillText(story.lines[i], W / 2, y);
      y += 46;
    }
    ctx.globalAlpha = 1;
    const isLast = story.idx >= story.lines.length - 1;
    ctx.globalAlpha = 0.5 + Math.sin(performance.now() / 300) * 0.4;
    ctx.fillStyle = "#8affa0";
    ctx.font = "bold 16px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.fillText(
      isLast ? (state.mode === "ending" ? "[Enter] 進入武器商店" : "[Enter] 墜落！") : "[Enter / 點擊] 下一句",
      W / 2, H - 60
    );
    ctx.globalAlpha = 1;
  } else if (state.mode === "gameover") {
    ctx.fillStyle = "rgba(10, 5, 8, 0.78)";
    ctx.fillRect(0, 0, W, H);
    centeredPanel([
      { t: "GAME OVER", big: true, color: "#ff5a5a" },
      `本局分數  ${state.score}`,
      `最高紀錄  ${state.best}`,
      "",
      { t: (overSel === 0 ? "▶ " : "  ") + "[R / Enter] 再試一次", color: overSel === 0 ? "#8affa0" : "#c8c0d8" },
      { t: (overSel === 1 ? "▶ " : "  ") + "[S] 去武器商店", color: overSel === 1 ? "#8affa0" : "#c8c0d8" },
      { t: (overSel === 2 ? "▶ " : "  ") + "[T] 回標題", color: overSel === 2 ? "#8affa0" : "#c8c0d8" },
      { t: "↑↓ 選擇 ・ 空白 / A 確認", color: "#6a6478" },
    ]);
  }
  // 中央大字提示（Boss 出現等）；商店模式避開右側面板
  if (banner && (state.mode === "playing" || state.mode === "shop")) {
    const a = clamp(Math.min(banner.t * 3, (banner.dur - banner.t) * 2), 0, 1);
    const inShop = state.mode === "shop";
    const bw = inShop ? W - 252 : W;
    const cx = inShop ? (W - 252) / 2 : W / 2;
    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 120, bw, 64);
    ctx.fillStyle = banner.text.includes("⚠") ? "#ff8a5c" : "#ffe9a8";
    ctx.font = "bold 30px 'Microsoft JhengHei', 'Noto Sans TC', monospace";
    ctx.textAlign = "center";
    ctx.fillText(banner.text, cx, 162);
    ctx.globalAlpha = 1;
  }
  if (state.paused && state.mode === "playing") {
    ctx.fillStyle = "rgba(5, 5, 10, 0.6)";
    ctx.fillRect(0, 0, W, H);
    centeredPanel([
      { t: "已暫停", big: true, color: "#9ad0ff" },
      { t: (pauseSel === 0 ? "▶ " : "  ") + "[P] 繼續", color: pauseSel === 0 ? "#8affa0" : "#c8c0d8" },
      { t: (pauseSel === 1 ? "▶ " : "  ") + "[T] 回標題", color: pauseSel === 1 ? "#8affa0" : "#c8c0d8" },
      { t: "↑↓ 選擇 ・ 空白 / A 確認", color: "#6a6478" },
    ]);
  }
}

// ---------------- 主繪圖 ----------------
function draw() {
  ctx.save();
  if (shake > 0) {
    const s = shake * 14;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawBackground();
  drawGround();
  ctx.save();
  ctx.translate(-state.camX, 0);
  drawLeftWall();
  if (state.mode === "shop") drawShopWall();
  if (state.mode === "playing") drawExit();
  drawPillars();
  // 落石預警＋碎石
  for (const rw of rockWarns) {
    const blink = 0.35 + Math.abs(Math.sin(state.time * 12)) * 0.5;
    ctx.fillStyle = `rgba(255, 90, 60, ${blink.toFixed(2)})`;
    ctx.beginPath(); ctx.arc(rw.x, GROUND_Y - 8, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffb08a";
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.fillText("!", rw.x, GROUND_Y - 24);
  }
  for (const gr of groundRocks) {
    ctx.fillStyle = "#8a7a66";
    const n = Math.max(3, Math.floor(gr.w / 14));
    for (let i = 0; i <= n; i++) {
      const rx = gr.x - gr.w / 2 + (i + 0.5) * (gr.w / n);
      const rh = 10 + ((i * 7 + 3) % 4) * 5;
      ctx.beginPath();
      ctx.moveTo(rx - 8, GROUND_Y);
      ctx.lineTo(rx, GROUND_Y - rh);
      ctx.lineTo(rx + 8, GROUND_Y);
      ctx.closePath();
      ctx.fill();
    }
  }
  for (const d of doors) drawDoor(d);
  for (const e of enemies) drawEnemy(e);
  drawHunter();
  if (boss) drawBoss(boss);
  for (const it of items) drawItem(it);
  if (state.mode !== "title" && state.mode !== "story") drawPlayer();
  drawBullets();
  drawBeams();
  drawEBullets();
  drawFx();
  ctx.restore();
  ctx.restore();

  if (state.mode === "playing" || state.mode === "dying") drawHud();
  if (state.mode === "shop") drawShopUI();
  drawOverlay();
  if (bossIntro) drawBossIntro();
}

// ---------------- 主迴圈 ----------------
let lastT = performance.now();
// ---------------- 慢動作（Boss 電影感：Tank 終結形態/怒奴分裂；全域 dt 縮時） ----------------
let slowScale = 1;   // 時間尺度（1 = 正常速度）
let slowmoT = 0;     // 慢動作剩餘真實秒數
function startSlowmo(scale, realSec) { slowScale = scale; slowmoT = realSec; }
function endSlowmo() { slowScale = 1; slowmoT = 0; }
function tickSlowmo(realDt) {
  if (slowmoT > 0) {
    slowmoT -= realDt;
    if (slowmoT <= 0) { slowmoT = 0; slowScale = 1; }
  }
}

function frame(now) {
  const rawDt = Math.min(0.035, (now - lastT) / 1000);
  lastT = now;
  pollGamepad();
  bgmTick(); // BGM 節拍器（無 AudioContext / 關閉時安全略過）
  tickSlowmo(rawDt); // 慢動作倒數（真實秒，不受縮時影響）
  const dt = rawDt * slowScale;
  // 手把 / 觸控的「確認」與「跳躍」邊緣觸發（按鈕號隨校正映射）
  const actionEdge = gpEdge.has(gpMap.confirm) || gpEdge.has(gpMap.jump) || touch.actionQueued;
  const jumpEdge = gpEdge.has(gpMap.jump) || touch.jumpQueued;
  const touchLeftEdge = touch.leftEdge, touchRightEdge = touch.rightEdge;
  touch.actionQueued = false;
  touch.jumpQueued = false;
  touch.leftEdge = false;
  touch.rightEdge = false;
  if (state.mode === "playing") {
    if (gpEdge.has(gpMap.pause)) { state.paused = !state.paused; if (state.paused) pauseSel = 0; } // 暫停鍵（預設 B）
    if (state.paused) {
      // 暫停選單手把：十字鍵移動＋ A/Start 確認；觸控 ◀▶ 同義
      if (gp.upEdge || touchLeftEdge) pauseSel = 0;
      else if (gp.downEdge || touchRightEdge) pauseSel = 1;
      if (actionEdge) { state.paused = false; if (pauseSel === 1) state.mode = "title"; }
    } else if (jumpEdge && !player.falling && !player.dead &&
        (player.onGround || player.airJumps > 0)) {
      player.jumpBuf = 0.15;
    }
  } else if (state.mode === "shop") {
    if (gp.upEdge || touchLeftEdge) shopSel = (shopSel + SHOP_ROWS - 1) % SHOP_ROWS; // 觸控 ◀＝上
    else if (gp.downEdge || touchRightEdge) shopSel = (shopSel + 1) % SHOP_ROWS;     // 觸控 ▶＝下
    if (actionEdge) shopConfirm(); // A/Start/觸控跳＝確認游標列
  } else if (state.mode === "title") {
    if (gp.upEdge || touchLeftEdge) titleSel = (titleSel + 2) % 3;
    else if (gp.downEdge || touchRightEdge) titleSel = (titleSel + 1) % 3;
    if (actionEdge) (titleSel === 0 ? startStory() : titleSel === 1 ? enterCalib() : (state.mode = "ach"));
  } else if (state.mode === "ach") {
    if (actionEdge) state.mode = "title";
  } else if (state.mode === "story" || state.mode === "ending") {
    if (actionEdge) story.skip();
  } else if (state.mode === "gameover") {
    // 死亡選單手把：十字鍵移動；B=去商店（快捷）、A/Start=確認選定
    if (gp.upEdge || touchLeftEdge) overSel = 0;
    else if (gp.downEdge || touchRightEdge) overSel = (overSel + 1) % 3;
    if (gpEdge.has(gpMap.pause)) enterShop();
    else if (actionEdge) { if (overSel === 1) enterShop(); else if (overSel === 2) state.mode = "title"; else startGame(); }
  } else if (state.mode === "calib") {
    // 按任一按鍵（除 Back）即指派給目前步驟
    if (gp.connected && gpEdge.size > 0) {
      const i = gpEdge.values().next().value;
      if (i === 8) state.mode = "title"; // Back = 離開校正
      else {
        gpMap[["jump", "fire", "confirm"][calibStep]] = i;
        calibStep++;
        if (calibStep > 2) {
          calibStep = 0;
          saveGpMap();
          state.mode = "title";
        }
      }
    }
  }
  // 觸控跳躍鍵標籤：戰鬥中＝跳，選單畫面＝確認
  if (btnJumpEl) {
    const lb = (state.mode === "playing" && !state.paused) ? "跳" : "確認";
    if (btnJumpEl.textContent !== lb) btnJumpEl.textContent = lb;
  }
  update(dt);
  draw();
  requestAnimationFrame(frame);
}

// BGM 開關按鈕（右上角，狀態同步給 setBgm）
(function () {
  const b = document.getElementById("bgm-btn");
  if (!b) return;
  b.textContent = BGM.on ? "🎵" : "🔇";
  b.classList.toggle("off", !BGM.on);
  b.addEventListener("click", () => { wakeAudio(); setBgm(!BGM.on); });
})();

// 暫停按鈕（右上角，BGM 按鈕旁）：遊戲中點按＝P 鍵（手機沒鍵盤也能暫停）
(function () {
  const b = document.getElementById("pause-btn");
  if (!b) return;
  b.addEventListener("click", () => {
    if (state.mode === "playing") { state.paused = !state.paused; if (state.paused) pauseSel = 0; }
  });
})();

setupTouch();
requestAnimationFrame(frame);

// ---------------- 測試用匯出（只有 Node 有 module） ----------------
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
  state, player, story, STORY_END, gpMap, touch, SHOP_ROWS,
  get doors() { return doors; },
  get pillars() { return pillars; },
  get enemies() { return enemies; },
  get particles() { return particles; },
  get bullets() { return bullets; },
  get beams() { return beams; },
  get ebullets() { return ebullets; },
  get rockWarns() { return rockWarns; },
  get groundRocks() { return groundRocks; },
  get nunuGroup() { return nunuGroup; },
  resetNunuCd: (v) => { nunuGroupCd = v; nunuGroup = "idle"; },
  triggerRockfall,
  get items() { return items; },
  get boss() { return boss; },
  get bossIntro() { return bossIntro; },
  set bossIntro(v) { bossIntro = v; },
  get shadow() { return shadow; },
  set shadow(v) { shadow = v; },
  get gold() { return state.gold; },
  get maxDist() { return maxDist; },
  get theme() { return theme; },
  get caveKey() { return caveKey; },
  get bossStage() { return bossStage; },
  newRaid,
  THEMES, BOSS_THEMES, CAVE_ORDER,
  makeEnemy, makeItem,
  spawnBossDoor, spawnBoss,
  enterShop, shopBuy, shopConfirm, startStory, startGame, centeredPanel,
  get shopSel() { return shopSel; },
  get titleSel() { return titleSel; },
  get pauseSel() { return pauseSel; },
  get overSel() { return overSel; },
  buyUpgrade, weaponDmg, weaponCd, UPGRADES,
  ACHIEVEMENTS, checkAch, saveAch,
  get prog() { return prog; },
  get achUnlocked() { return achUnlocked; },
  BGM, setBgm, bgmTick, wakeAudio,
  get slowScale() { return slowScale; }, startSlowmo, endSlowmo, tickSlowmo,
  get nunuSplitT() { return nunuSplitT; },
  coverImg,
  WEAPONS, SHOP, END_DIST, BOSS_SCHEDULE,
  };
}
