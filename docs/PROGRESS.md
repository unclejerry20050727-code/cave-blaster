# 進度記錄（context 中斷後照這檔接續）

## 2026-10-26（第六輪）：主角命名調整——不提前破梗，改用結尾無人機暗示 —— ✅ 完成

### 背景
Jerry 調整第五輪命名需求：前面先不說主角名叫 RDD8（標題恢復第二人稱），改由結尾暗示：
「主角爬出洞穴，遠處天空忽然亮起一架紅色無人機，掃描結果顯示：『目標 RDD8，確認存活。』」

### 改動（01808a0）
- [x] 標題說明改回「你掉進未知山洞，只能朝前打，打到洞口為止。」（不提前破梗）
- [x] 結尾 STORY_END 換掉「——RDD8，逃出來了！」為兩行（故事是一行一頁顯示，加行無版面風險）：
  - 「主角爬出洞穴，遠處天空忽然亮起一架紅色無人機。」
  - 「掃描結果顯示：『目標 RDD8，確認存活。』」
  - 最後一行仍保留「（洞的最深處，更大的影子正在甦醒……）」做續作 hook
- [x] 作者署名「作者：阿弟 RDD8」保留（第四輪需求；細心的玩家發現兩者相連是樂趣）
- [x] 匯出 STORY_END 供測試；smoke 48 改 3 斷言：標題不提前點名（不 spoiler）/ 結尾有紅色無人機 / 掃描結果暗示「目標 RDD8，確認存活」

### 實機驗證（Chromium 1280×720）
- 標題：「你掉進未知山洞」（無主角名）
- 結尾：`story.start(STORY_END); state.mode="ending"` 強制進入（順帶發現 story per=1.5s 自動跳頁機制，用 `story.per=999` 凍結截圖）——7 行全部在畫面內
- 重截 docs/title.png（第五輪舊圖還帶著「主角 RDD8」）；新增 docs/ending.png（結尾完整版，含無人機揭示）

### 驗證
- `node test/smoke.js` → **193 斷言 0 FAIL**
- 本輪後 game.js 3665 行（行號用 grep 現查為準）

---

## 2026-10-26（第五輪）：主角命名 RDD8＋標題畫面底部溢出 —— ✅ 全部完成

### 結果
- 兩項完成、各自 commit、**191 項斷言全綠**
- 實機驗證（Chromium 960×540）：模擬 Jerry 狀態（硬幣 300／雙武器／1 成就）標題 15 行全部在畫面內、行距整齊；fresh state 重截 docs/title.png（順帶修正舊圖的舊版操作說明文字）

### ✅ 1（583ca23）謎樣的主角名叫 RDD8
- [x] 標題畫面說明：「主角 RDD8 掉進未知山洞，只能朝前打，打到洞口為止。」
- [x] 結局最後一行情節揭示：「——你，逃出來了！」→「——RDD8，逃出來了！」（開場第二人稱、結尾點名，保持電影感）
- [x] README 故事段同步（docs commit）；smoke 48（標題畫面點名主角 RDD8）

### ✅ 2（6f8def8）標題頁最下面一行（成就）超出畫面
- **根因（第一輪就埋下的 bug）**：centeredPanel 的 `y += ln.big ? 52 : 30`——對**字串**，`ln.big` 不是 undefined 而是 **String.prototype.big（JS 遺留方法、函式、truthy）**！所以字串行吃 52px 行高，而 total 計算那行有 `typeof ln !== "string"` 保護只算 30px → 面板總高被低估、起點偏低、字串行又逐行多 22px → 底部溢出
- **為什麼現在才發現**：行數一多才爆。第二輪截圖時「↑↓ 選擇」行已出界（當時沒察覺）；第四輪加「作者」行＋硬幣/成就條件行後，Jerry 的「🏆 成就」選單行被切
- [x] 修法：`hOf(ln)` 用 `typeof ln === "object" && ln.big` 判斷；另加**自動壓縮行距**（total > H-50 時按比例縮小，防禦未來再加行）
- [x] 匯出 centeredPanel；smoke mock 改共用 ctx 實體（可暫換 fillText 記錄座標）
- [x] smoke 46（字串/物件行距一致 30px 回歸）＋smoke 47（標題最壞行數：無文字超出畫面底邊）
- 量測過程：用 PGM 逐列亮像素量測 docs/title.png 行距（字串 52/物件 30 的規律）→ Node 驗證 `("str").big` 是函式 → 理論證實

