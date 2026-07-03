/* =====================================================
   ARENA CASES — Case Battles
   - Liste de battles à rejoindre (créés par des bots,
     en attendant le vrai multijoueur)
   - Création via un panneau dédié
   - Lobby manuel : personne ne rejoint tant qu'on ne
     clique pas "Play with bots" ou "+ Add bot"
   ===================================================== */

const BOT_NAMES = [
  "Antoine", "Pierre", "Yoann", "Amael", "Kik's",
  "Maxou", "Tibo", "Léo", "Nathan", "Enzo",
  "Hugo", "Bastien", "Clément", "Rayan", "Dylan",
  "Mattéo", "Lucas", "Romain", "Théo", "Baptiste",
];

function botHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  return h;
}

function botProfile(name) {
  const h = botHash(name);
  return {
    name,
    avatarEmoji: window.AVATAR_EMOJIS[h % window.AVATAR_EMOJIS.length],
    avatarColor: window.AVATAR_COLORS[(h >> 4) % window.AVATAR_COLORS.length],
  };
}

const FORMAT_INFO = {
  "1v1": { players: 2, teams: null },
  "1v1v1": { players: 3, teams: null },
  "1v1v1v1": { players: 4, teams: null },
  "2v2": { players: 4, teams: [[0, 1], [2, 3]] },
};

const MODE_LABELS = {
  normal: "Classic — highest total wins everything",
  fou: "🤪 Crazy Mode — lowest total wins everything",
  sharing: "🤝 Sharing — winnings split between all players",
};

const MODE_SHORT = { normal: "Classic", fou: "🤪 Crazy", sharing: "🤝 Sharing" };

let battleCfg = { format: "1v1", mode: "normal", cases: [] };
let battleRunning = false;
let battleSetupWired = false;
let battleHomeWired = false;

const MAX_BATTLE_CASES = 10;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* =====================================================
   ÉCRANS DE LA VUE BATTLES
   ===================================================== */
function showBattleScreen(name) {
  $("#battles-home").classList.toggle("hidden", name !== "home");
  $("#battle-setup").classList.toggle("hidden", name !== "setup");
  $("#battle-arena").classList.toggle("hidden", name !== "arena");
}

/* ---------- Accueil : liste des battles ---------- */
let botBattles = [];

function genBotBattle(creatorName) {
  const formats = Object.keys(FORMAT_INFO);
  const modes = ["normal", "normal", "normal", "fou", "sharing"];
  const affordable = window.ALL_CASES.filter((c) => c.price <= 25);
  const count = 1 + Math.floor(Math.random() * 4);
  return {
    id: "bb-" + Math.random().toString(36).slice(2, 8),
    creator: creatorName,
    format: formats[Math.floor(Math.random() * formats.length)],
    mode: modes[Math.floor(Math.random() * modes.length)],
    cases: Array.from({ length: count }, () => affordable[Math.floor(Math.random() * affordable.length)].id),
  };
}

function ensureBotBattles() {
  if (!botBattles.length) {
    const n = 3 + Math.floor(Math.random() * 3); // 3 à 5
    const names = [...BOT_NAMES].sort(() => Math.random() - 0.5).slice(0, n);
    botBattles = names.map(genBotBattle);
  }
}

function battleCasesCost(caseIds) {
  return +caseIds.reduce((s, id) => s + window.ALL_CASES.find((x) => x.id === id).price, 0).toFixed(2);
}

