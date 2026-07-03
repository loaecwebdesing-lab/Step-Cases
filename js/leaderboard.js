/* =====================================================
   STEP CASES — Leaderboards (Supabase cloud)
   ===================================================== */

let lbCategory = "bestdrop";
let lbWired = false;
let lbModalWired = false;
let _lbCache = [];

function entryFromProfile(row, isMe) {
  const inv = Array.isArray(row.inventory) ? row.inventory : [];
  const stats = row.stats || {};
  const profile = {
    name: row.username,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    created: new Date(row.created_at).getTime(),
  };
  const bestInv = inv.reduce((a, b) => (!a || b.price > a.price ? b : a), null);
  return {
    key: row.id,
    profile,
    inventory: inv,
    stats,
    isMe,
    opened: stats.opened || 0,
    money: Number(row.balance) || 0,
    xp: Number(row.xp) || 0,
    bestDrop: stats.bestDrop
      ? { label: `${stats.bestDrop.weapon} | ${stats.bestDrop.name}`, value: stats.bestDrop.price, item: stats.bestDrop }
      : { label: "—", value: 0, item: null },
    bestSkin: bestInv
      ? { label: `${bestInv.weapon} | ${bestInv.name}`, value: bestInv.price, item: bestInv }
      : { label: "—", value: 0, item: null },
  };
}

function guestEntry() {
  if (isLoggedIn() || typeof state === "undefined") return null;
  const inv = state.inventory || [];
  const bestInv = inv.reduce((a, b) => (!a || b.price > a.price ? b : a), null);
  return {
    key: null,
    profile: { name: "You (guest)", avatarEmoji: "👤", avatarColor: "#8a91ad" },
    inventory: inv,
    stats: state.stats,
    isMe: true,
    opened: state.stats.opened,
    money: state.balance,
    xp: state.xp || 0,
    bestDrop: state.stats.bestDrop
      ? { label: `${state.stats.bestDrop.weapon} | ${state.stats.bestDrop.name}`, value: state.stats.bestDrop.price, item: state.stats.bestDrop }
      : { label: "—", value: 0, item: null },
    bestSkin: bestInv
      ? { label: `${bestInv.weapon} | ${bestInv.name}`, value: bestInv.price, item: bestInv }
      : { label: "—", value: 0, item: null },
  };
}

const BOT_DROP_NAMES = [
  ["AK-47", "Redline", 42],
  ["AWP", "Asiimov", 88],
  ["M4A4", "Neo-Noir", 35],
  ["Desert Eagle", "Printstream", 62],
  ["USP-S", "Kill Confirmed", 54],
  ["Glock-18", "Fade", 420],
  ["Karambit", "Doppler", 890],
  ["Butterfly Knife", "Fade", 1200],
];

function botLeaderboardEntry(name) {
  const hash = window.STEPCASES_botHash || (() => 0);
  const profileFn = window.STEPCASES_botProfile || ((n) => ({ name: n, avatarEmoji: "🤖", avatarColor: "#8a91ad" }));
  const h = hash(name);
  const profile = profileFn(name);
  const opened = 80 + (h % 2200);
  const money = 12 + (h % 4500) / 10;
  const xp = Math.floor(opened * (3.2 + (h % 5) / 10) + (h % 800));
  const drop = BOT_DROP_NAMES[h % BOT_DROP_NAMES.length];
  const bestDropPrice = drop[2] * (1 + (h % 30) / 100);
  const bestSkinPrice = bestDropPrice * (0.85 + (h % 15) / 100);
  const spent = opened * (2.1 + (h % 8) / 10);
  const won = spent * (0.75 + (h % 40) / 100);
  const stats = {
    opened,
    spent,
    won,
    bestDrop: { weapon: drop[0], name: drop[1], price: bestDropPrice },
    knives: h % 4,
    gloves: (h >> 3) % 3,
    battles: 5 + (h % 40),
    battlesWon: 2 + (h % 20),
    upgrades: h % 25,
    upgradesWon: (h >> 2) % 12,
  };
  return {
    key: "bot-" + name,
    profile,
    inventory: [],
    stats,
    isMe: false,
    isBot: true,
    opened,
    money,
    xp,
    bestDrop: {
      label: `${drop[0]} | ${drop[1]}`,
      value: bestDropPrice,
      item: stats.bestDrop,
    },
    bestSkin: {
      label: `${drop[0]} | ${drop[1]}`,
      value: bestSkinPrice,
      item: { weapon: drop[0], name: drop[1], price: bestSkinPrice },
    },
  };
}

