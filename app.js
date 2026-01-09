// kids math v5
// ✅ 不再把題庫存 localStorage（避免 makeChoices 函式消失）
// ✅ localStorage 只存：used / stats / perf / wrongBank / stickers
// ✅ 全題型四選一（加法/減法/比大小/數點點/看時鐘）

const CHILDREN = ["西瓜", "柚子", "小樂", "阿噗", "安安"];
const STORAGE_KEY = "kids_math_v5";

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

const MODE_LABEL = { add: "加法", sub: "減法", compare: "比大小", count: "數點點", clock: "看時鐘" };

// 比大小：固定 4 選項（孩子看得懂）
const CMP_CHOICES = ["左邊比較大", "右邊比較大", "一樣大", "我不確定"];
function cmpAnswerText(a, b) {
  if (a > b) return "左邊比較大";
  if (a < b) return "右邊比較大";
  return "一樣大";
}

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

let state = { child: CHILDREN[0], mode: "add", currentQ: null, allowAutoNext: true };

// ---------------- storage ----------------
function loadAll() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveAll(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}
function blankChildData() {
  return {
    stats: { streak: 0, correct: 0, wrong: 0, stars: 0 },
    used: { add: [], sub: [], compare: [], count: [], clock: [] },
    perf: {
      add: { attempt: 0, correct: 0 },
      sub: { attempt: 0, correct: 0 },
      compare: { attempt: 0, correct: 0 },
      count: { attempt: 0, correct: 0 },
      clock: { attempt: 0, correct: 0 },
    },
    wrongBank: {},
    stickers: {},
  };
}
function ensureChild(all, child) {
  if (!all[child]) all[child] = blankChildData();

  all[child].stats ||= { streak: 0, correct: 0, wrong: 0, stars: 0 };
  all[child].used ||= { add: [], sub: [], compare: [], count: [], clock: [] };
  all[child].perf ||= blankChildData().perf;
  all[child].wrongBank ||= {};
  all[child].stickers ||= {};

  // ✅ 兼容舊版：如果曾經存過 pools（壞的），直接丟掉
  if (all[child].pools) delete all[child].pools;

  return all[child];
}
function getChildData() {
  const all = loadAll();
  const p = ensureChild(all, state.child);
  saveAll(all);
  return { all, p };
}

// ---------------- UI helpers ----------------
function setFeedback(text, kind = "muted") {
  if (!els.feedback) return;
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

// ---------------- random helpers ----------------
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
function pickFromPool(pool, usedIds) {
  const available = pool.filter(q => !usedIds.includes(q.id));
  if (available.length === 0) {
    usedIds.length = 0; // 新一輪
    return pickFromPool(pool, usedIds);
  }
  return available[randInt(0, available.length - 1)];
}
function makeNumberChoices(correct, min, max) {
  const set = new Set([correct]);
  while (set.size < 4) set.add(randInt(min, max));
  return shuffle([...set]);
}
function makeClockChoices(correctHour) {
  const set = new Set([correctHour]);
  while (set.size < 4) set.add(randInt(1, 12));
  return shuffle([...set]);
}

// ---------------- question pools (IN MEMORY ONLY) ----------------
function buildPools() {
  const pools = { add: [], sub: [], compare: [], count: [], clock: [] };

  // add: a+b<=10
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    if (a + b <= 10) pools.add.push({
      id: `add_${a}_${b}`,
      prompt: `${a} + ${b} = ?`,
      answer: a + b,
      makeChoices: () => makeNumberChoices(a + b, 0, 10),
      hint: "把兩邊一起數一數～",
    });
  }

  // sub: a-b>=0
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= a; b++) {
    pools.sub.push({
      id: `sub_${a}_${b}`,
      prompt: `${a} − ${b} = ?`,
      answer: a - b,
      makeChoices: () => makeNumberChoices(a - b, 0, 10),
      hint: "先拿掉要減的，再數剩下幾個～",
    });
  }

  // compare: number + dots（含等量）
  for (let a = 0; a <= 10; a++) for (let b = 0; b <= 10; b++) {
    pools.compare.push({
      id: `cmp_num_${a}_${b}`,
      prompt: `比大小：${a} 和 ${b}\n選一個：`,
      answer: cmpAnswerText(a, b),
      makeChoices: () => CMP_CHOICES.slice(),
      hint: "一樣大就選「一樣大」。",
    });

    const L = a === 0 ? "（沒有點點）" : "●".repeat(a);
    const R = b === 0 ? "（沒有點點）" : "●".repeat(b);
    pools.compare.push({
      id: `cmp_dot_${a}_${b}`,
      prompt: `比大小：\n${L}\n和\n${R}\n誰比較多？`,
      answer: cmpAnswerText(a, b),
      makeChoices: () => CMP_CHOICES.slice(),
      hint: "先數左邊、再數右邊。",
    });
  }

  // count: 0~10
  for (let n = 0; n <= 10; n++) {
    pools.count.push({
      id: `count_${n}`,
      prompt: `${"🟣".repeat(n) || "（沒有點點）"}\n\n有幾個？`,
      answer: n,
      makeChoices: () => makeNumberChoices(n, 0, 10),
      hint: "一個一個慢慢數～",
    });
  }

  // clock: 1~12
  for (let h = 1; h <= 12; h++) {
    pools.clock.push({
      id: `clock_${h}`,
      hour: h,
      prompt: "現在是幾點？",
      answer: h,
      makeChoices: () => makeClockChoices(h),
      hint: "長針在 12，是整點。",
    });
  }

  Object.keys(pools).forEach(k => shuffle(pools[k]));
  return pools;
}
const BUILT_POOLS = buildPools();

