/* =====================================================
   ARENA CASES — Skin Upgrader (style Skin.Club)
   - Jusqu'à 5 skins cumulés côté joueur
   - Cible auto-choisie dès la sélection (modifiable)
   - Chance = (valeur cumulée / valeur visée) × 90 %
   ===================================================== */

const UPGRADE_EDGE = 0.9;       // house edge 10%
const UPGRADE_MIN = 1.5;        // la cible doit valoir au moins 1.5× la mise
const UPGRADE_MAX_STAKE = 5;    // nombre max de skins cumulés

let upMineList = [];   // items de l'inventaire misés (références)
let upTarget = null;   // skin visé (du pool global)
let upTargetManual = false;
let upSpinning = false;

function upTotal() {
  return +upMineList.reduce((s, d) => s + d.price, 0).toFixed(2);
}

/* Pool global : TOUS les skins du jeu (ALL_SKINS, collections incluses),
   complété par les items de caisses non couverts */
let upgradePool = null;
function getUpgradePool() {
  if (upgradePool) return upgradePool;
  const seen = new Set();
  upgradePool = [];
  if (typeof ALL_SKINS !== "undefined") {
    for (const it of ALL_SKINS) {
      seen.add(it.weapon + " | " + it.name);
      upgradePool.push(it);
    }
  }
  for (const c of ALL_CASES) {
    for (const it of c.items) {
      if (it.type === "sticker") continue; // pas de stickers en cible d'upgrade
      const key = it.weapon + " | " + it.name;
      if (seen.has(key)) continue;
      seen.add(key);
      upgradePool.push(it);
    }
  }
  upgradePool.sort((a, b) => a.price - b.price);
  return upgradePool;
}

/* Filtres du pool */
let ufRarity = "all";

function upgradeChance() {
  if (!upMineList.length || !upTarget) return null;
  const raw = (upTotal() / upTarget.price) * UPGRADE_EDGE * 100;
  return Math.max(0.5, Math.min(90, raw));
}

/* Cible auto : vise environ ×2.5 la mise (bonne chance ~35 %) */
function ensureAutoTarget() {
  if (!upMineList.length) {
    upTarget = null;
    upTargetManual = false;
    return;
  }
  const total = upTotal();
  const valid = upTarget && upTarget.price >= total * UPGRADE_MIN;
  if (valid && upTargetManual) return;

  const candidates = getUpgradePool().filter((it) => it.price >= total * UPGRADE_MIN);
  if (!candidates.length) { upTarget = null; return; }
  const ideal = total * 2.5;
  const closest = [...candidates]
    .sort((a, b) => Math.abs(a.price - ideal) - Math.abs(b.price - ideal))
    .slice(0, 8);
  upTarget = closest[Math.floor(Math.random() * closest.length)];
  upTargetManual = false;
}

function miniSkinHTML(it, cls = "") {
  const r = RARITIES[it.rarity];
  return `
    <div class="mini-skin ${cls}" style="--rarity:${r.color}">
      ${skinVisual(it, r.color)}
      <span class="ms-name">${it.stattrak ? "ST™ " : ""}${it.weapon} | ${it.name}</span>
      <span class="ms-price">${fmt(it.price)}</span>
    </div>`;
}

