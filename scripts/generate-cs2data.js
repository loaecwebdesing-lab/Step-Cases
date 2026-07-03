/* =====================================================
   Générateur de js/cs2data.js
   Sources :
   - tmp-api/crates.json + skins.json  (ByMykel/CSGO-API)
   - tmp-api/steamprices.json          (ByMykel/counter-strike-price-tracker,
                                        prix Steam Market USD en cents)
   - tmp-api/csfloat.json              (CSFloat price-list, fallback)
   Produit :
   - CS2_CASES      : 42 caisses officielles, prix Steam réels par usure
   - SKIN_IMAGES    : images des skins des caisses Arena
   - ARENA_STEAM    : prix Steam des skins des caisses Arena
   Usage : node scripts/generate-cs2data.js
   ===================================================== */

const fs = require("fs");
const path = require("path");

const crates = require(path.join(__dirname, "..", "tmp-api", "crates.json"));
const skins = require(path.join(__dirname, "..", "tmp-api", "skins.json"));
const steamData = require(path.join(__dirname, "..", "tmp-api", "steamprices.json"));

let csfloat = {};
try {
  const arr = require(path.join(__dirname, "..", "tmp-api", "csfloat.json"));
  for (const it of arr) csfloat[it.market_hash_name] = it.min_price; // cents
} catch (e) { /* fallback indisponible */ }

const steam = steamData.prices; // { market_hash_name: cents }
console.log(`Prix Steam chargés : ${Object.keys(steam).length} (maj ${steamData.metadata.updated_at.slice(0, 10)})`);
console.log(`Prix CSFloat (fallback) : ${Object.keys(csfloat).length}`);

const KEY_PRICE = 2.49; // clé CS2 officielle

function marketPrice(name) {
  const cents = steam[name] != null ? steam[name] : csfloat[name];
  return cents != null ? +(cents / 100).toFixed(2) : null;
}

/* ---------- Mapping des raretés API -> site ---------- */
const RARITY_MAP = {
  rarity_common_weapon: "milspec",
  rarity_uncommon_weapon: "milspec",
  rarity_rare_weapon: "milspec",
  rarity_mythical_weapon: "restricted",
  rarity_legendary_weapon: "classified",
  rarity_ancient_weapon: "covert",
};

/* Pour le pool global (collections incluses), on garde les vraies raretés basses */
const RARITY_MAP_FULL = {
  rarity_common_weapon: "consumer",
  rarity_uncommon_weapon: "industrial",
  rarity_rare_weapon: "milspec",
  rarity_mythical_weapon: "restricted",
  rarity_legendary_weapon: "classified",
  rarity_ancient_weapon: "covert",
};

const WEAR_NAMES = {
  FN: "Factory New",
  MW: "Minimal Wear",
  FT: "Field-Tested",
  WW: "Well-Worn",
  BS: "Battle-Scarred",
};

/* Multiplicateurs pour les phases Doppler sans listing Steam séparé */
const PHASE_MULT = {
  "Phase 1": 0.95, "Phase 2": 1.0, "Phase 3": 1.05, "Phase 4": 1.1,
  Ruby: 2.8, Sapphire: 3.2, "Black Pearl": 1.9, Emerald: 3.5,
};

/* ---------- Fallback heuristique si aucun prix Steam ---------- */
function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

const PRICE_RANGES = {
  milspec: [0.2, 4],
  restricted: [1.5, 12],
  classified: [6, 45],
  covert: [20, 250],
  special: [120, 1600],
};

function fallbackPrice(fullName, rarity) {
  const [min, max] = PRICE_RANGES[rarity];
  return +(min + Math.pow(hash(fullName), 1.8) * (max - min)).toFixed(2);
}