function renderBattlesHome() {
  if (battleRunning) return;
  showBattleScreen("home");
  ensureBotBattles();

  if (!battleHomeWired) {
    battleHomeWired = true;
    $("#btn-new-battle").addEventListener("click", () => {
      renderBattleSetup();
      showBattleScreen("setup");
    });
    $("#btn-setup-back").addEventListener("click", () => showBattleScreen("home"));
  }

  $("#battle-list").innerHTML = botBattles
    .map((b) => {
      const cost = battleCasesCost(b.cases);
      const info = FORMAT_INFO[b.format];
      const canJoin = state.balance >= cost;
      return `
        <div class="battle-row">
          <div class="br-creator">
            ${avatarHTML(botProfile(b.creator), 40)}
            <div class="br-creator-info">
              <span class="br-name">${b.creator}</span>
              <span class="br-sub">${b.format.toUpperCase()} · ${MODE_SHORT[b.mode]} · ${info.players} players</span>
            </div>
          </div>
          <div class="br-cases">
            ${b.cases.map((id) => {
              const c = window.ALL_CASES.find((x) => x.id === id);
              return `<div class="br-case" title="${c.name} (${fmt(c.price)})">${caseVisual(c)}</div>`;
            }).join("")}
            <span class="br-rounds">${b.cases.length} round${b.cases.length > 1 ? "s" : ""}</span>
          </div>
          <div class="br-join">
            <span class="br-cost">${fmt(cost)}</span>
            <button class="btn-join" data-id="${b.id}" ${canJoin ? "" : "disabled"}>${canJoin ? "JOIN" : "INSUFFICIENT BALANCE"}</button>
          </div>
        </div>`;
    })
    .join("");

  $("#battle-list").querySelectorAll(".btn-join").forEach((btn) =>
    btn.addEventListener("click", () => {
      const b = botBattles.find((x) => x.id === btn.dataset.id);
      if (b) joinBattle(b);
    })
  );
}

function renderBattleSetup() {
  if (!battleCfg.cases.length) battleCfg.cases = [window.ALL_CASES[0].id];

  const picker = $("#battle-case-picker");
  picker.innerHTML = [...window.ALL_CASES]
    .sort((a, b) => a.price - b.price)
    .map((c) => `
      <div class="battle-case" data-case="${c.id}">
        <div class="bc-img">${caseVisual(c)}</div>
        <span class="bc-name">${c.name}</span>
        <span class="bc-price">${fmt(c.price)}</span>
      </div>`).join("");

  picker.querySelectorAll(".battle-case").forEach((el) =>
    el.addEventListener("click", () => {
      if (battleCfg.cases.length >= MAX_BATTLE_CASES) {
        toast(`Maximum ${MAX_BATTLE_CASES} cases per battle!`, true);
        return;
      }
      battleCfg.cases.push(el.dataset.case);
      beep(700, 0.05, 0.04, "triangle");
      renderBattleSequence();
    })
  );

  if (!battleSetupWired) {
    battleSetupWired = true;
    wirePills("#battle-format", "format");
    wirePills("#battle-mode", "mode");
    $("#btn-create-battle").addEventListener("click", createBattle);
  }
  renderBattleSequence();
}

function renderBattleSequence() {
  const seq = $("#battle-sequence");
  if (!battleCfg.cases.length) {
    seq.innerHTML = '<span class="seq-empty">Add at least one case ↓</span>';
  } else {
    seq.innerHTML = battleCfg.cases
      .map((id, i) => {
        const c = window.ALL_CASES.find((x) => x.id === id);
        return `
          <div class="seq-chip" data-i="${i}" title="Round ${i + 1} — cliquer pour retirer">
            <span class="seq-round">R${i + 1}</span>
            <div class="seq-img">${caseVisual(c)}</div>
            <div class="seq-info">
              <span class="seq-name">${c.name}</span>
              <span class="seq-price">${fmt(c.price)}</span>
            </div>
            <span class="seq-x">✕</span>
          </div>`;
      })
      .join("");
    seq.querySelectorAll(".seq-chip").forEach((el) =>
      el.addEventListener("click", () => {
        battleCfg.cases.splice(+el.dataset.i, 1);
        renderBattleSequence();
      })
    );
  }
  updateBattleCost();
}

function wirePills(sel, key) {
  document.querySelectorAll(sel + " .pill").forEach((p) =>
    p.addEventListener("click", () => {
      document.querySelectorAll(sel + " .pill").forEach((b) => b.classList.toggle("active", b === p));
      battleCfg[key] = p.dataset[key];
      updateBattleCost();
    })
  );
}

