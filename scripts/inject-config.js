/* Netlify build: writes js/config.js from environment variables. */
const fs = require("fs");
const path = require("path");

const url = process.env.SUPABASE_URL || "";
const key = process.env.SUPABASE_ANON_KEY || "";

const out = path.join(__dirname, "..", "js", "config.js");
const content =
  "/* Auto-generated at build — do not edit. */\n" +
  "window.STEPCASES_CONFIG = " +
  JSON.stringify({ SUPABASE_URL: url, SUPABASE_ANON_KEY: key }, null, 2) +
  ";\n";

fs.writeFileSync(out, content);
console.log("config.js written", url ? "(Supabase configured)" : "(WARNING: missing SUPABASE_URL)");