/* ---------- Prix Steam par usure (phase Doppler = prix de base × multiplicateur) ---------- */
function buildPrices(weapon, skinName, isStar, phase) {
  const star = isStar ? "★ " : "";
  const isVanilla = skinName === "Vanilla";
  const prices = {};
  const stPrices = {};
  const mult = phase ? (PHASE_MULT[phase] || 1) : 1;
  const lookupName = phase ? skinName.replace(/ \([^)]+\)$/, "") : skinName;

  if (isVanilla) {
    const p = marketPrice(`★ ${weapon}`);
    const st = marketPrice(`★ StatTrak™ ${weapon}`);
    if (p != null) prices.FT = +(p * mult).toFixed(2);
    if (st != null) stPrices.FT = +(st * mult).toFixed(2);
  } else {
    for (const [key, label] of Object.entries(WEAR_NAMES)) {
      const p = marketPrice(`${star}${weapon} | ${lookupName} (${label})`);
      if (p != null) prices[key] = +(p * mult).toFixed(2);
      const stName = isStar
        ? `★ StatTrak™ ${weapon} | ${lookupName} (${label})`
        : `StatTrak™ ${weapon} | ${lookupName} (${label})`;
      const st = marketPrice(stName);
      if (st != null) stPrices[key] = +(st * mult).toFixed(2);
    }
  }
  return { prices, stPrices };
}

/* ---------- Type d'arme ---------- */
function weaponType(weapon) {
  if (/Gloves|Hand Wraps/i.test(weapon)) return "gloves";
  if (/^★/.test(weapon) || /Knife|Bayonet|Karambit|Daggers/i.test(weapon)) return "knife";
  if (/AWP|SSG 08|G3SG1|SCAR-20/i.test(weapon)) return "sniper";
  if (/AK-47|M4A4|M4A1-S|FAMAS|Galil|SG 553|AUG/i.test(weapon)) return "rifle";
  if (/MP9|MP7|MP5|MAC-10|UMP|P90|PP-Bizon/i.test(weapon)) return "smg";
  if (/Nova|XM1014|MAG-7|Sawed-Off/i.test(weapon)) return "shotgun";
  if (/Negev|M249/i.test(weapon)) return "mg";
  return "pistol";
}

function parseItem(apiItem) {
  const full = apiItem.name.replace(/^★ /, "");
  const isVanilla = !full.includes(" | ");
  const weapon = isVanilla ? full : full.split(" | ")[0];
  const name = isVanilla ? "Vanilla" : full.split(" | ").slice(1).join(" | ");
  return { weapon, name, image: apiItem.image };
}

function buildItem(apiItem, rarity) {
  const { weapon, name, image } = parseItem(apiItem);
  const isStar = rarity === "special";
  const { prices, stPrices } = buildPrices(weapon, name, isStar);
  const available = Object.values(prices);
  const base = available.length ? Math.min(...available) : fallbackPrice(apiItem.name, rarity);
  const item = {
    weapon, name, rarity, image,
    type: weaponType(apiItem.name),
    price: base,
  };
  if (available.length) item.prices = prices;
  if (Object.keys(stPrices).length) item.stPrices = stPrices;
  return item;
}

/* ---------- Probabilités standard (style Hellcase) ---------- */
const STD_ODDS = { milspec: 79.92, restricted: 15.98, classified: 3.2, covert: 0.64, special: 0.26 };

const ACCENTS = ["#4b69ff", "#8847ff", "#d32ce6", "#eb4b4b", "#ff6b35", "#ffd700", "#2ecc71", "#00c3ff"];

/* ---------- Construction des caisses officielles ---------- */
const cases = crates
  .filter((c) => c.type === "Case")
  .sort((a, b) => (b.first_sale_date || "").localeCompare(a.first_sale_date || ""));

let steamPricedItems = 0, fallbackItems = 0, steamPricedCases = 0;

const CS2_CASES = cases.map((c, idx) => {
  const items = [];

  for (const it of c.contains || []) {
    const item = buildItem(it, RARITY_MAP[it.rarity.id] || "milspec");
    item.prices ? steamPricedItems++ : fallbackItems++;
    items.push(item);
  }
  for (const it of c.contains_rare || []) {
    const item = buildItem(it, "special");
    item.prices ? steamPricedItems++ : fallbackItems++;
    items.push(item);
  }

  const present = [...new Set(items.map((i) => i.rarity))];
  const totalW = present.reduce((s, r) => s + STD_ODDS[r], 0);
  const odds = {};
  present.forEach((r) => (odds[r] = +((STD_ODDS[r] / totalW) * 100).toFixed(3)));

  const casePrice = marketPrice(c.market_hash_name || c.name);
  if (casePrice != null) steamPricedCases++;
  const price = casePrice != null ? +(casePrice + KEY_PRICE).toFixed(2) : 2.99;

  const year = (c.first_sale_date || "").slice(0, 4);
  return {
    id: c.id,
    name: c.name,
    price,
    accent: ACCENTS[idx % ACCENTS.length],
    tagline: year ? `Official case · ${year}` : "Official CS2 case",
    image: c.image,
    steamPrice: casePrice,
    odds,
    items,
  };
});