### 驗證
- `node --check game.js` + `node test/smoke.js` → **191 斷言 0 FAIL**
- 瀏覽器實機：Jerry 狀態（gold/owned/ach 寫入 localStorage）標題截圖——15 行行距 30/60 整齊、最底「作者」行 y≈495 完全在畫面內

### 技術備註
- **`String.prototype.big` 陷阱**：對字串primitive 取 `.bold()/.italic()/.big()/.small()` 等遺留方法會得到函式（truthy）；任何 `str.flag` 式的 feature-detect 都要先 `typeof` 判斷
- centeredPanel 現行邏輯：`hOf = (typeof ln === "object" && ln.big) ? 52 : 30`；`scale = total > H-50 ? (H-50)/total : 1`；`y0 = max(44, (H - total*scale)/2 + 30)`
- smoke 46/47/48 靠 sharedCtx.fillText 暫換為 recorder 來驗證繪圖座標/文字（Node 無封面→行數最多，是最壞情況）
- 本輪後 game.js 3664 行（行號用 grep 現查為準）

---

## 2026-10-26（第四輪）：Jerry 的 5 項操作/署名/手把需求 —— ✅ 全部完成

### 結果
- 五項需求全部完成、各自 commit、**185 項斷言全綠**
- headless Chromium 實機驗證：校正畫面「未偵測到」新版面（診斷行＋Steam Deck 三條對策）排版正常
- 注意：任務 1-4 的 commit 當時**沒同步 README**（操作表↑/W 跳躍舊文案、測試數 162），本輪 docs commit 一併修

### ✅ 1（71f9c79）跳躍改空白鍵專屬
- [x] Space 才設 `jumpBuf`；↑/W 改純瞄準（`inUp()/inDown()` 只給 `currentAim()` 用）→ 地上按 ↑ 斜上射不會一直跳
- [x] 標題操作說明同步（「空白 跳（二段跳；↑ / W 只瞄上射）」）
- [x] smoke 24 二段跳改用 Space、新增 smoke 42（空白跳 / 按住↑不跳 / ↑+射 = 斜上射）

### ✅ 2（9fa293d）商店 ↑↓ 游標選單
- [x] 7 列（4 武器＋2 升級＋開始新的突擊）、`shopSel` 回繞、空白/Enter = `shopConfirm()`、數字鍵保留直購
- [x] 手把：十字鍵 ↑↓ 移動、A/Start（映射確認鍵）確認（frame() shop 分支）
- [x] smoke 43（鍵盤移動/回繞/確認購買/手把 d-pad＋映射確認鍵）

### ✅ 3（74970d5）作者署名「阿弟 RDD8」
- [x] 標題畫面灰字置於操作提示下方（game.js drawTitle 末行）、README 檔首

### ✅ 4（3f758ee）遊戲中可回標題
- [x] 暫停選單 2 項（繼續/回標題）、死亡選單 3 項（再試/商店/回標題）、`T` 快捷回標題（暫停/死亡皆可）
- [x] 手把：十字鍵移動＋A/Start 確認；死亡畫面 B = 去商店快捷
- [x] smoke 44（暫停回標題/死亡回標題/T 快捷）

