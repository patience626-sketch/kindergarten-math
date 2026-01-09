// 幼兒數學練習（GitHub Pages 版）
// ✅ 題目不重複（每種模式各自一輪）
// ✅ 每個小朋友進度分開存 localStorage
// ✅ 答對自動下一題；答錯顯示提示，按下一題才前進
// ✅ 星星換貼紙（貼紙商店 & 收藏）
// ✅ 家長區：各題型命中率、常錯題 TOP10
// ✅ 比大小增加「=」與等量題

const CHILDREN = ["西瓜", "柚子", "小樂", "阿噗", "安安"]; // 你可自行改

const STICKERS = [
  { id: "st_heart", emoji: "💖", name: "愛心貼", cost: 6 },
  { id: "st_star", emoji: "🌟", name: "星星貼", cost: 8 },
  { id: "st_rainbow", emoji: "🌈", name: "彩虹貼", cost: 10 },
  { id: "st_dino", emoji: "🦕", name: "恐龍貼", cost: 12 },
  { id: "st_cat", emoji: "🐱", name: "貓貓貼", cost: 12 },
  { id: "st_ice", emoji: "🍦", name: "冰淇淋貼", cost: 14 },
  { id: "st_bear", emoji: "🧸", name: "小熊貼", cost: 14 },
  { id: "st_rocket", emoji: "🚀", name: "火箭貼", cost: 16 },
];

const MODE_LABEL = {
  add: "加法",
  sub: "減法",
  compare: "比大小",
  count: "數點點",
  clock: "看時鐘",
};

const els = {
  childSelect: document.getElementById("childSelect"),
  resetBtn: document.getElementById("resetBtn"),
  modeBtns: Array.from(document.querySelectorAll(".mode")),
  questionArea: document.getElementById("questionArea"),
  choicesArea: document.getElementById("choicesArea"),
  nextBtn: document.getElementById("nextBtn"),
  skipBtn: document.getElementById("skipBtn"),
  feedback: document.getElementById("feedback"),
  streak: document.getElementById("streak"),
  correct: document.getElementById("correct"),
  wrong: document.getElementById("wrong"),

  stars: document.getElementById("stars"),
  stickersBtn: document.getElementById("stickersBtn"),
  parentBtn: document.getElementById("parentBtn"),

  stickersModal: document.getElementById("stickersModal"),
  closeStickers: document.getElementById("closeStickers"),
  shopList: document.getElementById("shopList"),
  ownedList: document.getElementById("ownedList"),

  parentModal: document.getElementById("parentModal"),
  closeParent: document.getElementById("closeParent"),
  accuracyTable: document.getElementById("accuracyTable"),
  wrongTop: document.getElementById("wrongTop"),
};

const STORAGE_KEY = "kids_math_v2";

let state = {
  child: CHILDREN[0],
  mode: "add", // add | sub | compare | count | clock
  currentQ: null,
  allowAutoNext: true,
};

// ----------------- storage helpers -----------------
function loadAll() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
function saveAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function blankChildData() {
  return {
    stats: { streak: 0, correct: 0, wrong: 0, stars: 0 },
    pools: { add: [], sub: [], compare: [], count: [], clock: [] },
    used: { add: [], sub: [], compare: [], count: [], clock: [] },

    // 命中率：各模式 attempt / correct
    perf: {
      add: { attempt: 0, correct: 0 },
      sub: { attempt: 0, correct: 0 },
      compare: { attempt: 0, correct: 0 },
      count: { attempt: 0, correct: 0 },
      clock: { attempt: 0, correct: 0 },
    },

    // 常錯題：qid -> {count, lastPrompt, mode}
    wrongBank: {},

    // 貼紙收藏：stickerId -> count
    stickers: {},
  };
}

function ensureChildProgress(all, child) {
  if (!all[child]) all[child] = blankChildData();
  // 補齊欄位（避免你未來更新版本）
  all[child].stats ||= { streak: 0, correct: 0, wrong: 0, stars: 0 };
  all[child].pools ||= { add: [], sub: [], compare: [], count: [], clock: [] };
  all[child].used ||= { add: [], sub: [], compare: [], count: [], clock: [] };
  all[child].perf ||= blankChildData().perf;
  all[child].wrongBank ||= {};
  all[child].stickers ||= {};
  if (typeof all[child].stats.stars !== "number") all[child].stats.stars = 0;
  return all[child];
}