function mergeCommunityPlayers(entries) {
  const names = new Set(entries.map((e) => (e.profile.name || "").toLowerCase()));
  const meName = (typeof currentUser === "function" && currentUser()?.name || "").toLowerCase();
  const botNames = window.STEPCASES_BOT_NAMES || [];
  for (const name of botNames) {
    const key = name.toLowerCase();
    if (key === meName || names.has(key)) continue;
    entries.push(botLeaderboardEntry(name));
    names.add(key);
  }
  return entries;
}

function safeEntryFromProfile(row, isMe) {
  try {
    return entryFromProfile(row, isMe);
  } catch (e) {
    console.warn("Leaderboard: skip profile", row?.id, e);
    return null;
  }
}

async function fetchEntries() {
  if (useCloud()) {
    try {
      const rows = await dbFetchLeaderboard();
      const me = authUserId();
      const entries = rows
        .map((r) => safeEntryFromProfile(r, r.id === me))
        .filter(Boolean);
      const guest = guestEntry();
      if (guest) entries.push(guest);
      return mergeCommunityPlayers(entries);
    } catch (e) {
      console.error("Leaderboard fetch failed:", e);
      const fallback = [];
      const guest = guestEntry();
      if (guest) fallback.push(guest);
      return mergeCommunityPlayers(fallback);
    }
  }

  /* Local fallback */
  const entries = [];
  const reg = typeof authLoadLocal === "function" ? authLoadLocal() : { users: {}, current: null };
  for (const [key, user] of Object.entries(reg.users)) {
    let save = null;
    try { save = JSON.parse(localStorage.getItem("arena-save-" + key)); } catch (e) { /* ignore */ }
    if (!save) continue;
    const entry = safeEntryFromProfile({
      id: key,
      username: user.name,
      avatar_emoji: user.avatarEmoji,
      avatar_color: user.avatarColor,
      balance: save.balance,
      inventory: save.inventory,
      stats: save.stats,
      xp: save.xp,
      created_at: new Date(user.created).toISOString(),
    }, reg.current === key);
    if (entry) entries.push(entry);
  }
  const guest = guestEntry();
  if (guest) entries.push(guest);
  return mergeCommunityPlayers(entries);
}

const LB_CONFIG = {
  bestdrop: { get: (e) => e.bestDrop.value, text: (e) => e.bestDrop.label, val: (e) => fmt(e.bestDrop.value) },
  bestskin: { get: (e) => e.bestSkin.value, text: (e) => e.bestSkin.label, val: (e) => fmt(e.bestSkin.value) },
  money: { get: (e) => e.money, text: () => "Current balance", val: (e) => fmt(e.money) },
  opened: { get: (e) => e.opened, text: () => "Cases opened", val: (e) => e.opened.toLocaleString("en-US") },
  level: { get: (e) => e.xp, text: (e) => `${Math.round(e.xp).toLocaleString("en-US")} XP`, val: (e) => "Lv. " + levelFromXp(e.xp) },
};

function wirePlayerModal() {
  if (lbModalWired) return;
  lbModalWired = true;
  $("#player-modal-close").addEventListener("click", closePlayerModal);
  $("#player-modal").addEventListener("click", (e) => {
    if (e.target === $("#player-modal")) closePlayerModal();
  });
}

function closePlayerModal() {
  $("#player-modal").classList.add("hidden");
}