### ✅ 5（972561c）steamOS 手把「未偵測到／無法射擊」
- **症狀**：steamOS 瀏覽器校正畫面「未偵測到手把」，但遊戲中手把大概只剩無法射擊
- **根因（平台限制）**：Steam Deck 手把模式下的瀏覽器常把手把輸入**轉成鍵盤**（或只操作瀏覽器 UI），`navigator.getGamepads()` 拿不到（社区多例：r/SteamDeck「Can't use the steam decks gamepad for browser games」）。移動/跳躍走模擬鍵盤有效，射擊鍵（J/Z/X）模擬鍵盤按不到
- [x] `inFire()` 加 **Enter** 備援射擊鍵（遊戲中 Enter 原本無用途、零衝突；模擬手把 A 多映射到 Enter）
- [x] 校正畫面「未偵測到」分支：診斷行（`getGamepads()` 實際項目/名稱/連接狀態）＋Steam Deck 三條對策（Enter 射擊／改模擬鍵盤滑鼠模板或關手把模式／桌面模式瀏覽器）
- [x] smoke 45（Enter 射擊/校正畫面診斷繪製不崩）；README 手把段加 steamOS 註記
- ⚠️ **待 Jerry 實機確認**：Steam Deck 上 Enter 是否為他手把的 A 映射；若模擬鍵盤發的是其他鍵，把診斷行內容回報即可加對應備援鍵

### 驗證
- `node --check game.js` + `node test/smoke.js` → **185 斷言 0 FAIL**
- 瀏覽器實機（playwright-cli + chromium）：校正畫面「未偵測到」截圖確認（診斷行/三條對策排版正常、無重疊溢出）

### 技術備註
- steamOS 對策三選一：① Enter 射擊（已內建）② Steam 設定→控制器模板改鍵盤滑鼠模擬 ③ 桌面模式瀏覽器（Gamepad API 較正常）
- 校正診斷行讀 `navigator.getGamepads()` 全部項目（含未連接殘留），try/catch 保護 Node 環境
- 本輪後 game.js 3661 行（行號用 grep 現查為準）

---

## 2026-10-26（第三輪）：5 項平衡／電影感需求 —— ✅ 全部完成

### 結果
- 五項需求全部完成、各自 commit、**162 項斷言全綠**
- headless Chromium 實機驗證：慢動作時間線（0.3×、分裂登場完整落在慢動作內）、怒奴獨立暗紅尖刺造型＋畫面中央 3 條血條 ①②③、BGM 按鈕不再重疊心形血量

### ✅ Step A（9c91a2c）BGM 按鈕下移＋音量調大（item 1）
- [x] index.html `#bgm-btn` top 8→64px（心形底 ~y=39、「最高」y=54 → 64px 起不重疊）
- [x] bgmTick 音量：master 0.5→0.85、bass 0.11→0.16、lead 0.035→0.055

### ✅ Step B（2595661）慢動作系統（item 4/5 基礎）
- [x] `slowScale/slowmoT`＋`startSlowmo(scale, realSec)`/`endSlowmo()`/`tickSlowmo(realDt)`（真實秒倒數，不受縮時影響）
- [x] frame()：`rawDt → tickSlowmo(rawDt) → dt = rawDt * slowScale`——整個世界慢動作（物理、動畫、計時器全縮放）
- [x] reset() 重設；exports `get slowScale`/`startSlowmo`/`endSlowmo`/`tickSlowmo`
- [x] smoke 39（用紅怪位移量測 0.3× 真實生效；endSlowmo 與倒數到期都自動恢復）

### ✅ Step C（f9b4ef8）Tank 終結慢動作＋怒奴延遲分裂（items 4,5）
- [x] Tank out 形態登場：banner 後 `startSlowmo(0.35, 2.0)`；一發解決時 killBoss 頂部 `if (b.out) endSlowmo()` 立刻恢復
- [x] 怒怒死亡：`startSlowmo(0.3, 1.9)`＋`nunuSplitT=0.55` 延遲分裂（取代原立即 spawn 3 隻）；`nunuSplitX/Y` 記死亡點
- [x] update() playing 段：分裂倒數→spawn 3 隻怒奴（死亡點 i*74、`nunuIdx=1..3`）＋burst＋`nunuGroupCd=3`
- [x] smoke 18（out 時 endSlowmo 跳過電影感）/ 19（slowScale 0.3、死亡瞬間 0 怒奴、frames(130) 後 3 隻）/ 34（0.35× 斷言）同步
- [x] bug 修復：`nunuIdx = i + 2`（i 從 -1 起，原 i+1 會得到 0,1,2）