function getChildData() {
  const all = loadAll();
  const p = ensureChildProgress(all, state.child);

  // 初始化題庫（只要沒有就塞入 build 的題庫引用）
  for (const mode of Object.keys(BUILT_POOLS)) {
    if (!p.pools[mode] || p.pools[mode].length === 0) p.pools[mode] = BUILT_POOLS[mode];
    if (!p.used[mode]) p.used[mode] = [];
  }
  saveAll(all);
  return { all, p };
}

function setFeedback(text, kind = "muted") {
  els.feedback.className = `feedback ${kind}`;
  els.feedback.textContent = text || "";
}

function renderStats() {
  const { p } = getChildData();
  els.streak.textContent = p.stats.streak;
  els.correct.textContent = p.stats.correct;
  els.wrong.textContent = p.stats.wrong;
  els.stars.textContent = p.stats.stars;
}

// ----------------- random helpers -----------------
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pickFromPool(pool, used) {
  const available = pool.filter(q => !used.includes(q.id));
  if (available.length === 0) {
    used.length = 0; // 新一輪
    return pickFromPool(pool, used);
  }
  return available[randInt(0, available.length - 1)];
}

function makeNumberChoices(correct, min, max) {
  const set = new Set([correct]);
  while (set.size < 4) set.add(randInt(min, max));
  return shuffle(Array.from(set));
}
function makeClockChoices(correctHour) {
  const set = new Set([correctHour]);
  while (set.size < 4) set.add(randInt(1, 12));
  return shuffle(Array.from(set));
}

// ----------------- question pools -----------------
function buildPools() {
  const pools = { add: [], sub: [], compare: [], count: [], clock: [] };

  // 1) 10 以內加法：a+b <= 10
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      if (a + b <= 10) {
        pools.add.push({
          id: `add_${a}_${b}`,
          type: "mc",
          prompt: `${a} + ${b} = ?`,
          answer: a + b,
          makeChoices: () => makeNumberChoices(a + b, 0, 10),
          hint: "把兩邊的數字一起數一數！",
        });
      }
    }
  }

  // 2) 10 以內減法：a-b >= 0
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= a; b++) {
      pools.sub.push({
        id: `sub_${a}_${b}`,
        type: "mc",
        prompt: `${a} − ${b} = ?`,
        answer: a - b,
        makeChoices: () => makeNumberChoices(a - b, 0, 10),
        hint: "先拿掉要減的數量，再數剩下幾個！",
      });
    }
  }

  // 3) 比大小：數字 / 物體點點 / 撲克牌點數
  // ✅ 加入 "=" 與等量題
  const cmpAnswer = (a, b) => (a > b ? ">" : a < b ? "<" : "=");
  const cmpChoices = () => shuffle([">", "<", "="]);

  // 3-1 數字比較（含等量）
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      pools.compare.push({
        id: `cmp_num_${a}_${b}`,
        type: "mc",
        prompt: `${a}  ?  ${b}`,
        answer: cmpAnswer(a, b),
        makeChoices: cmpChoices,
        hint: "大的用「>」，小的用「<」，一樣大用「=」。",
      });
    }
  }

  // 3-2 點點比較（含等量）
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      const left = a === 0 ? "（沒有點點）" : "●".repeat(a);
      const right = b === 0 ? "（沒有點點）" : "●".repeat(b);
      pools.compare.push({
        id: `cmp_dot_${a}_${b}`,
        type: "mc",
        prompt: `${left}  ?  ${right}`,
        answer: cmpAnswer(a, b),
        makeChoices: cmpChoices,
        hint: "先數左邊幾個、右邊幾個；一樣多就選「=」！",
      });
    }
  }

  // 3-3 撲克牌點數比較（用 ♠ + 點數，含等量）
  const cardFace = (n) => String(n); // 0~10 也可顯示，讓 0 當作簡單題
  for (let a = 0; a <= 10; a++) {
    for (let b = 0; b <= 10; b++) {
      pools.compare.push({
        id: `cmp_card_${a}_${b}`,
        type: "mc",
        prompt: `♠${cardFace(a)}  ?  ♠${cardFace(b)}`,
        answer: cmpAnswer(a, b),
        makeChoices: cmpChoices,
        hint: "這裡看點數大小：一樣大就選「=」。",
      });
    }
  }

  // 4) 數點點（選擇題）
  for (let n = 0; n <= 10; n++) {
    pools.count.push({
      id: `count_${n}`,
      type: "mc",
      prompt: `${"🟣".repeat(n) || "（沒有點點）"}\n\n有幾個？`,
      answer: n,
      makeChoices: () => makeNumberChoices(n, 0, 10),
      hint: "一個一個慢慢數，不要跳著數～",
    });
  }

  // 5) 看時鐘（整點）
  for (let h = 1; h <= 12; h++) {
    pools.clock.push({
      id: `clock_${h}`,
      type: "clock",
      hour: h,
      prompt: `現在是幾點？`,
      answer: h,
      makeChoices: () => makeClockChoices(h),
      hint: "長針指 12 是整點；短針指哪裡就是幾點！",
    });
  }

  Object.keys(pools).forEach(k => shuffle(pools[k]));
  return pools;
}