/* ---------- Images + prix Steam pour les caisses Arena ---------- */
const dataJs = fs.readFileSync(path.join(__dirname, "..", "js", "data.js"), "utf8");
const needed = [...dataJs.matchAll(/s\("([^"]+)",\s*"([^"]+)",\s*"([^"]+)"/g)].map((m) => [m[1], m[2], m[3]]);

const skinByName = new Map();
for (const sk of skins) skinByName.set(sk.name, sk.image);

const SKIN_IMAGES = {};
const ARENA_STEAM = {};
let missing = [];
for (const [weapon, name, rarity] of needed) {
  const key = `${weapon} | ${name}`;
  const img = skinByName.get(key) || skinByName.get(`★ ${key}`);
  if (img) SKIN_IMAGES[key] = img;
  else missing.push(key);

  const isStar = rarity === "special";
  const { prices, stPrices } = buildPrices(weapon, name, isStar);
  const available = Object.values(prices);
  if (available.length) {
    ARENA_STEAM[key] = { base: Math.min(...available), prices };
    if (Object.keys(stPrices).length) ARENA_STEAM[key].stPrices = stPrices;
  }
}

/* ---------- Pool global : TOUS les skins du jeu (collections incluses) ---------- */
const ALL_SKINS = [];
const seenSkins = new Set();
let skippedNoPrice = 0;

for (const sk of skins) {
  if (!sk.name || !sk.id || seenSkins.has(sk.id) || !sk.image) continue;
  seenSkins.add(sk.id);

  const isStar = sk.name.startsWith("★");
  const full = sk.name.replace(/^★ /, "");
  const isVanilla = !full.includes(" | ");
  const weapon = isVanilla ? full : full.split(" | ")[0];
  const baseName = isVanilla ? "Vanilla" : full.split(" | ").slice(1).join(" | ");
  const phase = sk.phase || null;
  const name = phase ? `${baseName} (${phase})` : baseName;

  const rarity = isStar ? "special" : (RARITY_MAP_FULL[(sk.rarity && sk.rarity.id) || ""] || "milspec");
  const { prices, stPrices } = buildPrices(weapon, name, isStar, phase);
  const available = Object.values(prices);
  if (!available.length) { skippedNoPrice++; continue; } // uniquement des prix Steam réels

  const item = {
    weapon, name, rarity,
    image: sk.image,
    type: weaponType(sk.name),
    price: Math.min(...available),
    prices,
  };
  if (Object.keys(stPrices).length) item.stPrices = stPrices;
  ALL_SKINS.push(item);
}
ALL_SKINS.sort((a, b) => a.price - b.price);

/* =====================================================
   CAISSES EXCLUSIVES GÉNÉRÉES (Only / Thématiques / Stickers)
   ===================================================== */

/* Probabilités durcies pour les caisses générées */
const GEN_ODDS = { consumer: 44, industrial: 29, milspec: 21, restricted: 5.5, classified: 1.35, covert: 0.28, special: 0.05 };

/* Économie du site : ROI joueur cible ~95 % (marge maison ~5 %) */
const TARGET_ROI = 0.95;
const PRICE_MARGIN = 1.05; // marge maison : garantit un ROI joueur ≤ ~95 % en pratique
const SIM_ROLLS = 18000;
const ONLY_PREMIUM_FLOOR = { "AK-47": 7.99, "AWP": 7.99, "M4A4": 7.99, "M4A1-S": 7.99 };

/* Simulation fidèle à js/app.js (usure, StatTrak, rouleau doré) */
const SIM_WEARS = [
  { key: "FN", chance: 3, mult: 1.0 },
  { key: "MW", chance: 12, mult: 0.85 },
  { key: "FT", chance: 38, mult: 0.7 },
  { key: "WW", chance: 22, mult: 0.55 },
  { key: "BS", chance: 25, mult: 0.45 },
];
const SIM_ST_CHANCE = 7;
const SIM_ST_MULT = 1.8;
const SIM_WEAR_ORDER = ["FN", "MW", "FT", "WW", "BS"];
const PRICE_WEIGHT_EXP = 1.1;

function simWearPrice(map, key) {
  if (!map) return null;
  if (map[key] != null) return map[key];
  const i = SIM_WEAR_ORDER.indexOf(key);
  for (let d = 1; d < SIM_WEAR_ORDER.length; d++) {
    const before = SIM_WEAR_ORDER[i - d], after = SIM_WEAR_ORDER[i + d];
    if (before && map[before] != null) return map[before];
    if (after && map[after] != null) return map[after];
  }
  return null;
}

function simDropPrice(item, wearKey, wearMult, stattrak) {
  if (stattrak) {
    const st = simWearPrice(item.stPrices, wearKey);
    if (st != null) return st;
    const normal = simWearPrice(item.prices, wearKey);
    if (normal != null) return +(normal * SIM_ST_MULT).toFixed(2);
    return +(item.price * wearMult * SIM_ST_MULT).toFixed(2);
  }
  const p = simWearPrice(item.prices, wearKey);
  if (p != null) return p;
  return +(item.price * wearMult).toFixed(2);
}

function simItemOdds(caseData) {
  const byRarity = {};
  caseData.items.forEach((it) => (byRarity[it.rarity] = byRarity[it.rarity] || []).push(it));
  const odds = new Map();
  for (const [rarity, items] of Object.entries(byRarity)) {
    const rarityPct = caseData.odds[rarity] || 0;
    const weights = items.map((it) => 1 / Math.pow(it.price, PRICE_WEIGHT_EXP));
    const total = weights.reduce((a, b) => a + b, 0);
    items.forEach((it, i) => odds.set(it, (rarityPct * weights[i]) / total));
  }
  return odds;
}

function simRollItem(caseData) {
  const odds = simItemOdds(caseData);
  const entries = [...odds.entries()];
  const total = entries.reduce((a, [, p]) => a + p, 0);
  let r = Math.random() * total;
  for (const [item, p] of entries) {
    r -= p;
    if (r <= 0) return item;
  }
  return entries[entries.length - 1][0];
}

function simRollWear() {
  let r = Math.random() * 100;
  for (const w of SIM_WEARS) {
    r -= w.chance;
    if (r <= 0) return w;
  }
  return SIM_WEARS[SIM_WEARS.length - 1];
}

function simRarePool(caseData) {
  const specials = caseData.items.filter((i) => i.rarity === "special");
  if (!specials.length) return null;
  const baseRarest = caseData.items
    .filter((i) => i.rarity !== "special")
    .sort((a, b) => b.price - a.price)
    .slice(0, 2);
  return [...specials, ...baseRarest];
}

function simRollDrop(caseData) {
  let item = simRollItem(caseData);
  if (item.rarity === "special") {
    const pool = simRarePool(caseData);
    if (pool) {
      const weights = pool.map((i) => 1 / Math.pow(i.price, PRICE_WEIGHT_EXP));
      let r = Math.random() * weights.reduce((a, b) => a + b, 0);
      for (let i = 0; i < pool.length; i++) {
        r -= weights[i];
        if (r <= 0) { item = pool[i]; break; }
      }
    }
  }
  const isSticker = item.type === "sticker";
  const wear = isSticker ? null : simRollWear();
  const stattrak = !isSticker && item.type !== "gloves" && Math.random() * 100 < SIM_ST_CHANCE;
  return isSticker ? item.price : simDropPrice(item, wear.key, wear.mult, stattrak);
}

function simCaseEV(caseData, rolls = SIM_ROLLS) {
  let sum = 0;
  for (let i = 0; i < rolls; i++) sum += simRollDrop(caseData);
  return sum / rolls;
}

function casePriceFromEV(caseData, opts = {}) {
  const ev = simCaseEV(caseData);
  let price = +((ev / TARGET_ROI) * PRICE_MARGIN).toFixed(2);
  if (opts.priceFloor) price = Math.max(price, opts.priceFloor);
  if (opts.priceCeil) price = Math.min(price, opts.priceCeil);
  return Math.max(0.49, price);
}

function normalizeOdds(present) {
  const totalW = present.reduce((s, r) => s + GEN_ODDS[r], 0);
  const odds = {};
  present.forEach((r) => (odds[r] = +((GEN_ODDS[r] / totalW) * 100).toFixed(3)));
  return odds;
}

/* Prend n éléments répartis sur toute la gamme de prix */
function spread(arr, n) {
  if (arr.length <= n) return [...arr];
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
  }
  return [...new Set(out)];
}