function battleCost() {
  return battleCasesCost(battleCfg.cases);
}

function updateBattleCost() {
  const n = battleCfg.cases.length;
  const btn = $("#btn-create-battle");
  if (!n) {
    btn.disabled = true;
    btn.textContent = "ADD A CASE";
    return;
  }
  btn.disabled = state.balance < battleCost();
  btn.textContent = state.balance < battleCost()
    ? "INSUFFICIENT BALANCE"
    : `CREATE BATTLE — ${n} round${n > 1 ? "s" : ""} · ${fmt(battleCost())}`;
}

/* =====================================================
   ARÈNE : cartes joueurs & rouleaux
   ===================================================== */
function playerCardShell(idx, teams) {
  const teamTag = teams
    ? `<span class="team-tag team-${teams[0].includes(idx) ? "a" : "b"}">TEAM ${teams[0].includes(idx) ? "A" : "B"}</span>`
    : "";
  return `
    <div class="battle-player empty-slot" id="bp-${idx}">
      <div class="bp-slot-inner" id="bp-inner-${idx}">
        <div class="bp-empty">
          ${teamTag}
          <span class="bp-free">OPEN SLOT</span>
          <span class="bp-wait-dots">Waiting for a player…</span>
          <button class="btn-add-bot" data-slot="${idx}">+ ADD BOT</button>
        </div>
      </div>
    </div>`;
}

function fillPlayerCard(idx, p, teams) {
  const teamTag = teams
    ? `<span class="team-tag team-${teams[0].includes(idx) ? "a" : "b"}">TEAM ${teams[0].includes(idx) ? "A" : "B"}</span>`
    : "";
  $(`#bp-${idx}`).classList.remove("empty-slot");
  $(`#bp-inner-${idx}`).innerHTML = `
    <div class="bp-header">
      ${avatarHTML(p.profile, 44)}
      <div class="bp-id">
        <span class="bp-name">${p.profile.name}${p.isUser ? " (you)" : ""}</span>
        ${teamTag}
      </div>
    </div>
    <div class="bp-stage" id="bp-stage-${idx}"></div>
    <div class="bp-total-box">
      <span class="bp-total-label">WINNINGS</span>
      <span class="bp-total" id="bp-total-${idx}">$0.00</span>
    </div>
    <div class="bp-drops" id="bp-drops-${idx}"></div>`;
}

/* Rouleau horizontal dans sa propre fenêtre stylée */
const BATTLE_REEL_SIZE = 30;
const BATTLE_WIN_INDEX = 25;

function battleReelHTML(idx, caseData, winnerDrop, rare = false) {
  const pool = rare ? rareSpecialPool(caseData) : null;
  const items = [];
  for (let i = 0; i < BATTLE_REEL_SIZE; i++) {
    if (i === BATTLE_WIN_INDEX) items.push(winnerDrop);
    else items.push(rare ? pool[Math.floor(Math.random() * pool.length)] : rollItem(caseData));
  }
  return `
    <div class="bp-reel" id="bp-reel-${idx}">
      <div class="bp-reel-frame ${rare ? "rare" : ""}">
        ${rare ? '<div class="bp-rare-banner">★ RARE SPECIAL ITEM ★</div>' : ""}
        <div class="bp-reel-marker"></div>
        <div class="bp-reel-window">
          <div class="roulette-track mini" id="bp-track-${idx}">
            ${items.map((it) => reelItemHTML(it, rare)).join("")}
          </div>
        </div>
      </div>
    </div>`;
}

function battleReelItemWidth(track) {
  const first = track?.querySelector(".roulette-item");
  if (!first) return 138;
  const gap = parseFloat(getComputedStyle(track).gap) || 6;
  return first.offsetWidth + gap;
}