### ✅ Step D（ba32017）怒奴重生（item 2）
- [x] makeEnemy nunu：28×26→**64×60**（同怒怒 Boss 第一階段）＋`maxHp`（90→130 在 Step E）
- [x] 新向量 `drawNunu(e)`：暗紅尖刺球（環繞 10 支密刺、比 Boss 的 8 支更兇）＋白眼兇臉；face 座標一律朝右、由 `ctx.scale(f/sq, sq)` 翻轉；取代 `SPR.nunu`（紅怪 tintSprite 換色 copy，函數一併刪除）
- [x] drawEnemy：nunu→drawNunu 分支；**刪除頭頂 mini 血條**（連帶修掉 `/6` 舊 bug）；「!」「⚠」警示保留
- [x] HUD：無 boss 且怒奴活著（含分裂倒數中）→ 畫面中央 3 條 Boss 級血條垂直堆疊（標題「怒奴（第二階段）」＋①②③ 編號、bw=420、y=20/38/56），取代洞口進度條；分裂延遲期間先顯示 3 條空條預示
- [x] 分裂時序微調：0.55→**0.45** 遊戲秒、慢動作 1.9→**2.0s**（分裂登場完整落在慢動作內，符合「分裂成 3 隻才變回正常速度」）；split 間距 74→80（配合 64 寬）
- [x] smoke 40（身形 64×60 / maxHp / 向量繪製不崩 / 死亡路徑）

### ✅ Step E（e36e94f）武器平衡（item 3）
- [x] `weaponDmg()`：`+upgDmg` → **`+upgDmg*0.5`**（滿改機槍傷害 6→3.5）
- [x] `weaponCd()`：`×0.9^N` → **`×0.93^N`**（滿改機槍間隔 0.0395→0.0474s；滿改 DPS 152→74）
- [x] 敵 HP：紅紅 1→2、菇菇 2→3、龜 3→4、彈彈 3→4、怒奴 90→130
- [x] Boss HP：Dave 80→110、怒怒 90→130、Tank 110→150（代數 scaling 不變）
- [x] 商店升級說明同步（+0.5/級、-7%/級）；smoke 14c（龜 4→2）/17（Dave 200→300 幀）/19（130）/34（新公式斷言）/35（首殺按住 12→15 幀＝4 發）/40（130）同步
- [x] smoke 41（滿級傷害 3.5、×0.93^5 射速、3.5<龜 4 不秒殺、基礎手槍 4 發才斃龜）
- [x] 結果：基礎武器手感變難（紅紅要 2 發、龜要 4 發）、滿改也秒不掉小怪（3.5<4）、Boss 戰 1.5~10s 視武器等級

### 驗證
- `node --check game.js` + `node test/smoke.js` → **162 斷言 0 FAIL**
- 瀏覽器實機（playwright-cli + chromium）：hp=1 怒怒單發擊殺 → 時間線日誌：死亡 t≈0.8s → 0.3× 慢動作 → t≈2.3s 分裂 3 隻怒奴（慢動作內）→ t≈2.7s 恢復正常；截圖確認怒奴造型／3 條血條（①②③ 滿血登場）／「但它分裂了！」banner／BGM 按鈕位置

### 技術備註（未來要改電影感/平衡看這裡）
- 慢動作：`tickSlowmo` 用 rawDt（真實秒）倒數，不受縮時影響；smoke frames() 走真實 frame() 所以可測（1 幀=16.7ms）
- 怒奴時間線：死亡→`startSlowmo(0.3, 2.0)`＋`nunuSplitT=0.45` 遊戲秒（@0.3×＝1.5s 真實）→分裂 → 剩 0.5s 慢動作凝望 → 恢復
- HUD 3 條血條條件：`nunuSplitT > 0 || enemies.some(e => e.type==='nunu' && e.hp>0)`（drawHUD 的 boss else-if 分支）；用 `e.nunuIdx` 精確對應 ①②③
- 平衡公式：`weaponDmg() = WEAPONS[w].dmg + upgDmg*0.5`、`weaponCd() = cd * 0.93^upgRate`；快速查武器基礎值 grep `const WEAPONS`
- 檔案尾「關鍵代碼位置」行號是 2026-10-24 快照，本輪後 game.js 已 3578 行（用 grep 現查為準）

