/* =====================================================
   STEP CASES — Accounts, levels & profile
   Cloud: Supabase Auth + profiles table
   Local fallback when js/config.js is not configured
   ===================================================== */

const AUTH_KEY = "arena-accounts-v1";
const GUEST_SAVE_KEY = "stepcases-guest-v1";

const AVATAR_EMOJIS = ["🦊", "🐺", "🐲", "🦅", "🐯", "👽", "🤖", "💀", "🔥", "⚡", "🎯", "👑"];
const AVATAR_COLORS = ["#ff6b35", "#4b69ff", "#8847ff", "#d32ce6", "#eb4b4b", "#2ecc71", "#00c3ff", "#ffd700"];
window.AVATAR_EMOJIS = AVATAR_EMOJIS;
window.AVATAR_COLORS = AVATAR_COLORS;

let authUser = null; /* { id, name, avatarEmoji, avatarColor, created } */
let authReady = false;
let authMode = "login";
let pickedEmoji = AVATAR_EMOJIS[0];
let pickedColor = AVATAR_COLORS[0];

/* Legacy local-only (offline dev) */
let authReg = { users: {}, current: null };

function useCloud() {
  return typeof cloudEnabled === "function" && cloudEnabled();
}

function currentUser() {
  return authUser;
}

function isLoggedIn() {
  return !!authUser;
}

function authUserId() {
  return authUser?.id || null;
}

function simpleHash(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
}

function levelFromXp(xp) {
  return Math.floor(Math.pow((xp || 0) / 80, 1 / 1.55)) + 1;
}

function levelUpBonus(lvl) {
  return Math.min(lvl * 2, 10);
}

function xpForLevel(lvl) {
  return Math.ceil(80 * Math.pow(lvl - 1, 1.55));
}

function levelProgress(xp) {
  const lvl = levelFromXp(xp);
  const cur = xpForLevel(lvl);
  const next = xpForLevel(lvl + 1);
  return { lvl, pct: Math.min(100, ((xp - cur) / (next - cur)) * 100), cur: xp - cur, needed: next - cur };
}

function avatarHTML(profile, size = 40) {
  const emoji = profile.avatarEmoji || "🦊";
  const color = profile.avatarColor || "#ff6b35";
  return `<span class="avatar" style="width:${size}px;height:${size}px;font-size:${Math.round(size * 0.55)}px;background:radial-gradient(circle at 30% 30%, ${color}66, ${color}22);border-color:${color}">${emoji}</span>`;
}

/* ---------- Local fallback ---------- */
function authLoadLocal() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || { users: {}, current: null };
  } catch (e) {
    return { users: {}, current: null };
  }
}

function authStoreLocal(reg) {
  localStorage.setItem(AUTH_KEY, JSON.stringify(reg));
}

function authTimeout(ms) {
  return new Promise((resolve) => setTimeout(() => resolve(null), ms));
}

async function initAuth() {
  try {
    if (useCloud()) {
      const session = await Promise.race([dbGetSession(), authTimeout(6000)]);
      if (session?.user) {
        try {
          await dbEnsureProfile(session.user.id, profileMetaFromAuthUser(session.user));
          const row = await Promise.race([dbFetchProfile(session.user.id), authTimeout(6000)]);
          if (row) authUser = rowToUser(row);
          else dbSignOut().catch(() => {});
        } catch (e) {
          console.error("Profile load failed:", e);
          dbSignOut().catch(() => {});
        }
      }
    } else {
      authReg = authLoadLocal();
      if (authReg.current && authReg.users[authReg.current]) {
        const u = authReg.users[authReg.current];
        authUser = { id: authReg.current, name: u.name, avatarEmoji: u.avatarEmoji, avatarColor: u.avatarColor, created: u.created };
      }
    }
  } catch (e) {
    console.error("initAuth error:", e);
  }
  authReady = true;
}

function renderUserChip() {
  const chip = document.getElementById("user-chip");
  const user = currentUser();
  if (!user) {
    chip.innerHTML = `<button class="btn-login" id="btn-show-auth">LOG IN</button>`;
    document.getElementById("btn-show-auth").addEventListener("click", () => openAuthModal());
    return;
  }
  const xp = (typeof state !== "undefined" && state.xp) || 0;
  const lp = levelProgress(xp);
  chip.innerHTML = `
    <button class="chip-btn" id="chip-btn">
      ${avatarHTML(user, 36)}
      <span class="chip-info">
        <span class="chip-name">${user.name}</span>
        <span class="chip-level">Lv. ${lp.lvl}</span>
      </span>
    </button>
    <div class="chip-menu hidden" id="chip-menu">
      <button id="menu-profile">👤 My profile</button>
      <button id="menu-logout">🚪 Log out</button>
    </div>`;
  document.getElementById("chip-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("chip-menu").classList.toggle("hidden");
  });
  document.getElementById("menu-profile").addEventListener("click", () => {
    document.getElementById("chip-menu").classList.add("hidden");
    showView("profile");
  });
  document.getElementById("menu-logout").addEventListener("click", async () => {
    if (useCloud()) {
      await dbFlushSave();
      await dbSignOut();
    } else {
      authReg.current = null;
      authStoreLocal(authReg);
    }
    authUser = null;
    location.reload();
  });
  if (!renderUserChip.wired) {
    renderUserChip.wired = true;
    document.addEventListener("click", () => {
      const m = document.getElementById("chip-menu");
      if (m) m.classList.add("hidden");
    });
  }
}

function openAuthModal() {
  document.getElementById("auth-modal").classList.remove("hidden");
  setAuthMode("login");
}