function spinBattleReel(idx, duration) {
  const track = $(`#bp-track-${idx}`);
  const windowEl = track.parentElement;
  const itemW = battleReelItemWidth(track);
  const jitter = (Math.random() - 0.5) * itemW * 0.5;
  const target = BATTLE_WIN_INDEX * itemW + itemW / 2 - windowEl.clientWidth / 2 + jitter;
  track.style.transition = "none";
  track.style.transform = "translateX(0)";
  void track.offsetWidth;
  track.style.transition = `transform ${duration}ms cubic-bezier(0.12, 0.72, 0.06, 1)`;
  track.style.transform = `translateX(${-target}px)`;
}

function renderBattleRoundHeader(caseData, round, total) {
  $("#battle-info").innerHTML = `
    <div class="battle-meta with-case">
      <div class="bm-case-img">${caseVisual(caseData)}</div>
      <div class="bm-case-info">
        <span class="bm-round">ROUND ${round} / ${total}</span>
        <b>${caseData.name}</b>
        <span class="bm-price">${fmt(caseData.price)}</span>
      </div>
      <span class="battle-mode-tag">${MODE_LABELS[battleCfg.mode]}</span>
    </div>`;
}

/* =====================================================
   LANCEMENT DES BATTLES
   ===================================================== */
function createBattle() {
  runBattle({ creator: null });
}

function joinBattle(b) {
  battleCfg = { format: b.format, mode: b.mode, cases: [...b.cases] };
  botBattles = botBattles.filter((x) => x.id !== b.id);
  runBattle({ creator: botProfile(b.creator) });
}