---

## 2026-10-25（第二輪）：標題封面圖＋BGM＋1px 碰撞修復 —— ✅ 全部完成

### 結果
- 三項需求全部完成、各自 commit、**143 項斷言全綠**
- headless Chromium 實機驗證：標題排版（左封面右文字不重疊）、BGM 排程器實際運轉、按鈕開關＋刷新後持久

### ✅ 1px 碰撞修復（a4101a1）
- [x] `updateBullets` 非火焰子彈 `hitR 5→6`：站定水平射不再差 1px 擦過貼地小紅怪的頭（玩家心 y=450、子彈 y=445、貼地紅心 y=460 → |Δ|=15 要 < 10+6=16）
- [x] smoke 36 回歸：Math.random 鎖 0.999（禁隨機跳躍/掉落）→ 貼地紅必被水平子彈命中；驗證過「改回 5 必 FAIL」

### ✅ 標題封面圖（a860c59）
- [x] `coverImg` 載入 `docs/game-cover.png`（`typeof Image` 保護，Node 自動 null）＋`coverReady()` 檢查 complete+naturalWidth
- [x] 標題排版：左側封面 267×400（2:3，x=44，紫色光暈＋金邊框），`centeredPanel(lines, cx)` 支援自訂中心、文字置中於 cx=613
- [x] 封面本身含遊戲 logo → 有封面時不重複畫大字標題（fallback：載入失敗/Node 自動改回純文字大標題）
- [x] smoke 37（無封面正常渲染）＋重新截 `docs/title.png`（960×540 新版面）

### ✅ BGM＋開關（6ce5999）
- [x] WebAudio 即時合成循環：A 小調 4 小節（Am→F→G→E）、112 BPM、32 個八分音步；三角波 bass（0.11）＋方波 lead（0.035）、master 0.5（比音效輕）；零音檔
- [x] `bgmTick()` 掛在 frame 主迴圈（超前排程 0.18s）；`wakeAudio()` 掛 keydown/pointerdown——瀏覽器規定音訊要使用者操作後才能啟動
- [x] index.html：canvas 包進 `#stage`（relative），右上角 `#bgm-btn` 金邊圓角按鈕（🎵/🔇、off 時置灰）
- [x] 偏好存 `localStorage.cave_blaster_bgm`（1/0，預設開）；`setBgm()` 關時重置排程（已排進 0.2s 內的音符自然淡出）
- [x] smoke 38（開關＋持久化＋無 AudioContext 安全）

### 驗證
- `node --check game.js` + `node test/smoke.js` → **143 斷言 0 FAIL**
- 瀏覽器：`BGM.step` 隨時間推進（排程器活）、點擊按鈕 → `🔇 | 0 | false`、reload 後維持 off

### 技術備註（未來要改音樂/音量看這裡）
- 旋律：`BGM_STEPS`（32 步陣列，b=bass / l=lead 音名）；音高表 `BGM_NOTES`；音量在 `bgmTick` 的 `bgmNote(..., 0.11/0.035, ...)` 與 master 0.5
- 要改 BGM 速度：`60 / 112 / 2`（BPM 112、八分音符）
- 封面尺寸/位置：標題分支 `cw=267, ch=400, cx0=44`＋`textCx=613`
- 檔尾「關鍵代碼位置」的行號是 2026-10-24 晚快照，本輪新增後 game.js 已 3496 行（用 grep 現查為準）

---

## 2026-10-25（第一輪）：Roadmap 最後兩項（武器升級 / 成就系統）＋怒奴 boss 確認 —— ✅ 全部完成（A/B/C）

### 結果
- **怒奴 boss（Jerry 交代的第 2 項）：✅ 確認已完成**（ec2da05 集體攻擊＋5b8eba9 HP 90），行為與描述完全一致，不需改碼
- **Roadmap 全部 30 項勾選完成**（武器升級＋成就系統是本輪最後兩項）
- smoke **137 項斷言全綠**

### ✅ Step A（b6ac3ee）武器升級收尾
- [x] 174 行簡體「对」→「對」
- [x] smoke 34（購買/成本/Lv5 上限/硬幣不足/weaponDmg/weaponCd/localStorage 持久）；109→118 斷言