// ---------------- quiz flow ----------------
function setMode(mode) {
  state.mode = mode;
  els.modeBtns.forEach(b => b.classList.toggle("active", b.dataset.mode === mode));
  setFeedback("");
  newQuestion();
}

function markUsed(q) {
  const { all, p } = getChildData();
  const used = p.used[state.mode];
  if (!used.includes(q.id)) used.push(q.id);
  saveAll(all);
}

function recordAttempt({ correct, q }) {
  const { all, p } = getChildData();
  p.perf[state.mode].attempt += 1;
  if (correct) p.perf[state.mode].correct += 1;

  if (!correct) {
    p.wrongBank[q.id] ||= { count: 0, lastPrompt: q.prompt, mode: state.mode };
    p.wrongBank[q.id].count += 1;
    p.wrongBank[q.id].lastPrompt = q.prompt;
    p.wrongBank[q.id].mode = state.mode;
  }
  saveAll(all);
}

function awardStars() {
  const { all, p } = getChildData();
  let gain = 1;
  if (p.stats.streak > 0 && p.stats.streak % 5 === 0) gain += 2;
  p.stats.stars += gain;
  saveAll(all);
}

function newQuestion() {
  const { p } = getChildData();
  const pool = BUILT_POOLS[state.mode];           // ✅ 永遠用記憶體題庫
  const used = p.used[state.mode] || [];

  const q = pickFromPool(pool, used);
  state.currentQ = q;

  // render question
  if (state.mode === "clock") {
    els.questionArea.innerHTML = `
      <div class="clockWrap">
        ${makeClockSVG(q.hour)}
        <div class="clockHint">（整點）長針在 12</div>
      </div>
    `;
  } else {
    els.questionArea.innerHTML = escapeHtml(q.prompt).replace(/\n/g, "<br>");
  }

  // render choices (ALWAYS 4)
  let choices = (typeof q.makeChoices === "function") ? q.makeChoices() : [];
  if (!Array.isArray(choices)) choices = [];
  while (choices.length < 4) choices.push("我不確定");
  if (choices.length > 4) choices = choices.slice(0, 4);

  els.choicesArea.innerHTML = "";
  choices.forEach(c => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.type = "button";
    btn.textContent = String(c);
    btn.addEventListener("click", () => submitAnswer(c));
    els.choicesArea.appendChild(btn);
  });
}

function submitAnswer(choice) {
  const q = state.currentQ;
  if (!q) return;

  const isCorrect = String(choice) === String(q.answer);

  markUsed(q);
  recordAttempt({ correct: isCorrect, q });

  const { all, p } = getChildData();
  if (isCorrect) {
    p.stats.correct += 1;
    p.stats.streak += 1;
    awardStars();
    saveAll(all);
    renderStats();
    setFeedback("答對了！⭐", "good");
    if (state.allowAutoNext) {
      setTimeout(() => { setFeedback(""); newQuestion(); }, 550);
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
  setFeedback("跳過也沒關係～", "muted");
  setTimeout(() => { setFeedback(""); newQuestion(); }, 350);
}
function resetChild() {
  const all = loadAll();
  all[state.child] = blankChildData();
  saveAll(all);
  renderStats();
  setFeedback("已清空這位小朋友的紀錄。", "muted");
  newQuestion();
}

// ---------------- stickers & parent ----------------
function openModal(el) { el.classList.add("show"); el.setAttribute("aria-hidden", "false"); }
function closeModal(el) { el.classList.remove("show"); el.setAttribute("aria-hidden", "true"); }

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
    btn.addEventListener("click", () => buySticker(st.id));
    card.appendChild(btn);
    els.shopList.appendChild(card);
  });
  renderOwnedStickers();
}
function renderOwnedStickers() {
  const { p } = getChildData();
  const ids = Object.keys(p.stickers).filter(id => p.stickers[id] > 0);
  if (ids.length === 0) {
    els.ownedList.innerHTML = `<div class="muted">目前還沒有貼紙～</div>`;
    return;
  }
  els.ownedList.innerHTML = "";
  ids.map(id => ({ id, count: p.stickers[id], meta: STICKERS.find(s => s.id === id) }))
    .sort((a, b) => b.count - a.count)
    .forEach(it => {
      const row = document.createElement("div");
      row.className = "ownedItem";
      row.innerHTML = `
        <div class="ownedLeft">
          <div class="ownedEmoji">${it.meta?.emoji || "🎟️"}</div>
          <div style="font-weight:900;">${it.meta?.name || it.id}</div>
        </div>
        <div class="ownedCount">× ${it.count}</div>
      `;
      els.ownedList.appendChild(row);
    });
}
function buySticker(id) {
  const st = STICKERS.find(s => s.id === id);
  if (!st) return;

  const { all, p } = getChildData();
  if (p.stats.stars < st.cost) return;

  p.stats.stars -= st.cost;
  p.stickers[id] = (p.stickers[id] || 0) + 1;

  saveAll(all);
  renderStats();
  renderStickerShop();
  setFeedback(`兌換成功！${st.emoji}`, "good");
  setTimeout(() => setFeedback(""), 800);
}