function openPlayerProfile(entry) {
  wirePlayerModal();
  const stats = entry.stats || {};
  const inv = [...(entry.inventory || [])].sort((a, b) => b.price - a.price);
  const invTotal = inv.reduce((s, d) => s + d.price, 0);
  const profit = (stats.won || 0) - (stats.spent || 0);
  const lp = levelProgress(entry.xp || 0);
  const since = entry.profile.created
    ? new Date(entry.profile.created).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
    : "—";

  const statCards = [
    { v: entry.opened, l: "Cases opened" },
    { v: fmt(stats.spent || 0), l: "Total spent" },
    { v: fmt(stats.won || 0), l: "Total won" },
    { v: (profit >= 0 ? "+" : "") + fmt(profit).replace("$-", "-$"), l: "Net profit", c: profit >= 0 ? "var(--green)" : "var(--red)" },
    { v: stats.knives || 0, l: "🔪 Knives dropped" },
    { v: stats.gloves || 0, l: "🧤 Gloves dropped" },
    { v: `${stats.battlesWon || 0}/${stats.battles || 0}`, l: "⚔️ Battles won" },
    { v: `${stats.upgradesWon || 0}/${stats.upgrades || 0}`, l: "⬆ Upgrades won" },
  ];

  const bestDropHTML = entry.bestDrop.item
    ? skinCardHTML(entry.bestDrop.item)
    : '<p class="empty-msg small">No drops yet</p>';

  const bestSkinHTML = entry.bestSkin.item
    ? skinCardHTML(entry.bestSkin.item)
    : '<p class="empty-msg small">Empty inventory</p>';

  const invHTML = inv.length
    ? inv.slice(0, 24).map((d) => skinCardHTML(d)).join("")
    : '<p class="empty-msg small">This player has no skins in their inventory.</p>';

  $("#player-modal-content").innerHTML = `
    <div class="player-modal-header">
      ${avatarHTML(entry.profile, 72)}
      <div class="player-modal-id">
        <h3>${entry.profile.name}${entry.isMe ? " <span class='you-tag'>(you)</span>" : ""}</h3>
        <div class="level-row compact">
          <span class="level-badge">LEVEL ${lp.lvl}</span>
          <div class="xp-bar"><div class="xp-fill" style="width:${lp.pct}%"></div></div>
          <span class="xp-text">${Math.round(lp.cur)} / ${lp.needed} XP</span>
        </div>
        <p class="player-modal-meta">Member since ${since} · Balance <strong>${fmt(entry.money)}</strong> · Inventory <strong>${fmt(invTotal)}</strong> (${inv.length} skins)</p>
      </div>
    </div>

    <div class="player-modal-highlights">
      <div class="player-highlight">
        <h4>💎 Best drop ever</h4>
        <div class="player-highlight-card">${bestDropHTML}</div>
      </div>
      <div class="player-highlight">
        <h4>🔪 Best skin owned</h4>
        <div class="player-highlight-card">${bestSkinHTML}</div>
      </div>
    </div>

    <h4 class="player-modal-section">// STATS</h4>
    <div class="stats-grid player-modal-stats">
      ${statCards.map((c) => `
        <div class="stat-card">
          <div class="stat-value" ${c.c ? `style="color:${c.c}"` : ""}>${c.v}</div>
          <div class="stat-label">${c.l}</div>
        </div>`).join("")}
    </div>

    <h4 class="player-modal-section">// INVENTORY <span class="odds-hint">(top ${Math.min(inv.length, 24)} skins)</span></h4>
    <div class="player-modal-inv">${invHTML}</div>`;

  $("#player-modal").classList.remove("hidden");
}

async function renderLeaderboard() {
  if (!lbWired) {
    lbWired = true;
    document.querySelectorAll("#lb-tabs .pill").forEach((p) =>
      p.addEventListener("click", () => {
        lbCategory = p.dataset.lb;
        document.querySelectorAll("#lb-tabs .pill").forEach((b) => b.classList.toggle("active", b === p));
        renderLeaderboard();
      })
    );
  }

  $("#lb-list").innerHTML = '<p class="empty-msg">Loading leaderboard…</p>';

  const cfg = LB_CONFIG[lbCategory];
  const entries = (await fetchEntries())
    .sort((a, b) => cfg.get(b) - cfg.get(a))
    .slice(0, 25);

  _lbCache = entries;

  if (!entries.length) {
    $("#lb-list").innerHTML = '<p class="empty-msg">No players yet — create an account to appear on the leaderboard!</p>';
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  $("#lb-list").innerHTML = entries
    .map((e, i) => `
      <div class="lb-row clickable ${i < 3 ? "podium podium-" + (i + 1) : ""} ${e.isMe ? "me" : ""}" data-lb-idx="${i}" title="View profile">
        <span class="lb-rank">${medals[i] || "#" + (i + 1)}</span>
        ${avatarHTML(e.profile, i < 3 ? 48 : 38)}
        <div class="lb-id">
          <span class="lb-name">${e.profile.name}${e.isMe ? " (you)" : ""}</span>
          <span class="lb-sub">${cfg.text(e)}</span>
        </div>
        <span class="lb-value">${cfg.val(e)}</span>
      </div>`)
    .join("");

  $("#lb-list").querySelectorAll(".lb-row.clickable").forEach((row) =>
    row.addEventListener("click", () => {
      const entry = _lbCache[+row.dataset.lbIdx];
      if (entry) openPlayerProfile(entry);
    })
  );
}