function setAuthMode(mode) {
  authMode = mode;
  document.getElementById("auth-title").textContent = mode === "login" ? "LOG IN" : "CREATE ACCOUNT";
  document.getElementById("auth-submit").textContent = mode === "login" ? "LOG IN" : "CREATE MY ACCOUNT";
  document.getElementById("tab-login").classList.toggle("active", mode === "login");
  document.getElementById("tab-register").classList.toggle("active", mode === "register");
  document.getElementById("avatar-picker").classList.toggle("hidden", mode === "login");
  document.getElementById("auth-error").textContent = "";
  const submit = document.getElementById("auth-submit");
  submit.disabled = false;
  if (mode === "register") renderAvatarPicker();
}

function renderAvatarPicker() {
  const el = document.getElementById("avatar-picker");
  el.innerHTML =
    `<p class="picker-label">Pick your avatar:</p>
     <div class="picker-row">${AVATAR_EMOJIS.map((e) =>
       `<button type="button" class="pick-emoji ${e === pickedEmoji ? "active" : ""}" data-e="${e}">${e}</button>`).join("")}
     </div>
     <div class="picker-row">${AVATAR_COLORS.map((c) =>
       `<button type="button" class="pick-color ${c === pickedColor ? "active" : ""}" data-c="${c}" style="background:${c}"></button>`).join("")}
     </div>
     <div class="picker-preview">${avatarHTML({ avatarEmoji: pickedEmoji, avatarColor: pickedColor }, 56)}</div>`;
  el.querySelectorAll(".pick-emoji").forEach((b) =>
    b.addEventListener("click", () => { pickedEmoji = b.dataset.e; renderAvatarPicker(); }));
  el.querySelectorAll(".pick-color").forEach((b) =>
    b.addEventListener("click", () => { pickedColor = b.dataset.c; renderAvatarPicker(); }));
}

function initAuthModal() {
  document.getElementById("tab-login").addEventListener("click", () => setAuthMode("login"));
  document.getElementById("tab-register").addEventListener("click", () => setAuthMode("register"));

  document.getElementById("auth-modal").addEventListener("click", (e) => {
    if (e.target === document.getElementById("auth-modal")) {
      document.getElementById("auth-modal").classList.add("hidden");
    }
  });

  document.getElementById("auth-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("auth-username").value.trim();
    const pass = document.getElementById("auth-password").value;
    const err = document.getElementById("auth-error");
    const submit = document.getElementById("auth-submit");

    if (name.length < 3) { err.textContent = "Username too short (3 characters min.)"; return; }
    if (pass.length < 4) { err.textContent = "Password too short (4 characters min.)"; return; }

    submit.disabled = true;
    err.textContent = "";

    try {
      if (useCloud()) {
        if (authMode === "register") {
          await dbSignUp(name, pass, pickedEmoji, pickedColor);
        } else {
          await dbSignIn(name, pass);
        }
        location.reload();
        return;
      }

      /* Local fallback */
      const key = name.toLowerCase();
      if (authMode === "register") {
        if (authReg.users[key]) throw new Error("USERNAME_TAKEN");
        authReg.users[key] = {
          name,
          pass: simpleHash(pass),
          avatarEmoji: pickedEmoji,
          avatarColor: pickedColor,
          created: Date.now(),
        };
        authReg.current = key;
        authStoreLocal(authReg);
        localStorage.setItem("arena-save-" + key, JSON.stringify(defaultGameState()));
      } else {
        const user = authReg.users[key];
        if (!user || user.pass !== simpleHash(pass)) throw new Error("BAD_CREDENTIALS");
        authReg.current = key;
        authStoreLocal(authReg);
      }
      location.reload();
    } catch (ex) {
      submit.disabled = false;
      if (ex.message === "USERNAME_TAKEN") err.textContent = "This username already exists!";
      else if (ex.message === "BAD_CREDENTIALS" || ex.message?.includes("Invalid login")) err.textContent = "Incorrect username or password.";
      else err.textContent = ex.message || "Connection error. Try again.";
    }
  });
}

function renderProfileHeader() {
  const el = document.getElementById("profile-header");
  const user = currentUser();
  const xp = (typeof state !== "undefined" && state.xp) || 0;
  const lp = levelProgress(xp);
  const profile = user || { name: "Guest", avatarEmoji: "👤", avatarColor: "#8a91ad" };
  const since = user ? new Date(user.created).toLocaleDateString("en-US") : "—";
  const best = typeof state !== "undefined" && state.stats.bestDrop;
  const bestSkin = typeof state !== "undefined"
    ? (state.inventory || []).reduce((a, b) => (!a || b.price > a.price ? b : a), null)
    : null;

  el.innerHTML = `
    <div class="profile-card">
      ${avatarHTML(profile, 84)}
      <div class="profile-main">
        <h2>${profile.name} ${user ? "" : '<button class="btn-login" id="btn-show-auth2">CREATE ACCOUNT</button>'}</h2>
        <div class="level-row">
          <span class="level-badge">LEVEL ${lp.lvl}</span>
          <div class="xp-bar"><div class="xp-fill" style="width:${lp.pct}%"></div></div>
          <span class="xp-text">${Math.round(lp.cur)} / ${lp.needed} XP</span>
        </div>
        <p class="profile-since">Member since: ${since}</p>
      </div>
      <div class="profile-highlights">
        <div class="profile-highlight-box">
          <span class="best-label">💎 BEST DROP</span>
          ${best ? skinHighlightHTML(best) : '<span class="best-name">No drops yet</span>'}
        </div>
        <div class="profile-highlight-box">
          <span class="best-label">🔪 BEST SKIN</span>
          ${bestSkin ? skinHighlightHTML(bestSkin) : '<span class="best-name">Empty inventory</span>'}
        </div>
      </div>
    </div>`;
  const b = document.getElementById("btn-show-auth2");
  if (b) b.addEventListener("click", () => openAuthModal());
}