function percent(n) { return `${Math.round(n * 100)}%`; }
function renderParent() {
  const { p } = getChildData();

  // accuracy
  els.accuracyTable.innerHTML = "";
  const head = document.createElement("div");
  head.className = "row head";
  head.innerHTML = `<div>題型</div><div>命中率</div><div>作答</div>`;
  els.accuracyTable.appendChild(head);

  ["add", "sub", "compare", "count", "clock"].forEach(m => {
    const a = p.perf[m]?.attempt || 0;
    const c = p.perf[m]?.correct || 0;
    const acc = a === 0 ? 0 : c / a;
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div style="font-weight:900;">${MODE_LABEL[m]}</div>
      <div><span class="badge">${percent(acc)}</span></div>
      <div style="font-weight:900;">${c}/${a}</div>
    `;
    els.accuracyTable.appendChild(row);
  });

  // wrong top
  const items = Object.entries(p.wrongBank || {})
    .map(([qid, info]) => ({ qid, ...info }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (items.length === 0) {
    els.wrongTop.innerHTML = `<div class="muted">目前沒有常錯題～</div>`;
    return;
  }

  els.wrongTop.innerHTML = "";
  items.forEach(it => {
    const box = document.createElement("div");
    box.className = "wrongItem";
    box.innerHTML = `
      <div style="font-weight:900; font-size:14px;">${escapeHtml((it.lastPrompt || "").replace(/\n/g, " / "))}</div>
      <div class="wrongMeta">
        <span>題型：${MODE_LABEL[it.mode] || it.mode}</span>
        <span>錯誤：${it.count}</span>
      </div>
    `;
    els.wrongTop.appendChild(box);
  });
}

// ---------------- clock svg + utils ----------------
function makeClockSVG(hour) {
  const size = 220, cx = size / 2, cy = size / 2, r = 90;
  const angleDeg = (hour % 12) * 30 - 90;
  const rad = angleDeg * Math.PI / 180;
  const hx = cx + Math.cos(rad) * 55;
  const hy = cy + Math.sin(rad) * 55;
  const mx = cx, my = cy - 75;

  let marks = "";
  for (let h = 1; h <= 12; h++) {
    const a = (h % 12) * 30 - 90;
    const rr = a * Math.PI / 180;
    const tx = cx + Math.cos(rr) * 72;
    const ty = cy + Math.sin(rr) * 72;
    marks += `<text x="${tx}" y="${ty + 6}" text-anchor="middle" font-size="14" font-weight="800" fill="#1f2a37">${h}</text>`;
  }

  return `
  <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" aria-label="clock">
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffffff" stroke="#e5e7eb" stroke-width="6"></circle>
    ${marks}
    <line x1="${cx}" y1="${cy}" x2="${mx}" y2="${my}" stroke="#2563eb" stroke-width="6" stroke-linecap="round"></line>
    <line x1="${cx}" y1="${cy}" x2="${hx}" y2="${hy}" stroke="#1f2a37" stroke-width="8" stroke-linecap="round"></line>
    <circle cx="${cx}" cy="${cy}" r="7" fill="#1f2a37"></circle>
  </svg>`;
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// ---------------- init ----------------
function initChildSelect() {
  els.childSelect.innerHTML = "";
  CHILDREN.forEach(n => {
    const opt = document.createElement("option");
    opt.value = n; opt.textContent = n;
    els.childSelect.appendChild(opt);
  });

  const all = loadAll();
  if (all.__lastChild && CHILDREN.includes(all.__lastChild)) state.child = all.__lastChild;
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
  els.modeBtns.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));
  els.nextBtn.addEventListener("click", nextQuestion);
  els.skipBtn.addEventListener("click", skipQuestion);
  els.resetBtn.addEventListener("click", resetChild);

  els.stickersBtn.addEventListener("click", () => { renderStickerShop(); openModal(els.stickersModal); });
  els.closeStickers.addEventListener("click", () => closeModal(els.stickersModal));
  els.stickersModal.addEventListener("click", (e) => { if (e.target === els.stickersModal) closeModal(els.stickersModal); });

  els.parentBtn.addEventListener("click", () => { renderParent(); openModal(els.parentModal); });
  els.closeParent.addEventListener("click", () => closeModal(els.parentModal));
  els.parentModal.addEventListener("click", (e) => { if (e.target === els.parentModal) closeModal(els.parentModal); });
}

(function boot() {
  initChildSelect();
  initEvents();
  renderStats();
  setMode("add");
})();