const GEN_ACCENTS = ["#ff6b35", "#4b69ff", "#8847ff", "#d32ce6", "#eb4b4b", "#2ecc71", "#00c3ff", "#ffd700", "#ff4f9a", "#9dff00"];
let genIdx = 0;

function nameMatches(itemName, specName) {
  if (!specName) return true;
  if (specName instanceof RegExp) return specName.test(itemName);
  return itemName === specName || itemName.startsWith(specName + " (");
}

function pickCover(items, spec, fallbackPool) {
  if (!spec) return null;
  for (const pool of [items, fallbackPool].filter((p) => p?.length)) {
    const hit = pool.find(
      (i) =>
        (!spec.weapon || i.weapon === spec.weapon) &&
        nameMatches(i.name, spec.name)
    );
    if (hit) return hit.image;
  }
  return null;
}

function buildGeneratedCase(id, name, tagline, category, items, opts = {}) {
  if (!items.length) return null;
  const present = [...new Set(items.map((i) => i.rarity))];
  const odds = normalizeOdds(present);
  const draft = { items, odds };
  const price = casePriceFromEV(draft, opts);
  const iconic = [...items].sort((a, b) => b.price - a.price)[0];
  const image = opts.image || pickCover(items, opts.cover, opts.coverPool) || iconic.image;
  return {
    id,
    name,
    price,
    accent: GEN_ACCENTS[genIdx++ % GEN_ACCENTS.length],
    tagline,
    category,
    image,
    odds,
    items,
  };
}