async function runBattle(opts) {
  const cost = battleCost();
  if (state.balance < cost) { toast("Insufficient balance for this battle!", true); return; }
  if (!battleCfg.cases.length) { toast("Add at least one case!", true); return; }

  const battleCases = battleCfg.cases.map((id) => window.ALL_CASES.find((x) => x.id === id));
  const info = FORMAT_INFO[battleCfg.format];
  const user = currentUser() || { name: "You", avatarEmoji: "👤", avatarColor: "#ff6b35" };

  state.balance = +(state.balance - cost).toFixed(2);
  state.stats.spent += cost;
  state.stats.battles = (state.stats.battles || 0) + 1;
  addXp(15 + cost * 1.5);
  saveState();
  renderBalance();
  flashBalance(false);

  battleRunning = true;
  showBattleScreen("arena");

  // Slots : joueur en 0, créateur (si on rejoint) en 1, le reste vide
  const players = new Array(info.players).fill(null);
  players[0] = { profile: user, isUser: true, drops: [], total: 0 };
  if (opts.creator) players[1] = { profile: opts.creator, isUser: false, drops: [], total: 0 };

  $("#battle-info").innerHTML = `
    <div class="battle-meta">
      <b>${battleCases.length} case${battleCases.length > 1 ? "s" : ""}</b> — ${battleCfg.format.toUpperCase()}
      <span class="battle-mode-tag">${MODE_LABELS[battleCfg.mode]}</span>
    </div>`;
  $("#battle-players").innerHTML = players.map((_, i) => playerCardShell(i, info.teams)).join("");
  $("#battle-players").className = "battle-players cols-" + info.players;
  players.forEach((p, i) => { if (p) fillPlayerCard(i, p, info.teams); });

  const usedNames = new Set(players.filter(Boolean).map((p) => p.profile.name));

  function pickBotName() {
    const free = BOT_NAMES.filter((n) => !usedNames.has(n));
    const name = free[Math.floor(Math.random() * free.length)] || "Bot" + Math.floor(Math.random() * 99);
    usedNames.add(name);
    return name;
  }

  function addBot(slot) {
    if (players[slot]) return;
    players[slot] = { profile: botProfile(pickBotName()), isUser: false, drops: [], total: 0 };
    fillPlayerCard(slot, players[slot], info.teams);
    beep(600, 0.08, 0.05, "triangle");
    checkFilled();
  }

  let resolveFilled;
  const allFilled = new Promise((r) => (resolveFilled = r));

  function checkFilled() {
    if (players.every(Boolean)) {
      $("#battle-footer").innerHTML = "";
      resolveFilled();
    }
  }

  // Lobby : personne ne rejoint tant qu'on ne le demande pas
  $("#battle-footer").innerHTML = `
    <p class="battle-status">Waiting for players… add bots to start the game</p>
    <div class="battle-actions">
      <button class="btn-primary" id="btn-play-bots">🤖 PLAY WITH BOTS</button>
      <button class="btn-again" id="btn-cancel-battle">✕ CANCEL (refunded)</button>
    </div>`;

  let cancelled = false;
  $("#btn-cancel-battle").addEventListener("click", () => {
    cancelled = true;
    state.balance = +(state.balance + cost).toFixed(2);
    state.stats.spent -= cost;
    state.stats.battles = Math.max(0, (state.stats.battles || 1) - 1);
    saveState();
    renderBalance();
    flashBalance(true);
    battleRunning = false;
    toast(`Battle cancelled — ${fmt(cost)} refunded.`);
    renderBattlesHome();
  });

  $("#btn-play-bots").addEventListener("click", async () => {
    $("#btn-play-bots").disabled = true;
    for (let i = 0; i < players.length; i++) {
      if (!players[i]) {
        await sleep(350 + Math.random() * 450);
        if (cancelled) return;
        addBot(i);
      }
    }
  });

  document.querySelectorAll(".btn-add-bot").forEach((btn) =>
    btn.addEventListener("click", () => addBot(+btn.dataset.slot))
  );

  // Si on a rejoint le battle d'un autre, il manque peut-être des joueurs :
  // ils peuvent aussi être ajoutés à la main (ou via Play with bots)
  await allFilled;
  if (cancelled) return;

  await sleep(400);
  for (let c = 3; c >= 1; c--) {
    $("#battle-footer").innerHTML = `<p class="battle-status countdown">${c}</p>`;
    beep(500 + c * 100, 0.1, 0.06);
    await sleep(750);
  }

  // Rounds : rouleau dans la scène de chaque joueur, gains dessous
  const SPIN_MS = 3600;
  for (let round = 1; round <= battleCases.length; round++) {
    const caseData = battleCases[round - 1];
    renderBattleRoundHeader(caseData, round, battleCases.length);
    $("#battle-footer").innerHTML = `<p class="battle-status">ROUND ${round} / ${battleCases.length} — ${caseData.name}</p>`;

    const roundDrops = players.map(() => rollDrop(caseData));

    players.forEach((_, i) => {
      $(`#bp-stage-${i}`).innerHTML = battleReelHTML(i, caseData, roundDrops[i]);
    });
    await sleep(60);
    players.forEach((_, i) => spinBattleReel(i, SPIN_MS));

    let t = 0;
    while (t < SPIN_MS - 300) {
      beep(900, 0.025, 0.02);
      const step = 50 + 330 * Math.pow(t / SPIN_MS, 2.2);
      t += step;
      await sleep(step);
    }
    await sleep(500);

    // Gold obtenu → second rouleau doré pour les joueurs concernés
    const rareIdx = players.map((_, i) => (roundDrops[i].fromRare ? i : -1)).filter((i) => i !== -1);
    if (rareIdx.length) {
      $("#battle-footer").innerHTML = `<p class="battle-status gold">★ RARE SPECIAL ITEM ! ★</p>`;
      winSound("classified");
      rareIdx.forEach((i) => {
        $(`#bp-stage-${i}`).innerHTML = battleReelHTML(i, caseData, roundDrops[i], true);
      });
      await sleep(60);
      const RARE_MS = 3200;
      rareIdx.forEach((i) => spinBattleReel(i, RARE_MS));
      let rt = 0;
      while (rt < RARE_MS - 300) {
        beep(1150, 0.02, 0.02);
        const step = 55 + 300 * Math.pow(rt / RARE_MS, 2.2);
        rt += step;
        await sleep(step);
      }
      await sleep(600);
    }

    players.forEach((p, i) => {
      const d = roundDrops[i];
      p.drops.push(d);
      p.total = +(p.total + d.price).toFixed(2);
      const r = window.RARITIES[d.rarity];
      $(`#bp-stage-${i}`).innerHTML = "";
      $(`#bp-drops-${i}`).insertAdjacentHTML("afterbegin", `
        <div class="bp-drop" style="--rarity:${r.color}">
          ${skinVisual(d, r.color)}
          <span class="bpd-name">${d.stattrak ? "ST™ " : ""}${d.weapon} | ${d.name}</span>
          <span class="bpd-price">${fmt(d.price)}</span>
        </div>`);
      $(`#bp-total-${i}`).textContent = fmt(p.total);
    });
    const bestRound = roundDrops.reduce((a, b) => (b.price > a.price ? b : a));
    beep(bestRound.rarity === "special" ? 1047 : 700, 0.25, 0.07, "triangle");
    await sleep(900);
  }

  finishBattle(players, info, battleCases);
}

