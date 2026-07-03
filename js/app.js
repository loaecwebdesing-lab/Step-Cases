/* =====================================================
   STEP CASES — Game logic
   ===================================================== */

const BONUS_AMOUNT = 5;
const BONUS_COOLDOWN = 60_000; // 60s

/* ---------- State ---------- */
let state = defaultState();
let currentCase = null;
let openCount = 1;
let isOpening = false;
let lastResults = [];
let resultsHandled = false;

function defaultState() {
  return typeof defaultGameState === "function" ? defaultGameState() : {
    balance: 10,
    inventory: [],
    stats: { opened: 0, spent: 0, won: 0, bestDrop: null, knives: 0, gloves: 0, battles: 0, battlesWon: 0, upgrades: 0, upgradesWon: 0 },
    lastBonus: 0,
    xp: 0,
  };
}

async function loadState() {
  if (useCloud() && isLoggedIn()) {
    try {
      const row = await dbFetchProfile(authUserId());
      return profileToState(row);
    } catch (e) {
      console.error("Cloud load failed:", e);
    }
  }
  const localKey = isLoggedIn() ? "arena-save-" + authUserId() : "stepcases-guest-v1";
  try {
    const raw = localStorage.getItem(localKey);
    if (raw) return Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { /* corrupt save */ }
  return defaultState();
}

function saveState() {
  if (useCloud() && isLoggedIn()) {
    scheduleCloudSave(authUserId(), state);
    return;
  }
  const localKey = isLoggedIn() ? "arena-save-" + authUserId() : "stepcases-guest-v1";
  localStorage.setItem(localKey, JSON.stringify(state));
}

function addXp(amount) {
  const before = levelFromXp(state.xp);
  state.xp = +(state.xp + amount).toFixed(1);
  const after = levelFromXp(state.xp);
  if (after > before) {
    for (let lvl = before + 1; lvl <= after; lvl++) {
      const bonus = levelUpBonus(lvl);
      state.balance = +(state.balance + bonus).toFixed(2);
      toast(`🎉 LEVEL ${lvl} reached! +${fmt(bonus)} bonus`);
    }
    winSound("classified");
  }
  renderUserChip();
}

/* ---------- Helpers (function = global, shared across script files) ---------- */
function $(sel) { return document.querySelector(sel); }
function fmt(n) { return "$" + n.toFixed(2); }

function buildAllCases() {
  return [
    ...(window.CASES || []),
    ...(window.EXCLUSIVE_CASES || []),
    ...(window.CS2_CASES || []),
  ];
}

let ALL_CASES = buildAllCases();
window.ALL_CASES = ALL_CASES;

function refreshAllCases() {
  ALL_CASES = buildAllCases();
  window.ALL_CASES = ALL_CASES;
}

function loadCs2Data() {
  if (window.CS2_CASES) return Promise.resolve();
  return new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "js/cs2data.js?v=5";
    s.onload = () => { refreshAllCases(); resolve(); };
    s.onerror = () => { console.warn("cs2data.js failed to load"); resolve(); };
    document.body.appendChild(s);
  });
}

/* Applique les vrais prix Steam + les images aux caisses Arena */
if (window.ARENA_STEAM) {
  for (const c of window.CASES || []) {
    for (const it of c.items) {
      const sp = window.ARENA_STEAM[it.weapon + " | " + it.name];
      if (sp) {
        it.price = sp.base;
        it.prices = sp.prices;
        if (sp.stPrices) it.stPrices = sp.stPrices;
      }
    }
    if (!c.image && c.imageOf && window.SKIN_IMAGES && window.SKIN_IMAGES[c.imageOf]) {
      c.image = window.SKIN_IMAGES[c.imageOf];
    }
  }
}

function svgIcon(type, color) {
  return `<svg viewBox="0 0 120 48" fill="${color}" xmlns="http://www.w3.org/2000/svg">${window.WEAPON_ICONS[type] || window.WEAPON_ICONS.rifle}</svg>`;
}

/* Vraie image du skin si dispo, sinon silhouette SVG */
function skinVisual(item, color) {
  const img = item.image || (window.SKIN_IMAGES && window.SKIN_IMAGES[item.weapon + " | " + item.name]);
  if (img) return `<img class="skin-img" src="${img}" alt="" loading="lazy" draggable="false">`;
  return svgIcon(item.type, color);
}

function skinSnapshot(drop) {
  if (!drop) return null;
  return {
    weapon: drop.weapon,
    name: drop.name,
    price: drop.price,
    image: drop.image,
    rarity: drop.rarity,
    type: drop.type,
    stattrak: !!drop.stattrak,
    wearLabel: drop.wearLabel,
  };
}