/* Sélection standard d'items par rareté (répartis par prix) */
const RARITY_PICKS = { consumer: 3, industrial: 3, milspec: 4, restricted: 4, classified: 3, covert: 3, special: 2 };

function pickItems(pool, picks = RARITY_PICKS) {
  const byR = {};
  pool.forEach((i) => (byR[i.rarity] = byR[i.rarity] || []).push(i));
  const items = [];
  for (const [r, list] of Object.entries(byR)) {
    if (!picks[r]) continue;
    list.sort((a, b) => a.price - b.price);
    items.push(...spread(list, picks[r]));
  }
  return items;
}

const EXCLUSIVE_CASES = [];

/* ---------- Catégorie ONLY : une arme, toutes les gammes ---------- */
const ONLY_WEAPONS = ["AK-47", "AWP", "M4A4", "M4A1-S", "USP-S", "Glock-18", "Desert Eagle", "P250", "Five-SeveN", "P90", "MP9", "Tec-9"];
for (const weapon of ONLY_WEAPONS) {
  const pool = ALL_SKINS.filter((i) => i.weapon === weapon);
  const c = buildGeneratedCase(
    "only-" + weapon.toLowerCase().replace(/[^a-z0-9]/g, ""),
    weapon + " Only",
    `100% ${weapon} — every skin in the game`,
    "only",
    [...pool].sort((a, b) => a.price - b.price),
    { priceFloor: ONLY_PREMIUM_FLOOR[weapon] || 0 }
  );
  if (c) EXCLUSIVE_CASES.push(c);
}