### ✅ Step B（eb1b165）成就系統
- [x] `ACHIEVEMENTS` 12 項（id/icon/name/desc/test）：first_kill/ten_kills/fifty_kills/first_boss/king_kill/tank_kill/red_kill/escape/rich/all_weapons/upgraded/maxed
- [x] `prog`（kills/bossKing/bossTurtle/bossRed/raids）存 `cave_blaster_prog`；`achUnlocked[]` 存 `cave_blaster_ach`；`saveAch()`/`checkAch()`
- [x] 掛鉤：damageEnemy 死亡（kills++）、killBoss（bKey 映射）、清關（raids++）、enterShop、shopBuy、buyUpgrade
- [x] 解鎖 banner「🏆 成就解鎖：～」＋兩聲 beep
- [x] 標題選單 3 項（titleSel %3，鍵盤 ↑↓ / 手把上下）、第三項「🏆 成就（X/12）」→ mode "ach" 雙欄列表（✅/🔒＋描述）；Enter/Esc 回標題
- [x] centeredPanel 改按內容高度置中（行數多不超出畫面）
- [x] exports：ACHIEVEMENTS/checkAch/saveAch/prog/achUnlocked
- [x] smoke 35（真實射殺巨龜計入 kills / 12 成就全解鎖 / localStorage 持久化 / 成就頁進出）；118→137 斷言

### ✅ Step C docs 同步
- [x] README：武器升級表（4/5）、成就系統段（12 項表）、操作（4/5 鍵、標題三選單、成就頁）、遊戲流程（商店升級）、localStorage 新鍵、測試 109→137、Roadmap 最後兩項勾選
- [x] PROGRESS 本檔標記完成

### 成就系統設計（Step B 參考）
- `ACHIEVEMENTS`：{id, icon, name, desc, test}；`prog`（kills/boss{king,turtle,red}/raids）存 `cave_blaster_prog`；
  `unlocked[]` 存 `cave_blaster_ach`；`checkAch()` 在 damageEnemy 死亡、killBoss、清關、shopBuy、buyUpgrade 呼叫
- 標題：titleSel 0/1/2 循環（`(titleSel+1)%3`）、第三項「🏆 成就」→ mode "ach"；手把 up/down 同樣循環；Enter/Esc 回標題

## 2026-10-24（續 2）Step 4 收尾輪：關卡機制＋Tank 重做＋怒奴集體攻擊 —— ✅ 全部完成（A/B/C）

### ✅ Commit A（d96fd45）關卡機制＋暗影隨機漂移
- [x] 冰洞打滑：THEMES 加 `frict/accel/tip` 欄位；冰洞 `frict 0.97 / accel 0.5`（主洞/熔岩 0.8/0.9）；
      updatePlayer 用 `theme.frict ?? 0.8`、`theme.accel || 0.9`；newRaid banner 帶出提示
- [x] 環境粒子：update() 每 0.18s 刷——熔岩洞上升火星（`rise:true` 不受重力）、冰洞冰晶（`soft:true` 輕重力 0.02）；
      updateFx 粒子更新支援 rise/soft 旗標
- [x] 暗影獵手隨機懸浮：spawn 加 `hoverY(140~215px)/hoverOff(±90px)/driftT`，hover/back 每 0.9~2.3s 換一次目標
- [x] 主角 `freeze` 欄位 groundwork：updatePlayer 倒数＋輸入門（`p.freeze<=0` 才能動/跳/射）、drawPlayer 白色凍結疊層
      （本輪只在 Tank 終結用，但欄位已鋪好）
- [x] smoke 29（冰洞打滑 1.6 vs 主洞 0.0）/ 30（懸浮 2~3 種高度、140~215 範圍內）/ 31（熔岩 4~7 火星、冰洞 6~9 冰晶）