function skinThumbHTML(item, size = 40) {
  if (!item?.weapon) return "";
  const r = (window.RARITIES && window.RARITIES[item.rarity]) || { color: "#8a91ad" };
  const img = item.image || (window.SKIN_IMAGES && window.SKIN_IMAGES[item.weapon + " | " + item.name]);
  const inner = img
    ? `<img src="${img}" alt="" loading="lazy" draggable="false">`
    : `<span class="skin-thumb-fallback">${skinVisual(item, r.color)}</span>`;
  return `<span class="skin-thumb" style="--thumb:${size}px;--rarity:${r.color}">${inner}</span>`;
}

function skinInlineHTML(item, label) {
  if (!item?.weapon) return `<span class="skin-inline-text">${label || "—"}</span>`;
  const text = label || `${item.weapon} | ${item.name}`;
  return `<span class="skin-inline">${skinThumbHTML(item, 34)}<span class="skin-inline-text">${text}</span></span>`;
}

function skinHighlightHTML(item) {
  if (!item?.weapon) return '<p class="empty-msg small">—</p>';
  const r = (window.RARITIES && window.RARITIES[item.rarity]) || { color: "#8a91ad" };
  return `
    <div class="skin-highlight">
      ${skinThumbHTML(item, 68)}
      <div class="skin-highlight-info">
        <span class="skin-highlight-name">${item.stattrak ? '<span class="stattrak-tag">StatTrak™ </span>' : ""}${item.weapon} | ${item.name}</span>
        ${item.wearLabel ? `<span class="skin-highlight-wear">${item.wearLabel}</span>` : ""}
        <span class="skin-highlight-price" style="color:${r.color}">${fmt(item.price)}</span>
      </div>
    </div>`;
}

function caseVisual(c, soft = "33") {
  if (c.image) return `<img class="case-real-img" src="${c.image}" alt="" loading="lazy" draggable="false">`;
  return `<div class="case-box" style="--case-accent:${c.accent};--case-accent-soft:${c.accent}${soft}"></div>`;
}