/* ---------- Catégorie KNIVES : caisses couteaux thématiques ---------- */
const KNIFE_CASES = [
  { id: "knife-standard", name: "Knife Case", tagline: "Every knife in the game", filter: (i) => i.type === "knife", cover: { weapon: "Karambit", name: "Fade" } },
  { id: "knife-doppler", name: "Doppler Case", tagline: "Phase 1-4, Sapphire, Ruby, Black Pearl…", filter: (i) => i.type === "knife" && /Doppler/i.test(i.name) && !/Gamma/i.test(i.name), cover: { weapon: "Karambit", name: "Doppler (Phase 2)" } },
  { id: "knife-lore", name: "Lore Case", tagline: "Every Lore skin in the game", filter: (i) => i.type === "knife" && /Lore/i.test(i.name), cover: { weapon: "Karambit", name: "Lore" } },
  { id: "knife-butterfly", name: "Butterfly Case", tagline: "100% Butterfly Knife", filter: (i) => i.weapon === "Butterfly Knife", cover: { weapon: "Butterfly Knife", name: "Fade" } },
  { id: "knife-fade", name: "Fade Case", tagline: "Every Fade skin in the game", filter: (i) => i.type === "knife" && /Fade/i.test(i.name) && !/Marble/i.test(i.name), cover: { weapon: "M9 Bayonet", name: "Fade" } },
  { id: "knife-gamma-doppler", name: "Gamma Doppler Case", tagline: "Emerald, Phase 1-4, Gamma…", filter: (i) => i.type === "knife" && /Gamma Doppler/i.test(i.name), cover: { weapon: "Karambit", name: "Gamma Doppler (Phase 3)" } },
  { id: "knife-marble-fade", name: "Marble Fade Case", tagline: "Every Marble Fade in the game", filter: (i) => i.type === "knife" && /Marble Fade/i.test(i.name), cover: { weapon: "Karambit", name: "Marble Fade" } },
];
for (const k of KNIFE_CASES) {
  const pool = ALL_SKINS.filter(k.filter);
  const c = buildGeneratedCase(k.id, k.name, k.tagline, "knives", [...pool].sort((a, b) => a.price - b.price), { cover: k.cover });
  if (c) EXCLUSIVE_CASES.push(c);
}

/* ---------- Catégorie THÉMATIQUE : par type d'arme ---------- */
const THEMED = [
  { id: "themed-pistols", name: "Pistol Paradise", tagline: "Every pistol in the game", types: ["pistol"] },
  { id: "themed-smg", name: "SMG Rush", tagline: "SMGs galore", types: ["smg"] },
  { id: "themed-snipers", name: "Sniper Elite", tagline: "AWP, SSG 08, SCAR-20, G3SG1…", types: ["sniper"] },
  { id: "themed-heavy", name: "Heavy Firepower", tagline: "Shotguns & machine guns", types: ["shotgun", "mg"] },
  { id: "themed-knives", name: "Knife Frenzy", tagline: "100% knives — gold guaranteed", types: ["knife"], cover: { weapon: "M9 Bayonet", name: "Tiger Tooth" } },
  { id: "themed-gloves", name: "Glove Gallery", tagline: "100% gloves — gold guaranteed", types: ["gloves"] },
];
for (const t of THEMED) {
  const pool = ALL_SKINS.filter((i) => t.types.includes(i.type));
  const isGold = t.types.includes("knife") || t.types.includes("gloves");
  const items = isGold
    ? spread(pool.sort((a, b) => a.price - b.price), 14)
    : pickItems(pool);
  const c = buildGeneratedCase(t.id, t.name, t.tagline, "themed", items, { cover: t.cover, coverPool: pool });
  if (c) EXCLUSIVE_CASES.push(c);
}

/* ---------- Catégorie STICKERS : vraies capsules officielles ---------- */
const STICKER_RARITY_MAP = {
  rarity_rare: "milspec",
  rarity_mythical: "restricted",
  rarity_legendary: "classified",
  rarity_ancient: "covert",
};

const capsules = crates
  .filter((c) => c.type === "Sticker Capsule" && c.image)
  .map((c) => {
    const priced = (c.contains || []).filter((i) => marketPrice("Sticker | " + i.name) != null);
    return { crate: c, priced };
  })
  .filter((x) => x.priced.length >= 10 && x.priced.length / x.crate.contains.length > 0.9)
  .sort((a, b) => ((b.crate.first_sale_date || "")).localeCompare(a.crate.first_sale_date || ""))
  .slice(0, 10);

for (const { crate, priced } of capsules) {
  const items = priced.map((i) => ({
    weapon: "Sticker",
    name: i.name,
    rarity: STICKER_RARITY_MAP[i.rarity.id] || "milspec",
    image: i.image,
    type: "sticker",
    price: +(marketPrice("Sticker | " + i.name)).toFixed(2),
  }));
  const present = [...new Set(items.map((i) => i.rarity))];
  const odds = normalizeOdds(present);
  const price = casePriceFromEV({ items, odds });
  EXCLUSIVE_CASES.push({
    id: crate.id,
    name: crate.name,
    price,
    accent: GEN_ACCENTS[genIdx++ % GEN_ACCENTS.length],
    tagline: "Official sticker capsule",
    category: "stickers",
    image: crate.image,
    odds,
    items,
  });
}