const BUILT_POOLS = buildPools();

// ----------------- render question & choices -----------------
function setMode(mode) {
  state.mode = mode;
  els.modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  setFeedback("");
  newQuestion();
}

function newQuestion() {
  const { p } = getChildData();
  const pool = p.pools[state.mode];
  const used = p.used[state.mode];

  const q = pickFromPool(pool, used);
  state.currentQ = q;

  renderQuestion(q);
  renderChoices(q);
}

function renderQuestion(q) {
  if (state.mode === "clock") {
    const svg = makeClockSVG(q.hour);
    els.questionArea.innerHTML = `
      <div class="clockWrap">
        ${svg}
        <div class="clockHint">（整點）長針在 12</div>
      </div>
    `;
  } else {
    const safe = escapeHtml(q.prompt).replace(/\n/g, "<br>");
    els.questionArea.innerHTML = safe;
  }
}

function renderChoices(q) {
  els.choicesArea.innerHTML = "";
  const choices = q.makeChoices();

  choices.forEach(choice => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = String(choice);
    btn.addEventListener("click", () => submitAnswer(choice));
    els.choicesArea.appendChild(btn);
  });
}

function markUsed(q) {
  const { all, p } = getChildData();
  const used = p.used[state.mode];
  if (!used.includes(q.id)) used.push(q.id);
  saveAll(all);
}

function recordAttempt({ correct, q }) {
  const { all, p } = getChildData();
  // perf
  p.perf[state.mode].attempt += 1;
  if (correct) p.perf[state.mode].correct += 1;

  // wrong bank
  if (!correct) {
    const key = q.id;
    if (!p.wrongBank[key]) {
      p.wrongBank[key] = {
        count: 1,
        lastPrompt: q.prompt,
        mode: state.mode,
      };
    } else {
      p.wrongBank[key].count += 1;
      p.wrongBank[key].lastPrompt = q.prompt;
      p.wrongBank[key].mode = state.mode;
    }
  }
  saveAll(all);
}

function awardStars(onCorrect) {
  if (!onCorrect) return;
  const { all, p } = getChildData();

  // 基礎：答對 +1 星
  let gain = 1;

  // 小小獎勵：連續 5 題 +2 星（讓孩子更有成就感）
  if (p.stats.streak > 0 && p.stats.streak % 5 === 0) gain += 2;

  p.stats.stars += gain;
  saveAll(all);

  // 星星提示（不打擾）
  // 你如果覺得太吵可以拿掉這行
  // setFeedback(`+${gain}⭐！`, "good");
}

function submitAnswer(choice) {
  if (!state.currentQ) return;
  const q = state.currentQ;

  const isCorrect = (String(choice) === String(q.answer));

  markUsed(q);
  recordAttempt({ correct: isCorrect, q });

  const { all, p } = getChildData();

  if (isCorrect) {
    p.stats.correct += 1;
    p.stats.streak += 1;

    awardStars(true);

    saveAll(all);
    renderStats();
    setFeedback("答對了！太棒了 ⭐", "good");

    if (state.allowAutoNext) {
      setTimeout(() => {
        setFeedback("");
        newQuestion();
      }, 550);
    }
  } else {
    p.stats.wrong += 1;
    p.stats.streak = 0;
    saveAll(all);
    renderStats();
    setFeedback(`再想想～提示：${q.hint}`, "bad");
  }
}

function nextQuestion() {
  if (state.currentQ) markUsed(state.currentQ);
  setFeedback("");
  newQuestion();
}

