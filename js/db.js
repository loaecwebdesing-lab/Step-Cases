/* =====================================================
   STEP CASES — Supabase data layer
   ===================================================== */

const START_BALANCE = 10;

const DEFAULT_STATS = {
  opened: 0,
  spent: 0,
  won: 0,
  bestDrop: null,
  knives: 0,
  gloves: 0,
  battles: 0,
  battlesWon: 0,
  upgrades: 0,
  upgradesWon: 0,
};

let _client = null;
let _saveTimer = null;
let _pendingSave = null;

function cloudEnabled() {
  const c = window.STEPCASES_CONFIG || {};
  return !!(c.SUPABASE_URL && c.SUPABASE_ANON_KEY && typeof supabase !== "undefined");
}

function getClient() {
  if (!cloudEnabled()) return null;
  if (!_client) {
    const c = window.STEPCASES_CONFIG;
    _client = supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  }
  return _client;
}

function emailForUsername(username) {
  return username.toLowerCase().trim() + "@players.stepcases.app";
}

function profileToState(row) {
  if (!row) return defaultGameState();
  return {
    balance: Number(row.balance),
    inventory: Array.isArray(row.inventory) ? row.inventory : [],
    stats: { ...DEFAULT_STATS, ...(row.stats || {}) },
    lastBonus: Number(row.last_bonus) || 0,
    xp: Number(row.xp) || 0,
  };
}

function stateToRow(state) {
  return {
    balance: state.balance,
    inventory: state.inventory,
    stats: state.stats,
    last_bonus: state.lastBonus,
    xp: state.xp,
  };
}

function defaultGameState() {
  return {
    balance: START_BALANCE,
    inventory: [],
    stats: { ...DEFAULT_STATS },
    lastBonus: 0,
    xp: 0,
  };
}

function rowToUser(row) {
  return {
    id: row.id,
    name: row.username,
    avatarEmoji: row.avatar_emoji,
    avatarColor: row.avatar_color,
    created: new Date(row.created_at).getTime(),
  };
}

async function dbGetSession() {
  const client = getClient();
  if (!client) return null;
  const { data } = await client.auth.getSession();
  return data.session;
}

async function dbFetchProfile(userId) {
  const client = getClient();
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

async function dbEnsureProfile(userId, meta = {}) {
  const client = getClient();
  if (!client || !userId) return null;

  const { data: existing, error: readErr } = await client
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing;

  const username = String(meta.username || "Player").trim() || "Player";
  const { error } = await client.from("profiles").insert({
    id: userId,
    username,
    avatar_emoji: meta.avatar_emoji || "🦊",
    avatar_color: meta.avatar_color || "#ff6b35",
    balance: START_BALANCE,
  });
  if (error) {
    if (error.code === "23505") return { id: userId };
    throw error;
  }
  return { id: userId };
}

function profileMetaFromAuthUser(user) {
  if (!user) return {};
  return {
    username: user.user_metadata?.username || user.email?.split("@")[0] || "Player",
    avatar_emoji: user.user_metadata?.avatar_emoji,
    avatar_color: user.user_metadata?.avatar_color,
  };
}

async function dbFetchProfileByUsername(username) {
  const client = getClient();
  const { data } = await client.from("profiles").select("id").eq("username", username.toLowerCase()).maybeSingle();
  return data;
}

async function dbUpsertProfile(userId, patch) {
  const client = getClient();
  const { error } = await client.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

async function dbSaveGameState(userId, gameState) {
  await dbUpsertProfile(userId, stateToRow(gameState));
}

function scheduleCloudSave(userId, gameState) {
  if (!userId) return;
  _pendingSave = { userId, gameState: JSON.parse(JSON.stringify(gameState)) };
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    if (!_pendingSave) return;
    const { userId: uid, gameState: gs } = _pendingSave;
    _pendingSave = null;
    try {
      await dbSaveGameState(uid, gs);
    } catch (e) {
      console.error("Cloud save failed:", e);
    }
  }, 800);
}

async function dbFlushSave() {
  if (!_pendingSave) return;
  const { userId, gameState } = _pendingSave;
  _pendingSave = null;
  clearTimeout(_saveTimer);
  await dbSaveGameState(userId, gameState);
}

async function dbFetchLeaderboard() {
  const client = getClient();
  if (!client) return [];

  const { data: rpcData, error: rpcError } = await client.rpc("get_leaderboard");
  if (!rpcError && Array.isArray(rpcData)) return rpcData;
  if (rpcError) console.warn("Leaderboard RPC failed, fallback to direct query:", rpcError.message);

  const { data, error } = await client
    .from("profiles")
    .select("id, username, avatar_emoji, avatar_color, balance, inventory, stats, xp, created_at")
    .order("balance", { ascending: false })
    .limit(100);
  if (error) {
    console.error("Leaderboard query failed:", error.message);
    throw error;
  }
  return data || [];
}

async function dbSignUp(username, password, avatarEmoji, avatarColor) {
  const client = getClient();
  const taken = await dbFetchProfileByUsername(username);
  if (taken) throw new Error("USERNAME_TAKEN");

  const { data, error } = await client.auth.signUp({
    email: emailForUsername(username),
    password,
    options: {
      data: {
        username: username.trim(),
        avatar_emoji: avatarEmoji,
        avatar_color: avatarColor,
      },
    },
  });
  if (error) throw error;
  if (!data.user) throw new Error("SIGNUP_FAILED");
  await dbEnsureProfile(data.user.id, {
    username: username.trim(),
    avatar_emoji: avatarEmoji,
    avatar_color: avatarColor,
  });
  return data;
}

async function dbSignIn(username, password) {
  const client = getClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: emailForUsername(username),
    password,
  });
  if (error) throw error;
  if (data.user) {
    await dbEnsureProfile(data.user.id, {
      username: username.trim(),
      avatar_emoji: data.user.user_metadata?.avatar_emoji,
      avatar_color: data.user.user_metadata?.avatar_color,
    });
  }
  return data;
}

async function dbSignOut() {
  const client = getClient();
  if (!client) return;
  await Promise.race([
    client.auth.signOut(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
}