/* ---------- Rééquilibrage prix CS2 officielles (ROI ~95 %) ---------- */
for (const c of CS2_CASES) {
  c.price = casePriceFromEV(c);
}

/* ---------- Écriture ---------- */
const out =
  "/* Généré par scripts/generate-cs2data.js — ne pas éditer à la main.\n" +
  "   Données : ByMykel/CSGO-API + counter-strike-price-tracker (Steam Market USD).\n" +
  `   Prix mis à jour : ${steamData.metadata.updated_at.slice(0, 10)} — images © Valve Corporation. */\n\n` +
  "const PRICES_UPDATED = " + JSON.stringify(steamData.metadata.updated_at.slice(0, 10)) + ";\n\n" +
  "const CS2_CASES = " + JSON.stringify(CS2_CASES) + ";\n\n" +
  "const SKIN_IMAGES = " + JSON.stringify(SKIN_IMAGES) + ";\n\n" +
  "const ARENA_STEAM = " + JSON.stringify(ARENA_STEAM) + ";\n\n" +
  "const ALL_SKINS = " + JSON.stringify(ALL_SKINS) + ";\n\n" +
  "const EXCLUSIVE_CASES = " + JSON.stringify(EXCLUSIVE_CASES) + ";\n\n" +
  "window.CS2_CASES=CS2_CASES;window.SKIN_IMAGES=SKIN_IMAGES;window.ARENA_STEAM=ARENA_STEAM;window.EXCLUSIVE_CASES=EXCLUSIVE_CASES;window.ALL_SKINS=ALL_SKINS;\n";

fs.writeFileSync(path.join(__dirname, "..", "js", "cs2data.js"), out);
console.log(`Pool global ALL_SKINS : ${ALL_SKINS.length} skins (${skippedNoPrice} sans prix Steam ignorés)`);
console.log("Top 3 les plus chers :", ALL_SKINS.slice(-3).map((s) => `${s.weapon} | ${s.name} $${s.price}`).join(" ; "));
console.log(`Caisses exclusives générées : ${EXCLUSIVE_CASES.length}`);
for (const cat of ["only", "knives", "themed", "stickers"]) {
  const list = EXCLUSIVE_CASES.filter((c) => c.category === cat);
  console.log(`  ${cat} (${list.length}) : ${list.map((c) => `${c.name}=$${c.price}`).join(", ")}`);
}

console.log(`OK : ${CS2_CASES.length} caisses officielles`);
console.log(`Items avec prix Steam : ${steamPricedItems} / fallback heuristique : ${fallbackItems}`);
console.log(`Caisses avec prix Steam : ${steamPricedCases}/${CS2_CASES.length}`);
console.log(`Skins Arena avec prix Steam : ${Object.keys(ARENA_STEAM).length}/${needed.length}`);
if (missing.length) console.log("Images manquantes :", missing.join(" ; "));
console.log("Exemples :", CS2_CASES.slice(0, 4).map((c) => `${c.name}=$${c.price}`).join(", "));
const old = CS2_CASES.find((c) => c.name === "CS:GO Weapon Case");
if (old) console.log(`CS:GO Weapon Case (rare) = $${old.price}`);

/* Audit ROI (simulation rapide) */
const audit = [...CS2_CASES, ...EXCLUSIVE_CASES].slice(0, 8);
for (const c of audit) {
  const ev = simCaseEV(c, 8000);
  console.log(`  ROI ${c.name}: $${c.price} → EV $${ev.toFixed(2)} (${((ev / c.price) * 100).toFixed(1)}%)`);
}
const onlyPrem = EXCLUSIVE_CASES.filter((c) => c.category === "only" && ONLY_PREMIUM_FLOOR[c.name.replace(" Only", "")]);
for (const c of onlyPrem) {
  const ev = simCaseEV(c, 8000);
  console.log(`  ROI ${c.name}: $${c.price} → EV $${ev.toFixed(2)} (${((ev / c.price) * 100).toFixed(1)}%)`);
}