function renderUpgrade() {
  if (upSpinning) return;
  // Purge les items misés qui ne sont plus dans l'inventaire
  upMineList = upMineList.filter((d) => state.inventory.some((x) => x.id === d.id));
  ensureAutoTarget();

  // Ton inventaire (multi-sélection, max 5)
  const inv = $("#upgrade-inv");
  if (!state.inventory.length) {
    inv.innerHTML = '<p class="empty-msg small">Inventory empty — open some cases first!</p>';
  } else {
    inv.innerHTML = [...state.inventory]
      .sort((a, b) => b.price - a.price)
      .map((d) => {
        const sel = upMineList.findIndex((x) => x.id === d.id);
        return `<div class="up-pick ${sel !== -1 ? "active" : ""}" data-id="${d.id}">
          ${sel !== -1 ? `<span class="stack-badge">${sel + 1}</span>` : ""}
          ${miniSkinHTML(d)}
        </div>`;
      })
      .join("");
    inv.querySelectorAll(".up-pick").forEach((el) =>
      el.addEventListener("click", () => {
        const item = state.inventory.find((d) => d.id === el.dataset.id);
        const idx = upMineList.findIndex((x) => x.id === item.id);
        if (idx !== -1) {
          upMineList.splice(idx, 1);
        } else if (upMineList.length >= UPGRADE_MAX_STAKE) {
          toast(`Maximum ${UPGRADE_MAX_STAKE} skins stacked!`, true);
          return;
        } else {
          upMineList.push(item);
          beep(700, 0.05, 0.04, "triangle");
        }
        renderUpgrade();
      })
    );
  }

  // Slot de mise : pile de skins + total
  if (!upMineList.length) {
    $("#upgrade-mine").innerHTML = '<span class="slot-empty">Pick up to 5 skins from your inventory ↓</span>';
  } else {
    $("#upgrade-mine").innerHTML = `
      <div class="mine-stack">
        ${upMineList.map((d) => miniSkinHTML(d, "stack")).join("")}
      </div>
      <div class="mine-total">
        <span>${upMineList.length}/${UPGRADE_MAX_STAKE} skins</span>
        <b>${fmt(upTotal())}</b>
      </div>`;
  }

  // Slot cible
  $("#upgrade-target").innerHTML = upTarget
    ? `${miniSkinHTML(upTarget, "big")}${upTargetManual ? "" : '<span class="auto-tag">choisi automatiquement — clique un skin pour changer</span>'}`
    : '<span class="slot-empty">Pick a skin to target ↓</span>';

  renderUpgradePool();
  updateWheel();
}

function renderUpgradePool() {
  const pool = $("#upgrade-pool");
  if (!upMineList.length) {
    pool.innerHTML = '<p class="empty-msg small">Select your skins first.</p>';
    $("#pool-count").textContent = "";
    return;
  }
  const search = ($("#upgrade-search").value || "").toLowerCase();
  const min = parseFloat($("#uf-min").value);
  const max = parseFloat($("#uf-max").value);
  const floor = upTotal() * UPGRADE_MIN;

  const filtered = getUpgradePool()
    .filter((it) => it.price >= floor)
    .filter((it) => isNaN(min) || it.price >= min)
    .filter((it) => isNaN(max) || it.price <= max)
    .filter((it) => ufRarity === "all" || it.rarity === ufRarity)
    .filter((it) => !search || (it.weapon + " " + it.name).toLowerCase().includes(search));

  const list = filtered.slice(0, 120);
  $("#pool-count").textContent = `(${filtered.length.toLocaleString("fr-FR")} skins dispo)`;

  pool.innerHTML = list.length
    ? list.map((it, i) => `<div class="up-pick ${upTarget === it ? "active" : ""}" data-i="${i}">${miniSkinHTML(it)}</div>`).join("")
    : '<p class="empty-msg small">No skins found with these filters…</p>';

  pool.querySelectorAll(".up-pick").forEach((el) =>
    el.addEventListener("click", () => {
      upTarget = list[+el.dataset.i];
      upTargetManual = true;
      renderUpgrade();
    })
  );
}

function updateWheel() {
  const chance = upgradeChance();
  const ring = $("#wheel-ring");
  const label = $("#wheel-chance");
  const btn = $("#btn-upgrade");
  const hint = $("#upgrade-hint");

  if (chance == null) {
    ring.style.background = "conic-gradient(var(--bg-3) 0% 100%)";
    label.textContent = "—";
    btn.disabled = true;
    hint.textContent = "Select your skins (up to 5) and a target skin.";
    return;
  }
  ring.style.background = `conic-gradient(var(--green) 0% ${chance}%, var(--bg-3) ${chance}% 100%)`;
  label.textContent = chance.toFixed(2) + "%";
  btn.disabled = false;
  const mult = (upTarget.price / upTotal()).toFixed(2);
  const n = upMineList.length;
  hint.textContent = `${fmt(upTotal())} (${n} skin${n > 1 ? "s" : ""}) → ${fmt(upTarget.price)} (×${mult}) — on failure, ${n > 1 ? "your skins are lost" : "your skin is lost"}!`;
}