function skipQuestion() {
  if (state.currentQ) markUsed(state.currentQ);
  setFeedback("跳過也沒關係，我們下一題！", "muted");
  setTimeout(() => {
    setFeedback("");
    newQuestion();
  }, 350);
}

function resetChild() {
  const all = loadAll();
  all[state.child] = blankChildData();
  // 保留題庫引用
  all[state.child].pools = {
    add: BUILT_POOLS.add,
    sub: BUILT_POOLS.sub,
    compare: BUILT_POOLS.compare,
    count: BUILT_POOLS.count,
    clock: BUILT_POOLS.clock,
  };
  saveAll(all);
  renderStats();
  setFeedback("已清空這位小朋友的紀錄。", "muted");
  newQuestion();
}

// ----------------- 🎁 Stickers shop -----------------
function openModal(modalEl) {
  modalEl.classList.add("show");
  modalEl.setAttribute("aria-hidden", "false");
}
function closeModal(modalEl) {
  modalEl.classList.remove("show");
  modalEl.setAttribute("aria-hidden", "true");
}

function renderStickerShop() {
  const { p } = getChildData();
  els.shopList.innerHTML = "";

  STICKERS.forEach(st => {
    const owned = p.stickers[st.id] || 0;
    const canBuy = p.stats.stars >= st.cost;

    const card = document.createElement("div");
    card.className = "shopItem";
    card.innerHTML = `
      <div class="shopEmoji">${st.emoji}</div>
      <div class="shopName">${st.name}</div>
      <div class="shopCost">需要 ⭐ ${st.cost} ｜已擁有：${owned}</div>
    `;

    const btn = document.createElement("button");
    btn.className = canBuy ? "primary" : "";
    btn.textContent = canBuy ? "兌換" : "星星不夠";
    btn.disabled = !canBuy;

    btn.addEventListener("click", () => {
      buySticker(st.id);
    });

    card.appendChild(btn);
    els.shopList.appendChild(card);
  });

  renderOwnedStickers();
}

function renderOwnedStickers() {
  const { p } = getChildData();
  const ownedIds = Object.keys(p.stickers).filter(id => p.stickers[id] > 0);

  if (ownedIds.length === 0) {
    els.ownedList.innerHTML = `<div class="muted">目前還沒有貼紙～去左邊換一張吧！</div>`;
    return;
  }

  // 顯示：emoji + 名稱 + 數量
  els.ownedList.innerHTML = "";
  ownedIds
    .map(id => ({ id, count: p.stickers[id], meta: STICKERS.find(s => s.id === id) }))
    .sort((a, b) => (b.count - a.count))
    .forEach(item => {
      const row = document.createElement("div");
      row.className = "ownedItem";
      row.innerHTML = `
        <div class="ownedLeft">
          <div class="ownedEmoji">${item.meta?.emoji || "🎟️"}</div>
          <div>
            <div style="font-weight:900;">${item.meta?.name || item.id}</div>
            <div class="muted" style="font-size:12px;">收藏中</div>
          </div>
        </div>
        <div class="ownedCount">× ${item.count}</div>
      `;
      els.ownedList.appendChild(row);
    });
}

function buySticker(stickerId) {
  const st = STICKERS.find(s => s.id === stickerId);
  if (!st) return;

  const { all, p } = getChildData();
  if (p.stats.stars < st.cost) return;

  p.stats.stars -= st.cost;
  p.stickers[stickerId] = (p.stickers[stickerId] || 0) + 1;

  saveAll(all);
  renderStats();
  renderStickerShop();
  setFeedback(`兌換成功！你得到一張「${st.name}」${st.emoji}`, "good");
  setTimeout(() => setFeedback(""), 900);
}

// ----------------- 📊 Parent dashboard -----------------
function openParentDashboard() {
  renderParentAccuracy();
  renderParentWrongTop();
  openModal(els.parentModal);
}

function percent(n) {
  if (!isFinite(n)) return "0%";
  return `${Math.round(n * 100)}%`;
}