### ✅ Commit B（0e59aed）Tank 巨龜將軍重做（縮殼週期）
- [x] 週期：伸頸 `phase:"extend"` 4.5s 可攻擊（原三招：龜殼尖刺扇面/旋轉/召喚紅紅怪小弟）
      ↔ 縮殼 `phase:"shell"` 無敵：最多 3 次衝撞主角（每次起跳 vy-7、追當前位置、落地震屏）
      → 第 3 次落地 `triggerRockfall(dir)` → 停 2.0s → 再伸頸，無限循環
- [x] 落石：`rockWarns`（9 個「！」預警，0.8~1.2s 後變 rock ebullet，grav 墜落）→ 接地變 `groundRocks` 碎石
      （2.6s 消失、碰到 -1 心、要二段跳躲）；update() 計時、updateEBullets 落地、draw() 畫預警＋碎石
- [x] 龜殼無敵：updateBullets/updateBeams 先檢查 `boss.shell`（子彈彈開＋ping 音、光束無效）
- [x] 終結形態 `bossTakeOut()`：龜龜 hp≤0 時不直接死——`out:true, hp:1, player.freeze=1.1`（主角被震暈、白閃）、
      龜殼裂開露弱點，一發子彈擊殺；其他 Boss 不受影響（直接 killBoss）
- [x] 視覺：縮殼＝只剩龜殼（閃光無敵）；終結＝裂殼＋紫色弱點；drawBoss 三態
- [x] 重要修正：`chargeT=0.2s` 起跳保護——衝撞開始與落地判定在同一分支，沒保護會「同幀衝撞同幀落地」（debug 抓到的 bug）
- [x] smoke 32 全過（13 斷言：週期/無敵/3 衝撞/落石 9 預警/碎石 9 塊/伸頸/out/凍結/一發殺）
      測試技巧：`hold("KeyJ"); frames(1); release("KeyJ")`＝單發子彈；衝撞等 `frames(35)` 自然落地

### ✅ Commit C（ec2da05）怒奴集體攻擊
- [x] 設計：≥2 隻怒奴存活時每 7~10s（分裂後首次 3s）——全部飛向畫面邊緣 3 個 slot
      （`camX+90 / 中 / 右870`，高度有高有低 200/255/110px）→ 懸停 0.3s（⚠ 警示）→
      同時朝主角三發扇形彈（±0.16rad、速度 5.4、#c03535）→ 飛回地面 → 循環
- [x] game.js 已改：
  - 238-239 `nunuGroup="idle"` / `nunuGroupCd=4`；reset() 重置
  - killBoss 紅紅怪分裂後 `nunuGroupCd=3`
  - updateEnemies(1109+)：頂部觸發邏輯（idle→active 分 slot、active→idle 歸位判斷）
  - 怒奴普通攻擊加 `!e.gmode` 門、移動 `e.gmode ? 0 : ...`、重力 `e.gmode ? 0 : GRAVITY`
  - gmode 狀態機（gather 5.0 飛向 slot → hold 0.3s 齊射 → return 4.5 歸位 → null）
  - drawEnemy：gmode 非 return 時頭頂「⚠」
  - exports：`get nunuGroup()`、`resetNunuCd(v)`
- [x] smoke 33 已加並通過（test/smoke.js）：3 隻怒奴 → resetNunuCd(0.5) → 30 幀確認全進 gmode →
      80 幀確認橫距 780px/縱距 99px/怒奴子彈 3 發 → 150 幀確認歸位＋nunuGroup 回 idle
- [x] bug 已修：game.js:1128 `nunu.length` → `nunus.length`（filter 變數名是 `nunu` 複數）
- [x] 跑綠後 commit C：**smoke 109 斷言全綠、0 FAIL**

### ✅ docs 同步（已 commit）
- [x] README：關卡機制段落（冰洞打滑/熔岩火星/冰晶/暗影漂移）、怒奴怪物表＋Boss 表（集體攻擊）、
      Tank Boss 表改縮殼週期描述、暗影段落改隨機懸浮、smoke 84→109 斷言＋新增項目、Roadmap 勾選 3 項
- [x] 本檔更新

### 接續步驟（已全部完成）
1. ~~修 game.js:1128 typo~~ → 已修（perl \x73 插入 s）
2. ~~跑綠 109 斷言~~ → 已通過
3. ~~commit C~~ → ec2da05
4. ~~docs 同步~~ → 已 commit