/* Partage équitable par valeur (pas round-robin sur les skins chers) */
function partitionFair(items, count) {
  const piles = Array.from({ length: count }, () => ({ items: [], total: 0 }));
  if (!items.length || count < 1) return piles;

  const total = items.reduce((s, d) => s + d.price, 0);
  const target = total / count;
  const sorted = [...items].sort((a, b) => b.price - a.price);

  for (const item of sorted) {
    let bestIdx = 0;
    let bestScore = Infinity;
    for (let i = 0; i < count; i++) {
      const after = piles[i].total + item.price;
      const score =
        Math.abs(after - target) +
        (after > target * 1.2 ? (after - target * 1.2) * 2.5 : 0) +
        (item.price > target * 1.25 && piles[i].total < target * 0.35 ? (target - piles[i].total) * 0.5 : 0);
      if (score < bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    piles[bestIdx].items.push(item);
    piles[bestIdx].total = +(piles[bestIdx].total + item.price).toFixed(2);
  }

  for (let pass = 0; pass < 40; pass++) {
    let hi = 0;
    let lo = 0;
    for (let i = 1; i < count; i++) {
      if (piles[i].total > piles[hi].total) hi = i;
      if (piles[i].total < piles[lo].total) lo = i;
    }
    if (piles[hi].total - piles[lo].total < target * 0.35) break;

    let swapped = false;
    for (const big of [...piles[hi].items].sort((a, b) => b.price - a.price)) {
      for (const small of [...piles[lo].items].sort((a, b) => a.price - b.price)) {
        if (big.price <= small.price) continue;
        const newHi = piles[hi].total - big.price + small.price;
        const newLo = piles[lo].total - small.price + big.price;
        const oldSpread = Math.abs(piles[hi].total - target) + Math.abs(piles[lo].total - target);
        const newSpread = Math.abs(newHi - target) + Math.abs(newLo - target);
        if (newSpread < oldSpread - 0.01) {
          piles[hi].items = piles[hi].items.filter((x) => x.id !== big.id).concat(small);
          piles[lo].items = piles[lo].items.filter((x) => x.id !== small.id).concat(big);
          piles[hi].total = +newHi.toFixed(2);
          piles[lo].total = +newLo.toFixed(2);
          swapped = true;
          break;
        }
      }
      if (swapped) break;
    }
    if (!swapped) break;
  }

  return piles;
}

/* Si la part est trop basse (gros skin indivisible), complète avec des drops de rechange */
function compensateShortPile(pile, target, casePool) {
  if (!casePool?.length || pile.total >= target * 0.78) return;

  let attempts = 0;
  while (pile.total < target * 0.78 && attempts < 12) {
    attempts++;
    const need = target - pile.total;
    const c = casePool[Math.floor(Math.random() * casePool.length)];
    const sub = rollDrop(c);
    sub.id = "battle-sub-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    if (sub.price > need * 1.6 && pile.items.length > 0) continue;
    if (sub.price > target * 1.1) continue;
    pile.items.push(sub);
    pile.total = +(pile.total + sub.price).toFixed(2);
  }
}

function splitItems(items, rank, count, casePool) {
  if (!items.length || count < 1) return [];
  const target = items.reduce((s, d) => s + d.price, 0) / count;
  const piles = partitionFair(items, count);
  compensateShortPile(piles[rank], target, casePool);
  return piles[rank].items;
}

function finishBattle(players, info, battleCases) {
  const allDrops = players.flatMap((p) => p.drops);
  const totalValue = +allDrops.reduce((s, d) => s + d.price, 0).toFixed(2);
  let resultHTML = "";
  let userItems = [];
  let userWon = false;

  if (battleCfg.mode === "sharing") {
    userItems = splitItems(allDrops, 0, players.length, battleCases);
    userWon = true;
    const shareVal = +userItems.reduce((s, d) => s + d.price, 0).toFixed(2);
    const fairShare = +(totalValue / players.length).toFixed(2);
    resultHTML = `🤝 SHARING — your fair share: <b>${fmt(shareVal)}</b> (~${fmt(fairShare)} per player from ${fmt(totalValue)} total)`;
    players.forEach((_, i) => $(`#bp-${i}`).classList.add("winner"));
  } else if (info.teams) {
    const totals = info.teams.map((team) => team.reduce((s, i) => s + players[i].total, 0));
    const bestTeam = battleCfg.mode === "fou"
      ? (totals[0] <= totals[1] ? 0 : 1)
      : (totals[0] >= totals[1] ? 0 : 1);
    const winners = info.teams[bestTeam];
    winners.forEach((i) => $(`#bp-${i}`).classList.add("winner"));
    if (winners.some((i) => players[i].isUser)) {
      userItems = splitItems(allDrops, 0, winners.length, battleCases);
      userWon = true;
      const shareVal = +userItems.reduce((s, d) => s + d.price, 0).toFixed(2);
      const fairShare = +(totalValue / winners.length).toFixed(2);
      resultHTML = `🏆 YOUR TEAM WINS ${battleCfg.mode === "fou" ? "(Crazy Mode!)" : ""} — shared loot: <b>${fmt(shareVal)}</b> (~${fmt(fairShare)} each)`;
    } else {
      resultHTML = `💀 Team ${bestTeam === 0 ? "A" : "B"} wins… You leave empty-handed.`;
    }
  } else {
    const winner = players.reduce((a, b) =>
      battleCfg.mode === "fou" ? (b.total < a.total ? b : a) : (b.total > a.total ? b : a)
    );
    const wIdx = players.indexOf(winner);
    $(`#bp-${wIdx}`).classList.add("winner");
    if (winner.isUser) {
      userItems = allDrops;
      userWon = true;
      resultHTML = `🏆 YOU WIN THE BATTLE ${battleCfg.mode === "fou" ? "(Crazy Mode!)" : ""} — ${allDrops.length} skins (${fmt(totalValue)})!`;
    } else {
      resultHTML = `💀 ${winner.profile.name} wins with ${fmt(winner.total)}… You leave empty-handed.`;
    }
  }

  if (userItems.length) {
    const gain = +userItems.reduce((s, d) => s + d.price, 0).toFixed(2);
    state.stats.won += gain;
  }
  if (userWon) {
    state.stats.battlesWon = (state.stats.battlesWon || 0) + 1;
    winSound("covert");
  }

  const myBest = players[0].drops.reduce((a, b) => (b.price > a.price ? b : a));
  if (!state.stats.bestDrop || myBest.price > state.stats.bestDrop.price) {
    state.stats.bestDrop = { weapon: myBest.weapon, name: myBest.name, price: myBest.price };
  }
  saveState();
  renderBalance();

  $("#battle-footer").innerHTML = `
    <p class="battle-result ${userWon ? "win" : "lose"}">${resultHTML}</p>
    <div class="battle-actions">
      <button class="btn-again" id="btn-battle-replay">↻ PLAY AGAIN</button>
      <button class="btn-primary" id="btn-battle-back">BACK TO BATTLES</button>
    </div>`;

  players[0].drops.forEach(pushLiveDrop);
  battleRunning = false;

  // Un nouveau battle de bot remplace celui qui vient d'être joué
  if (botBattles.length < 3) {
    const free = BOT_NAMES.filter((n) => !botBattles.some((b) => b.creator === n));
    botBattles.push(genBotBattle(free[Math.floor(Math.random() * free.length)]));
  }

  $("#btn-battle-replay").addEventListener("click", () => {
    if (state.balance < battleCost()) { toast("Insufficient balance!", true); return; }
    runBattle({ creator: null });
  });
  $("#btn-battle-back").addEventListener("click", () => renderBattlesHome());

  saveState();
  if (userItems.length) showBattleLoot(userItems, resultHTML);
}

/* =====================================================
   POPUP BUTIN : garder / tout vendre / vente à l'unité
   ===================================================== */
let lootItems = [];

function showBattleLoot(items, subtitle) {
  lootItems = [...items].sort((a, b) => b.price - a.price);
  $("#battle-loot-title").textContent = "🎁 BATTLE LOOT";
  $("#battle-loot-subtitle").innerHTML = subtitle;
  renderLootGrid();
  $("#battle-modal").classList.remove("hidden");
}

function renderLootGrid() {
  const total = +lootItems.reduce((s, d) => s + d.price, 0).toFixed(2);
  $("#battle-loot-grid").innerHTML = lootItems
    .map((d) => skinCardHTML(d, { sellBtn: true }))
    .join("");
  $("#btn-loot-sell-all").textContent = `SELL ALL (${fmt(total)})`;
  $("#btn-loot-keep").textContent = lootItems.length > 1 ? `KEEP ALL (${lootItems.length})` : "KEEP";

  $("#battle-loot-grid").querySelectorAll("[data-sell]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const idx = lootItems.findIndex((d) => d.id === btn.dataset.sell);
      if (idx === -1) return;
      const [item] = lootItems.splice(idx, 1);
      state.balance = +(state.balance + item.price).toFixed(2);
      saveState();
      renderBalance();
      flashBalance(true);
      beep(880, 0.12, 0.05, "triangle");
      if (!lootItems.length) {
        closeLootModal();
        toast("All loot has been sold!");
      } else {
        renderLootGrid();
      }
    })
  );
}

function closeLootModal() {
  $("#battle-modal").classList.add("hidden");
  lootItems = [];
}

function lootKeepRemaining() {
  if (!lootItems.length) { closeLootModal(); return; }
  state.inventory.push(...lootItems);
  saveState();
  renderBalance();
  toast(`${lootItems.length} skin(s) added to your inventory!`);
  closeLootModal();
}

$("#btn-loot-sell-all").addEventListener("click", () => {
  if (!lootItems.length) { closeLootModal(); return; }
  const total = +lootItems.reduce((s, d) => s + d.price, 0).toFixed(2);
  state.balance = +(state.balance + total).toFixed(2);
  saveState();
  renderBalance();
  flashBalance(true);
  toast(`Loot sold for ${fmt(total)}!`);
  closeLootModal();
});

$("#btn-loot-keep").addEventListener("click", lootKeepRemaining);

// Fermer en cliquant à côté = tout garder (comme à l'ouverture de caisses)
$("#battle-modal").addEventListener("click", (e) => {
  if (e.target === $("#battle-modal")) lootKeepRemaining();
});

window.STEPCASES_BOT_NAMES = BOT_NAMES;
window.STEPCASES_botHash = botHash;
window.STEPCASES_botProfile = botProfile;