function renderParentAccuracy() {
  const { p } = getChildData();
  const rows = ["add", "sub", "compare", "count", "clock"].map(mode => {
    const a = p.perf[mode]?.attempt || 0;
    const c = p.perf[mode]?.correct || 0;
    const acc = a === 0 ? 0 : c / a;
    return { mode, a, c, acc };
  });

  els.accuracyTable.innerHTML = "";
  const head = document.createElement("div");
  head.className = "row head";
  head.innerHTML = `<div>題型</div><div>命中率</div><div>作答</div>`;
  els.accuracyTable.appendChild(head);

  rows.forEach(r => {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="font-weight:900;">${MODE_LABEL[r.mode]}</div>
      <div><span class="badge">${percent(r.acc)}</span></div>
      <div style="font-weight:900;">${r.c}/${r.a}</div>
    `;
    els.accuracyTable.appendChild(row);
  });
}

function renderParentWrongTop() {
  const { p } = getChildData();
  const items = Object.entries(p.wrongBank || {})
    .map(([qid, info]) => ({ qid, ...info }))
    .sort((a, b) => (b.count - a.count))
    .slice(0, 10);

  if (items.length === 0) {
    els.wrongTop.innerHTML = `<div class="muted">目前還沒有常錯題，做得很不錯～</div>`;
    return;
  }

  els.wrongTop.innerHTML = "";
  items.forEach(it => {
    const box = document.createElement("div");
    box.className = "wrongItem";

    const prompt = (it.lastPrompt || "").replace(/\n/g, " / ");
    box.innerHTML = `
      <div style="font-weight:900; font-size:14px;">${escapeHtml(prompt)}</div>
      <div class="wrongMeta">
        <span>題型：${MODE_LABEL[it.mode] || it.mode}</span>
        <span>錯誤次數：${it.count}</span>
      </div>
    `;
    els.wrongTop.appendChild(box);
  });
}

// ----------------- Clock SVG -----------------
function makeClockSVG(hour) {
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const r = 90;

  const angleDeg = (hour % 12) * 30 - 90;
  const angleRad = angleDeg * Math.PI / 180;

  const hx = cx + Math.cos(angleRad) * 55;
  const hy = cy + Math.sin(angleRad) * 55;

  const mx = cx;
  const my = cy - 75;

  let marks = "";
  for (let h = 1; h <= 12; h++) {
    const a = (h % 12) * 30 - 90;
    const rad = a * Math.PI / 180;
    const tx = cx + Math.cos(rad) * 72;
    const ty = cy + Math.sin(rad) * 72;
    marks += `<text x="${tx}" y="${ty+6}" text-anchor="middle" font-size="14" font-weight="800" fill="#1f2a37">${h}</text>`;
  }

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="clock">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#e5e7eb" stroke-width="6"></circle>
    ${marks}
    <line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="#2563eb" stroke-width="6" stroke-linecap="round"></line>
    <line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="#1f2a37" stroke-width="8" stroke-linecap="round"></line>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#1f2a37"></circle>
  </svg>
  `;
}

// ----------------- Utils -----------------
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ----------------- Init -----------------
function initChildSelect() {
  els.childSelect.innerHTML = "";
  CHILDREN.forEach(name => {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    els.childSelect.appendChild(opt);
  });

  const all = loadAll();
  const last = all.__lastChild;
  if (last && CHILDREN.includes(last)) state.child = last;

  els.childSelect.value = state.child;

  els.childSelect.addEventListener("change", () => {
    state.child = els.childSelect.value;
    const all2 = loadAll();
    all2.__lastChild = state.child;
    saveAll(all2);
    renderStats();
    setFeedback("");
    newQuestion();
  });
}

function initEvents() {
  els.modeBtns.forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });
  els.nextBtn.addEventListener("click", nextQuestion);
  els.skipBtn.addEventListener("click", skipQuestion);
  els.resetBtn.addEventListener("click", resetChild);

  // 貼紙
  els.stickersBtn.addEventListener("click", () => {
    renderStickerShop();
    openModal(els.stickersModal);
  });
  els.closeStickers.addEventListener("click", () => closeModal(els.stickersModal));
  els.stickersModal.addEventListener("click", (e) => {
    if (e.target === els.stickersModal) closeModal(els.stickersModal);
  });

  // 家長區
  els.parentBtn.addEventListener("click", openParentDashboard);
  els.closeParent.addEventListener("click", () => closeModal(els.parentModal));
  els.parentModal.addEventListener("click", (e) => {
    if (e.target === els.parentModal) closeModal(els.parentModal);
  });

  // Enter 下一題（給大人用）
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter") nextQuestion();
    if (e.key === "Escape") {
      closeModal(els.stickersModal);
      closeModal(els.parentModal);
    }
  });
}

(function boot() {
  initChildSelect();
  initEvents();
  renderStats();
  setMode("add");
})();