## 2026-10-24 這一輪：Jerry 的 7 項修正/功能 —— ✅ 全部完成
- [x] 1. **暗影獵手改空中**（空中出現、平常懸浮主角上方、偶爾預警後俯衝干擾、一陣子後飛離）
  - 狀態機：enter → hover（175px、跟隨 3.0）→ warn（紅「！」0.7s）→ swoop（8.2、1.6s）→ back → leaving（45s）
- [x] 2. **機槍固定頻率**（70e2e50：fireAcc 累加器、15發/秒）
- [x] 3. **鐘乳石柱部分推下即可過**（31c2b40：沉底推下、ph≤190 可跳過）
- [x] 4. **暗影俯衝撞未推下石柱反彈**（石柱＝護盾；smoke 25）
- [x] 5. **怒怒分裂＋改第 3 隻 Boss**（BOSS_SCHEDULE [400 king / 700 turtle / 1000 red]；3 怒奴 tintSprite 暗紅）
- [x] 6. **二段跳**（~230px）
- [x] 7. **彈彈怪彈更高**（vy -13、~154px）

## 2026-10-24（續）關卡變體＋Boss 專屬舞台 —— ✅ Step 1-3 完成
- [x] Step 1：THEMES（main/ice/lava 各 13 色）＋ BOSS_THEMES；繪圖全引用 theme.*
- [x] Step 2：CAVE_ORDER 輪替；商店 Enter = newRaid()（換關）；重試 R 不換
- [x] Step 3：巨門前 100m 切 Boss 專屬配色；killBoss 還原
- [x] Step 4：↑ 見「續 2」章節（A/B/C 全部完成）
- 注意：test 15 商店 Enter 會觸發 newRaid（caveIdx 0→1），test 27 用「相對輪替」斷言

## 之後（未做）
- 武器升級（傷害/射速強化）
- 成就系統

## 關鍵代碼位置（game.js 3246 行，2026-10-24 晚更新）
- 主題：THEMES 49 / newRaid 99；ambientT 235 / rockWarns 236 / nunuGroup 238
- reset 261 / startGame 455 / makeEnemy 524 / spawnBoss 556（龜龜加 shell/phase/extT/chargeCount/pauseT/toExtend/chargeT）
- triggerRockfall 589 / bossTakeOut 599 / killBoss 618（分裂+nunuGroupCd=3、主題還原）/ dropLoot 708
- updatePlayer 832（theme 物理＋freeze 門）/ damageEnemy 1038 / updateDoors 1057
- updateEnemies 1109（**1128 有 1 行 typo 待修**；怒奴 gmode 觸發＋狀態機）/ updateShadow 1255（drift）
- enemyAttack 1400 / updateEBullets 1433（rock 落地→groundRocks）/ updateBullets 1463（龜殼無敵）
- updateBeams 1507（龜殼無敵）/ updateBoss 1556（龜龜三態週期）/ updateFx 1777（rise/soft）
- update 1807（環境粒子＋rockWarns/groundRocks 計時＋碎石撞擊）
- drawBackground 1935 / drawEnemy 2115（⚠）/ drawBoss 2305（三態視覺）/ drawPlayer 2635（凍結疊層）
- frame 3162 / exports 3213+（含 rockWarns/groundRocks/nunuGroup/resetNunuCd/particles/THEMES 等）
- test/smoke.js：frames(n) 逐幀 / hold/release 模擬按鍵 / ok() 斷言；**沒有 press() 輔助函式**
  （單發＝hold 1 幀再 release）；seeded Math.random（測試可重現）

## 歷史（2026-10-23，已完成，摘要）
- 第一階段修 5 bug：攝影機雙向跟隨 / 商店經濟重構 / 雷射改光束 / Boss 難度代數強化 / 手把校正（localStorage）
- 第二階段 4 功能：怒怒 Boss＋登場特寫系統 / 彈彈怪 / 鐘乳石柱 / 暗影獵手
- 美術準繩：docs/game-cover.png（紫水晶洞深紫＋紅橘強調）