async function doUpgrade() {
  if (upSpinning || !upMineList.length || !upTarget) return;
  const chance = upgradeChance();
  upSpinning = true;
  $("#btn-upgrade").disabled = true;

  // Retire immédiatement tous les skins misés
  const staked = [...upMineList];
  for (const s of staked) {
    const idx = state.inventory.findIndex((d) => d.id === s.id);
    if (idx !== -1) state.inventory.splice(idx, 1);
  }
  state.stats.upgrades = (state.stats.upgrades || 0) + 1;
  saveState();
  renderBalance();

  // Spin du pointeur : s'arrête dans la zone verte (0..chance%) si gagné
  const win = Math.random() * 100 < chance;
  const landing = win ? Math.random() * chance : chance + Math.random() * (100 - chance);
  const finalDeg = 5 * 360 + landing * 3.6;

  const wheel = $("#upgrade-wheel");
  const pointer = wheel.querySelector(".wheel-pointer");
  pointer.style.transition = "none";
  pointer.style.transform = "rotate(0deg)";
  void pointer.offsetWidth;
  pointer.style.transition = "transform 4.5s cubic-bezier(0.15, 0.7, 0.1, 1)";
  pointer.style.transform = `rotate(${finalDeg}deg)`;

  let t = 0;
  while (t < 4000) {
    beep(700, 0.02, 0.02);
    const step = 60 + 400 * Math.pow(t / 4500, 2);
    t += step;
    await sleep(step);
  }
  await sleep(800);

  if (win) {
    const wear = rollWear();
    const price = dropPrice(upTarget, wear.key, wear.mult, false);
    const newItem = {
      id: Date.now() + "-up" + Math.random().toString(36).slice(2, 6),
      weapon: upTarget.weapon,
      name: upTarget.name,
      rarity: upTarget.rarity,
      type: upTarget.type,
      image: upTarget.image || (typeof SKIN_IMAGES !== "undefined" ? SKIN_IMAGES[upTarget.weapon + " | " + upTarget.name] : undefined),
      wear: wear.key,
      wearLabel: wear.label,
      stattrak: false,
      price,
      caseId: "upgrade",
    };
    state.inventory.push(newItem);
    state.stats.upgradesWon = (state.stats.upgradesWon || 0) + 1;
    state.stats.won += price;
    if (!state.stats.bestDrop || price > state.stats.bestDrop.price) {
      state.stats.bestDrop = { weapon: newItem.weapon, name: newItem.name, price };
    }
    addXp(20 + price * 0.5);
    winSound(upTarget.rarity === "special" ? "special" : "covert");
    toast(`⬆ UPGRADE SUCCESS! ${newItem.weapon} | ${newItem.name} (${fmt(price)}) is yours!`);
    pushLiveDrop(newItem);
  } else {
    addXp(8);
    beep(180, 0.5, 0.09, "sawtooth");
    toast(`💥 Upgrade failed… ${staked.length > 1 ? `Your ${staked.length} skins are lost.` : `${staked[0].weapon} | ${staked[0].name} is lost.`}`, true);
  }

  saveState();
  renderBalance();
  upMineList = [];
  upTarget = null;
  upTargetManual = false;
  upSpinning = false;
  renderUpgrade();
}

document.getElementById("btn-upgrade").addEventListener("click", doUpgrade);
document.getElementById("upgrade-search").addEventListener("input", () => renderUpgradePool());
document.getElementById("uf-min").addEventListener("input", () => renderUpgradePool());
document.getElementById("uf-max").addEventListener("input", () => renderUpgradePool());
document.querySelectorAll("#uf-rarities .pill").forEach((p) =>
  p.addEventListener("click", () => {
    ufRarity = p.dataset.r;
    document.querySelectorAll("#uf-rarities .pill").forEach((b) => b.classList.toggle("active", b === p));
    renderUpgradePool();
  })
);