function toast(msg, isError = false) {
  document.querySelectorAll(".toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className = "toast" + (isError ? " error" : "");
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

function flashBalance(up) {
  const el = $("#balance");
  el.classList.remove("flash-up", "flash-down");
  void el.offsetWidth;
  el.classList.add(up ? "flash-up" : "flash-down");
}

/* ---------- Sons (WebAudio, aucun fichier requis) ---------- */
let audioCtx = null;
function beep(freq, dur = 0.05, gain = 0.05, type = "square") {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start();
    o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* audio bloqué */ }
}

function winSound(rarity) {
  const notes = rarity === "special" ? [523, 659, 784, 1047] : rarity === "covert" ? [440, 554, 659] : [392, 494];
  notes.forEach((f, i) => setTimeout(() => beep(f, 0.22, 0.07, "triangle"), i * 110));
}

/* =====================================================
   PROBABILITÉS (style Hellcase)
   - Chaque rareté a un pourcentage global (case.odds)
   - À l'intérieur d'une rareté, la proba est répartie
     avec une pondération inverse au prix : les skins
     chers sont plus rares, comme sur les vrais sites.
   ===================================================== */
function computeItemOdds(caseData) {
  const byRarity = {};
  caseData.items.forEach((it) => {
    (byRarity[it.rarity] = byRarity[it.rarity] || []).push(it);
  });

  const odds = new Map();
  for (const [rarity, items] of Object.entries(byRarity)) {
    const rarityPct = caseData.odds[rarity] || 0;
    // Exposant 1.1 : les skins chers sont nettement plus rares dans leur rareté
    const weights = items.map((it) => 1 / Math.pow(it.price, 1.1));
    const total = weights.reduce((a, b) => a + b, 0);
    items.forEach((it, i) => odds.set(it, (rarityPct * weights[i]) / total));
  }
  return odds; // Map<item, pourcentage>
}

function rollItem(caseData) {
  const odds = computeItemOdds(caseData);
  const entries = [...odds.entries()];
  const total = entries.reduce((a, [, p]) => a + p, 0);
  let r = Math.random() * total;
  for (const [item, p] of entries) {
    r -= p;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

function rollWear() {
  let r = Math.random() * 100;
  for (const w of window.WEARS) {
    r -= w.chance;
    if (r <= 0) return w;
  }
  return window.WEARS[window.WEARS.length - 1];
}

/* Prix Steam de l'usure demandée, sinon l'usure la plus proche */
const WEAR_ORDER = ["FN", "MW", "FT", "WW", "BS"];
function wearPrice(map, key) {
  if (!map) return null;
  if (map[key] != null) return map[key];
  const i = WEAR_ORDER.indexOf(key);
  for (let d = 1; d < WEAR_ORDER.length; d++) {
    const before = WEAR_ORDER[i - d], after = WEAR_ORDER[i + d];
    if (before && map[before] != null) return map[before];
    if (after && map[after] != null) return map[after];
  }
  return null;
}

function dropPrice(item, wearKey, wearMult, stattrak) {
  if (stattrak) {
    const st = wearPrice(item.stPrices, wearKey);
    if (st != null) return st;
    const normal = wearPrice(item.prices, wearKey);
    if (normal != null) return +(normal * window.STATTRAK_MULT).toFixed(2);
    return +(item.price * wearMult * window.STATTRAK_MULT).toFixed(2);
  }
  const p = wearPrice(item.prices, wearKey);
  if (p != null) return p;
  return +(item.price * wearMult).toFixed(2);
}

/* Pool du Rare Special Item : tous les objets ★ de la caisse
   + (caché) les 2 drops de base les plus chers de la caisse */
function rareSpecialPool(caseData) {
  const specials = caseData.items.filter((i) => i.rarity === "special");
  if (!specials.length) return null;
  const baseRarest = caseData.items
    .filter((i) => i.rarity !== "special")
    .sort((a, b) => b.price - a.price)
    .slice(0, 2);
  return [...specials, ...baseRarest];
}

function pickWeightedByPrice(items) {
  const weights = items.map((i) => 1 / Math.pow(i.price, 1.1));
  let r = Math.random() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

function rollDrop(caseData) {
  let item = rollItem(caseData);
  let fromRare = false;
  // Le gold déclenche un second tirage dans le pool spécial
  if (item.rarity === "special") {
    const pool = rareSpecialPool(caseData);
    if (pool) item = pickWeightedByPrice(pool);
    fromRare = true;
  }
  // Les stickers n'ont ni usure ni StatTrak
  const isSticker = item.type === "sticker";
  const wear = isSticker ? null : rollWear();
  const stattrak = !isSticker && item.type !== "gloves" && Math.random() * 100 < window.STATTRAK_CHANCE;
  const price = isSticker ? item.price : dropPrice(item, wear.key, wear.mult, stattrak);
  return {
    id: Date.now() + "-" + Math.random().toString(36).slice(2, 8),
    weapon: item.weapon,
    name: item.name,
    rarity: item.rarity,
    type: item.type,
    image: item.image || (window.SKIN_IMAGES ? window.SKIN_IMAGES[item.weapon + " | " + item.name] : undefined),
    wear: wear ? wear.key : null,
    wearLabel: wear ? wear.label : null,
    stattrak,
    price,
    fromRare,
    caseId: caseData.id,
  };
}

/* =====================================================
   RENDU DES CARTES SKIN
   ===================================================== */
function skinCardHTML(drop, opts = {}) {
  const r = window.RARITIES[drop.rarity];
  const bigWin = opts.casePrice && drop.price >= opts.casePrice * 5;
  return `
    <div class="skin-card ${bigWin ? "big-win" : ""}" style="--rarity:${r.color};--rarity-soft:${r.color}22" data-id="${drop.id || ""}">
      ${opts.odds != null ? `<span class="skin-odds">${opts.odds < 0.01 ? "<0.01" : opts.odds.toFixed(2)}%</span>` : ""}
      ${skinVisual(drop, r.color)}
      <span class="skin-weapon">${drop.stattrak ? '<span class="stattrak-tag">StatTrak™ </span>' : ""}${drop.weapon}</span>
      <span class="skin-name">${drop.name}</span>
      ${drop.wearLabel ? `<span class="skin-wear">${drop.wearLabel}</span>` : ""}
      <span class="skin-rarity">${r.label}</span>
      <span class="skin-price">${fmt(drop.price)}</span>
      ${opts.sellBtn ? `<button class="btn-sell-one" data-sell="${drop.id}">SELL ${fmt(drop.price)}</button>` : ""}
    </div>`;
}

/* =====================================================
   NAVIGATION ENTRE LES VUES
   ===================================================== */
function showView(name) {
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  $("#view-" + name).classList.remove("hidden");
  document.querySelectorAll(".nav-btn").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === name)
  );
  if (name === "inventory") renderInventory();
  if (name === "profile") { renderProfileHeader(); renderStats(); }
  if (name === "cases") renderHeroStats();
  if (name === "battles" && typeof renderBattlesHome === "function") renderBattlesHome();
  if (name === "upgrade" && typeof renderUpgrade === "function") renderUpgrade();
  if (name === "leaderboard" && typeof renderLeaderboard === "function") renderLeaderboard();
}

document.querySelectorAll(".nav-btn").forEach((btn) =>
  btn.addEventListener("click", () => showView(btn.dataset.view))
);

$("#logo-btn").addEventListener("click", (e) => { e.preventDefault(); showView("cases"); });
$("#btn-back").addEventListener("click", () => showView("cases"));

/* =====================================================
   HEADER : solde & bonus
   ===================================================== */
function renderBalance() {
  $("#balance").textContent = fmt(state.balance);
  $("#inv-count").textContent = state.inventory.length;
}

function updateBonusButton() {
  const remaining = state.lastBonus + BONUS_COOLDOWN - Date.now();
  const btn = $("#btn-bonus");
  if (remaining > 0) {
    btn.disabled = true;
    btn.textContent = `🎁 ${Math.ceil(remaining / 1000)}s`;
  } else {
    btn.disabled = false;
    btn.textContent = "🎁 Bonus";
  }
}

$("#btn-bonus").addEventListener("click", () => {
  if (state.lastBonus + BONUS_COOLDOWN > Date.now()) return;
  state.lastBonus = Date.now();
  state.balance += BONUS_AMOUNT;
  saveState();
  renderBalance();
  flashBalance(true);
  toast(`+${fmt(BONUS_AMOUNT)} bonus! Come back in 60s.`);
});

setInterval(updateBonusButton, 1000);

/* =====================================================
   VUE : LISTE DES CAISSES
   ===================================================== */
function caseCardHTML(c) {
  const rarities = [...new Set(c.items.map((i) => i.rarity))];
  return `
    <div class="case-card" data-case="${c.id}" style="--case-accent:${c.accent};--case-accent-soft:${c.accent}22">
      <div class="case-img">${caseVisual(c)}</div>
      <div class="case-name">${c.name}</div>
      <div class="case-tagline">${c.tagline}</div>
      <div class="case-rarities">
        ${rarities.slice(0, 6).map((r) => `<span class="rarity-pip" style="background:${window.RARITIES[r].color}"></span>`).join("")}
      </div>
      <div class="case-price">${fmt(c.price)}</div>
    </div>`;
}

function renderCasesGrid() {
  $("#cases-grid").innerHTML = (window.CASES || []).map(caseCardHTML).join("");

  const exclusives = window.EXCLUSIVE_CASES || [];
  const only = exclusives.filter((c) => c.category === "only");
  const knives = exclusives.filter((c) => c.category === "knives");
  const themed = exclusives.filter((c) => c.category === "themed");
  const stickers = exclusives.filter((c) => c.category === "stickers");

  $("#only-grid").innerHTML = only.map(caseCardHTML).join("");
  $("#only-count").textContent = `(${only.length} single-weapon cases)`;
  $("#knives-grid").innerHTML = knives.map(caseCardHTML).join("");
  $("#knives-count").textContent = `(${knives.length} knife cases)`;
  $("#themed-grid").innerHTML = themed.map(caseCardHTML).join("");
  $("#stickers-grid").innerHTML = stickers.map(caseCardHTML).join("");
  $("#stickers-count").textContent = `(${stickers.length} official capsules)`;

  const cs2 = window.CS2_CASES || [];
  $("#cs2-grid").innerHTML = cs2.map(caseCardHTML).join("");
  $("#cs2-count").textContent = `(${cs2.length} official in-game cases)`;

  document.querySelectorAll(".case-card").forEach((card) =>
    card.addEventListener("click", () => openCaseView(card.dataset.case))
  );
}

function renderHeroStats() {
  $("#stat-total-opened").textContent = state.stats.opened;
  $("#stat-profit").textContent = fmt(state.stats.won - state.stats.spent);
  const best = state.stats.bestDrop;
  $("#stat-best-drop").textContent = best ? `${best.weapon} | ${best.name} (${fmt(best.price)})` : "—";
}

/* ---------- Faux drops en direct ---------- */
function pushLiveDrop(drop) {
  const track = $("#live-drops-track");
  const r = window.RARITIES[drop.rarity];
  const el = document.createElement("div");
  el.className = "live-drop-item";
  el.style.borderLeftColor = r.color;
  el.innerHTML = `${skinVisual(drop, r.color)}
    <div><div class="live-drop-name">${drop.weapon} | ${drop.name}</div>
    <div class="live-drop-price">${fmt(drop.price)}</div></div>`;
  track.prepend(el);
  while (track.children.length > 12) track.lastChild.remove();
}

function fakeLiveDrop() {
  const c = ALL_CASES[Math.floor(Math.random() * ALL_CASES.length)];
  pushLiveDrop(rollDrop(c));
}

/* =====================================================
   VUE : DÉTAIL D'UNE CAISSE
   ===================================================== */
function openCaseView(caseId) {
  currentCase = ALL_CASES.find((c) => c.id === caseId);
  $("#case-detail-name").textContent = currentCase.name;
  $("#case-detail-tagline").textContent = currentCase.tagline;
  $("#case-detail-price").textContent = fmt(currentCase.price);
  $("#case-detail-img").innerHTML = caseVisual(currentCase);
  $("#roulette-zone").classList.add("hidden");
  updateOpenButton();
  renderCaseContents();
  showView("case");
  window.scrollTo({ top: 0 });
}

/* Image dorée officielle CS2 du Rare Special Item */
const RARE_ITEM_IMG = "assets/rare-item.png";

/* Libellé de la carte dorée selon le contenu rare de la caisse */
function rareLabel(specials) {
  const types = [...new Set(specials.map((i) => i.type))];
  if (types.length === 1 && types[0] === "gloves") return "Rare Special Gloves";
  const weapons = [...new Set(specials.map((i) => i.weapon))];
  if (weapons.length === 1) return "Rare " + weapons[0];
  if (types.length === 1 && types[0] === "knife") return "Rare Special Knife";
  return "Rare Special Item";
}

function rareCardHTML(specials, totalOdds, expanded) {
  const label = rareLabel(specials);
  const minP = Math.min(...specials.map((i) => i.price));
  const maxP = Math.max(...specials.map((i) => i.price));
  return `
    <div class="skin-card rare-special-card" id="rare-special-card" title="Click to ${expanded ? "hide" : "reveal"} the ${specials.length} possible items">
      <span class="skin-odds">${totalOdds.toFixed(2)}%</span>
      <img class="skin-img rare-item-img" src="${RARE_ITEM_IMG}" alt="Rare Special Item" draggable="false">

      <span class="skin-weapon">★ ${specials.length} possible items</span>
      <span class="skin-name">${label}</span>
      <span class="skin-rarity" style="color:var(--accent-2)">★ Extraordinary</span>
      <span class="skin-price">${fmt(minP)} — ${fmt(maxP)}</span>
      <span class="rare-reveal">${expanded ? "▲ Hide" : "▼ Reveal contents"}</span>
    </div>`;
}

let rareExpanded = false;

function renderCaseContents() {
  rareExpanded = false;
  drawCaseContents();
}

function drawCaseContents() {
  const odds = computeItemOdds(currentCase);
  const sorted = [...currentCase.items].sort((a, b) => b.price - a.price);
  const specials = sorted.filter((i) => i.rarity === "special");
  const normal = sorted.filter((i) => i.rarity !== "special");

  let html = "";
  if (specials.length) {
    const totalOdds = specials.reduce((s, i) => s + odds.get(i), 0);
    html += rareCardHTML(specials, totalOdds, rareExpanded);
    if (rareExpanded) {
      html += specials.map((it) => skinCardHTML(it, { odds: odds.get(it) })).join("");
    }
  }
  html += normal.map((it) => skinCardHTML(it, { odds: odds.get(it) })).join("");
  $("#case-contents").innerHTML = html;

  const rareCard = $("#rare-special-card");
  if (rareCard) {
    rareCard.addEventListener("click", () => {
      rareExpanded = !rareExpanded;
      drawCaseContents();
    });
  }
}

function updateOpenButton() {
  const cost = currentCase.price * openCount;
  const btn = $("#btn-open");
  btn.textContent = openCount > 1 ? `OPEN x${openCount} — ${fmt(cost)}` : `OPEN — ${fmt(cost)}`;
  btn.disabled = isOpening || state.balance < cost;
}

document.querySelectorAll(".multi-btn").forEach((btn) =>
  btn.addEventListener("click", () => {
    if (isOpening) return;
    openCount = +btn.dataset.count;
    document.querySelectorAll(".multi-btn").forEach((b) =>
      b.classList.toggle("active", b === btn)
    );
    updateOpenButton();
  })
);

/* =====================================================
   OUVERTURE : ROULETTE
   ===================================================== */
const REEL_SIZE = 60;
const WIN_INDEX = 52;

function buildReel(winnerDrop) {
  const items = [];
  for (let i = 0; i < REEL_SIZE; i++) {
    items.push(i === WIN_INDEX ? winnerDrop : rollItem(currentCase));
  }
  return items;
}

function reelItemHTML(it, revealSpecial = false) {
  const r = window.RARITIES[it.rarity];
  // Comme dans CS2 : les objets rares apparaissent en carte dorée mystère
  if (!revealSpecial && (it.rarity === "special" || it.fromRare)) {
    return `
      <div class="roulette-item rare-reel-item">
        <img class="skin-img rare-item-img" src="${RARE_ITEM_IMG}" alt="" draggable="false">
        <span class="ri-weapon">★ Exceptionnel</span>
        <span class="ri-name">Rare Special Item</span>
      </div>`;
  }
  return `
    <div class="roulette-item" style="border-top-color:${r.color}">
      ${skinVisual(it, r.color)}
      <span class="ri-weapon">${it.weapon}</span>
      <span class="ri-name">${it.name}</span>
    </div>`;
}

function spendAndRoll() {
  const cost = +(currentCase.price * openCount).toFixed(2);
  if (state.balance < cost) {
    toast("Insufficient balance! Use the 🎁 bonus or sell some skins.", true);
    return null;
  }
  state.balance = +(state.balance - cost).toFixed(2);
  state.stats.spent += cost;
  state.stats.opened += openCount;

  const drops = [];
  for (let i = 0; i < openCount; i++) {
    const d = rollDrop(currentCase);
    drops.push(d);
    if (!state.stats.bestDrop || d.price > state.stats.bestDrop.price) {
      state.stats.bestDrop = skinSnapshot(d);
    }
    if (d.type === "knife") state.stats.knives++;
    if (d.type === "gloves") state.stats.gloves++;
  }
  addXp(openCount * 8 + cost * 1.5);
  saveState();
  renderBalance();
  flashBalance(false);
  return drops;
}

function animateReels(drops, fast) {
  const zone = $("#roulette-zone");
  zone.classList.remove("hidden");
  zone.innerHTML =
    '<div class="roulette-marker"></div>' +
    drops
      .map(
        (d, i) => `
        <div class="roulette-window" ${i > 0 ? 'style="margin-top:8px"' : ""}>
          <div class="roulette-track" id="reel-${i}">
            ${buildReel(d).map((it) => reelItemHTML(it)).join("")}
          </div>
        </div>`
      )
      .join("");

  zone.scrollIntoView({ behavior: "smooth", block: "center" });

  const duration = fast ? 1200 : 6200;
  const itemW = window.innerWidth <= 780 ? 116 : 156; // largeur + gap
  const windowW = zone.querySelector(".roulette-window").clientWidth;

  drops.forEach((_, i) => {
    const track = $("#reel-" + i);
    const jitter = (Math.random() - 0.5) * (itemW * 0.6);
    const target = WIN_INDEX * itemW + itemW / 2 - windowW / 2 + jitter;
    track.style.transition = "none";
    track.style.transform = "translateX(0)";
    void track.offsetWidth;
    track.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.06, 1)`;
    track.style.transform = `translateX(${-target}px)`;
  });

  // Tic-tics pendant le spin
  if (!fast) {
    let t = 0;
    const ticks = [];
    while (t < duration - 400) {
      const progress = t / duration;
      ticks.push(t);
      t += 40 + 360 * Math.pow(progress, 2.4);
    }
    ticks.forEach((delay) => setTimeout(() => beep(900, 0.03, 0.025), delay));
  }

  return new Promise((resolve) => setTimeout(resolve, duration + 350));
}

/* Second rouleau doré : révèle le contenu du Rare Special Item */
async function animateRareReel(drop, fast) {
  const pool = rareSpecialPool(currentCase);
  if (!pool) return;

  const zone = $("#roulette-zone");
  zone.classList.remove("hidden");
  const items = [];
  for (let i = 0; i < REEL_SIZE; i++) {
    items.push(i === WIN_INDEX ? drop : pool[Math.floor(Math.random() * pool.length)]);
  }
  zone.innerHTML = `
    <div class="rare-reel-title">★ RARE SPECIAL ITEM ★</div>
    <div class="rare-reel-wrap">
      <div class="roulette-marker gold"></div>
      <div class="roulette-window rare">
        <div class="roulette-track" id="rare-reel-track">
          ${items.map((it) => reelItemHTML(it, true)).join("")}
        </div>
      </div>
    </div>`;
  zone.scrollIntoView({ behavior: "smooth", block: "center" });

  winSound("classified");
  const duration = fast ? 1400 : 5000;
  const itemW = window.innerWidth <= 780 ? 116 : 156;
  const windowW = zone.querySelector(".roulette-window").clientWidth;
  const track = $("#rare-reel-track");
  const jitter = (Math.random() - 0.5) * itemW * 0.6;
  const target = WIN_INDEX * itemW + itemW / 2 - windowW / 2 + jitter;
  track.style.transition = "none";
  track.style.transform = "translateX(0)";
  void track.offsetWidth;
  track.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.06, 1)`;
  track.style.transform = `translateX(${-target}px)`;

  if (!fast) {
    let t = 0;
    const ticks = [];
    while (t < duration - 400) {
      ticks.push(t);
      t += 40 + 360 * Math.pow(t / duration, 2.4);
    }
    ticks.forEach((delay) => setTimeout(() => beep(1150, 0.03, 0.03), delay));
  }

  return new Promise((resolve) => setTimeout(resolve, duration + 400));
}

async function openCase() {
  if (isOpening) return;
  const drops = spendAndRoll();
  if (!drops) return;

  isOpening = true;
  lastResults = drops;
  resultsHandled = false;
  updateOpenButton();

  const fast = $("#fast-mode").checked;
  await animateReels(drops, fast);

  // Gold obtenu → second rouleau doré pour révéler l'objet
  for (const d of drops) {
    if (d.fromRare) await animateRareReel(d, fast);
  }

  isOpening = false;
  updateOpenButton();
  showResults(drops);
}

$("#btn-open").addEventListener("click", openCase);

/* =====================================================
   MODAL RÉSULTAT
   ===================================================== */
function showResults(drops) {
  const best = drops.reduce((a, b) => (b.price > a.price ? b : a));
  winSound(best.rarity);

  const total = drops.reduce((s, d) => s + d.price, 0);
  const titles = {
    special: "★ LEGENDARY DROP ★",
    covert: "INSANE DROP!",
    classified: "NICE DROP!",
  };
  $("#result-title").textContent = titles[best.rarity] || "CONGRATULATIONS!";
  $("#result-items").innerHTML = drops
    .map((d) => skinCardHTML(d, { casePrice: currentCase.price }))
    .join("");
  $("#btn-sell-result").textContent = `SELL ${drops.length > 1 ? "ALL " : ""}(${fmt(total)})`;
  $("#btn-open-again").disabled = state.balance < currentCase.price * openCount;
  $("#result-modal").classList.remove("hidden");

  drops.forEach(pushLiveDrop);
}

function keepResults() {
  if (resultsHandled) return;
  resultsHandled = true;
  state.inventory.push(...lastResults);
  state.stats.won += lastResults.reduce((s, d) => s + d.price, 0);
  saveState();
  renderBalance();
  toast(`${lastResults.length} skin(s) added to your inventory!`);
}

$("#btn-keep-result").addEventListener("click", () => {
  keepResults();
  $("#result-modal").classList.add("hidden");
});

$("#btn-sell-result").addEventListener("click", () => {
  if (!resultsHandled) {
    resultsHandled = true;
    const total = +lastResults.reduce((s, d) => s + d.price, 0).toFixed(2);
    state.balance = +(state.balance + total).toFixed(2);
    state.stats.won += total;
    saveState();
    renderBalance();
    flashBalance(true);
    toast(`Sold for ${fmt(total)}!`);
  }
  $("#result-modal").classList.add("hidden");
  updateOpenButton();
});

$("#btn-open-again").addEventListener("click", () => {
  keepResults();
  $("#result-modal").classList.add("hidden");
  openCase();
});

$("#result-modal").addEventListener("click", (e) => {
  if (e.target === $("#result-modal")) {
    keepResults();
    $("#result-modal").classList.add("hidden");
  }
});

/* =====================================================
   VUE : INVENTAIRE
   ===================================================== */
function renderInventory() {
  const grid = $("#inventory-grid");
  const sorted = [...state.inventory].sort((a, b) => b.price - a.price);
  grid.innerHTML = sorted.map((d) => skinCardHTML(d, { sellBtn: true })).join("");
  const total = state.inventory.reduce((s, d) => s + d.price, 0);
  $("#inv-total").textContent = "Value: " + fmt(total);
  $("#inv-empty").classList.toggle("hidden", state.inventory.length > 0);
  $("#btn-sell-all").style.display = state.inventory.length ? "" : "none";

  grid.querySelectorAll("[data-sell]").forEach((btn) =>
    btn.addEventListener("click", () => sellItem(btn.dataset.sell))
  );
}

function sellItem(id) {
  const idx = state.inventory.findIndex((d) => d.id === id);
  if (idx === -1) return;
  const [item] = state.inventory.splice(idx, 1);
  state.balance = +(state.balance + item.price).toFixed(2);
  saveState();
  renderBalance();
  flashBalance(true);
  toast(`${item.weapon} | ${item.name} sold for ${fmt(item.price)}!`);
  renderInventory();
}

$("#btn-sell-all").addEventListener("click", () => {
  if (!state.inventory.length) return;
  const total = +state.inventory.reduce((s, d) => s + d.price, 0).toFixed(2);
  if (!confirm(`Sell ${state.inventory.length} skin(s) for ${fmt(total)}?`)) return;
  state.inventory = [];
  state.balance = +(state.balance + total).toFixed(2);
  saveState();
  renderBalance();
  flashBalance(true);
  toast(`Inventory sold for ${fmt(total)}!`);
  renderInventory();
});

/* =====================================================
   VUE : STATISTIQUES
   ===================================================== */
function renderStats() {
  const s = state.stats;
  const profit = s.won - s.spent;
  const bestSkin = state.inventory.reduce((a, b) => (!a || b.price > a.price ? b : a), null);
  const cards = [
    { v: s.opened, l: "Cases opened" },
    { v: fmt(s.spent), l: "Total spent" },
    { v: fmt(s.won), l: "Total value won" },
    { v: (profit >= 0 ? "+" : "") + fmt(profit).replace("$-", "-$"), l: "Net profit", c: profit >= 0 ? "var(--green)" : "var(--red)" },
    { v: s.knives, l: "🔪 Knives dropped" },
    { v: s.gloves, l: "🧤 Gloves dropped" },
    { v: s.bestDrop ? skinInlineHTML(s.bestDrop) : "—", l: s.bestDrop ? `Best drop (${fmt(s.bestDrop.price)})` : "Best drop", html: true },
    { v: bestSkin ? skinInlineHTML(bestSkin) : "—", l: bestSkin ? `Best skin (${fmt(bestSkin.price)})` : "Best skin", html: true },
    { v: state.inventory.length, l: "Skins in inventory" },
    { v: `${s.battlesWon || 0}/${s.battles || 0}`, l: "⚔️ Battles won" },
    { v: `${s.upgradesWon || 0}/${s.upgrades || 0}`, l: "⬆ Upgrades won" },
  ];
  $("#stats-grid").innerHTML = cards
    .map(
      (c) => `
      <div class="stat-card">
        <div class="stat-value${c.html ? " stat-value-skin" : ""}" ${c.c ? `style="color:${c.c}"` : ""}>${c.v}</div>
        <div class="stat-label">${c.l}</div>
      </div>`
    )
    .join("");
}

$("#btn-reset").addEventListener("click", async () => {
  if (!confirm("Reset your account? Balance set to $10, inventory and stats cleared.")) return;
  state = defaultState();
  saveState();
  if (useCloud() && isLoggedIn()) await dbFlushSave();
  renderBalance();
  renderStats();
  renderHeroStats();
  toast("Account reset — good luck!");
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden" && useCloud() && isLoggedIn()) {
    dbFlushSave();
  }
});

/* =====================================================
   INIT
   ===================================================== */
async function boot() {
  try {
    state = defaultState();
    renderBalance();
    renderCasesGrid();
    renderHeroStats();
    updateBonusButton();
    renderUserChip();
    initAuthModal();
  } catch (e) {
    console.error("UI boot failed:", e);
  }

  try {
    for (let i = 0; i < 8; i++) fakeLiveDrop();
    setInterval(fakeLiveDrop, 3500);
  } catch (e) {
    console.warn("Live drops init failed:", e);
  }

  try {
    await initAuth();
    state = await loadState();
    renderBalance();
    renderCasesGrid();
    renderHeroStats();
    renderUserChip();
  } catch (e) {
    console.error("Auth/load failed:", e);
  }

  try {
    await loadCs2Data();
    renderCasesGrid();
    refreshAllCases();
  } catch (e) {
    console.error("cs2data load failed:", e);
  }
}

boot();
