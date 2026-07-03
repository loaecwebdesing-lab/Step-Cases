/* =====================================================
   ARENA CASES — Base de données skins & caisses CS2
   Les probabilités par rareté imitent Hellcase :
   l'objet le moins cher d'une rareté est plus fréquent
   (pondération inverse au prix, comme les vrais sites).
   ===================================================== */

const RARITIES = {
  consumer:   { label: "Consumer Grade", color: "#b0c3d9" },
  industrial: { label: "Industrial Grade", color: "#5e98d9" },
  milspec:    { label: "Mil-Spec Grade", color: "#4b69ff" },
  restricted: { label: "Restricted", color: "#8847ff" },
  classified: { label: "Classified", color: "#d32ce6" },
  covert:     { label: "Covert", color: "#eb4b4b" },
  special:    { label: "★ Extraordinary", color: "#ffd700" },
};

const WEARS = [
  { key: "FN", label: "Factory New", chance: 3, mult: 1.00 },
  { key: "MW", label: "Minimal Wear", chance: 12, mult: 0.85 },
  { key: "FT", label: "Field-Tested", chance: 38, mult: 0.70 },
  { key: "WW", label: "Well-Worn", chance: 22, mult: 0.55 },
  { key: "BS", label: "Battle-Scarred", chance: 25, mult: 0.45 },
];

const STATTRAK_CHANCE = 7;   // %
const STATTRAK_MULT = 1.8;

// s(arme, nom du skin, rareté, prix de base $, type d'icône)
function s(weapon, name, rarity, price, type) {
  return { weapon, name, rarity, price, type };
}

const CASES = [
  {
    id: "starter",
    name: "Starter Case",
    price: 0.63,
    accent: "#4b69ff",
    tagline: "Perfect for beginners",
    imageOf: "AK-47 | Redline",
    odds: { milspec: 85.4, restricted: 12.5, classified: 1.7, covert: 0.32, special: 0.08 },
    items: [
      s("P250", "Steel Disruption", "milspec", 0.30, "pistol"),
      s("MP9", "Storm", "milspec", 0.25, "smg"),
      s("Nova", "Predator", "milspec", 0.35, "shotgun"),
      s("UMP-45", "Carbon Fiber", "milspec", 0.40, "smg"),
      s("Glock-18", "Candy Apple", "milspec", 0.45, "pistol"),
      s("FAMAS", "Colony", "milspec", 0.28, "rifle"),
      s("AK-47", "Elite Build", "restricted", 2.50, "rifle"),
      s("M4A4", "Evil Daimyo", "restricted", 2.20, "rifle"),
      s("USP-S", "Cyrex", "restricted", 3.50, "pistol"),
      s("P90", "Asiimov", "restricted", 4.00, "smg"),
      s("AWP", "Phobos", "classified", 7.00, "sniper"),
      s("Five-SeveN", "Monkey Business", "classified", 8.00, "pistol"),
      s("M4A1-S", "Cyrex", "covert", 18.00, "rifle"),
      s("AK-47", "Redline", "covert", 25.00, "rifle"),
      s("Navaja Knife", "Safari Mesh", "special", 75.00, "knife"),
      s("Shadow Daggers", "Scorched", "special", 85.00, "knife"),
    ],
  },
  {
    id: "awp-mania",
    name: "AWP Mania",
    price: 3.90,
    accent: "#ff6b35",
    tagline: "100% AWP — every sniper's dream",
    imageOf: "AWP | Dragon Lore",
    odds: { milspec: 83.3, restricted: 13.6, classified: 2.5, covert: 0.57, special: 0.03 },
    items: [
      s("AWP", "Safari Mesh", "milspec", 2.00, "sniper"),
      s("AWP", "Pit Viper", "milspec", 3.00, "sniper"),
      s("AWP", "Worm God", "milspec", 4.00, "sniper"),
      s("AWP", "Atheris", "restricted", 8.00, "sniper"),
      s("AWP", "PAW", "restricted", 9.00, "sniper"),
      s("AWP", "Exoskeleton", "restricted", 10.00, "sniper"),
      s("AWP", "Elite Build", "restricted", 12.00, "sniper"),
      s("AWP", "Chromatic Aberration", "classified", 30.00, "sniper"),
      s("AWP", "Hyper Beast", "classified", 35.00, "sniper"),
      s("AWP", "Neo-Noir", "classified", 40.00, "sniper"),
      s("AWP", "Wildfire", "classified", 60.00, "sniper"),
      s("AWP", "Containment Breach", "covert", 90.00, "sniper"),
      s("AWP", "Asiimov", "covert", 120.00, "sniper"),
      s("AWP", "Fade", "covert", 900.00, "sniper"),
      s("AWP", "Medusa", "special", 5500.00, "sniper"),
      s("AWP", "Gungnir", "special", 9000.00, "sniper"),
      s("AWP", "Dragon Lore", "special", 12000.00, "sniper"),
    ],
  },
  {
    id: "knife-hunt",
    name: "Knife Hunt",
    price: 9.70,
    accent: "#2ecc71",
    tagline: "Boosted knife odds",
    imageOf: "Karambit | Tiger Tooth",
    odds: { restricted: 76, classified: 18, covert: 5, special: 1 },
    items: [
      s("M4A4", "Magnesium", "restricted", 5.00, "rifle"),
      s("AK-47", "Slate", "restricted", 6.00, "rifle"),
      s("Desert Eagle", "Night", "restricted", 9.00, "pistol"),
      s("AK-47", "Ice Coaled", "classified", 18.00, "rifle"),
      s("M4A1-S", "Basilisk", "classified", 20.00, "rifle"),
      s("AK-47", "Asiimov", "covert", 65.00, "rifle"),
      s("M4A1-S", "Player Two", "covert", 70.00, "rifle"),
      s("Gut Knife", "Doppler", "special", 220.00, "knife"),
      s("Falchion Knife", "Slaughter", "special", 350.00, "knife"),
      s("Huntsman Knife", "Tiger Tooth", "special", 400.00, "knife"),
      s("Flip Knife", "Marble Fade", "special", 550.00, "knife"),
      s("Bayonet", "Autotronic", "special", 700.00, "knife"),
      s("M9 Bayonet", "Doppler", "special", 1300.00, "knife"),
      s("Karambit", "Tiger Tooth", "special", 1600.00, "knife"),
      s("Butterfly Knife", "Fade", "special", 2800.00, "knife"),
    ],
  },
  {
    id: "gold-rush",
    name: "Gold Rush",
    price: 77.45,
    accent: "#ffd700",
    tagline: "Elite gloves & knives",
    imageOf: "Sport Gloves | Pandora's Box",
    odds: { restricted: 79.2, classified: 16, covert: 3.5, special: 1.3 },
    items: [
      s("USP-S", "Cortex", "restricted", 12.00, "pistol"),
      s("P250", "See Ya Later", "restricted", 15.00, "pistol"),
      s("AK-47", "Phantom Disruptor", "restricted", 18.00, "rifle"),
      s("AWP", "Containment Breach", "classified", 90.00, "sniper"),
      s("M4A1-S", "Hot Rod", "classified", 200.00, "rifle"),
      s("AK-47", "Vulcan", "classified", 250.00, "rifle"),
      s("AK-47", "Fire Serpent", "covert", 900.00, "rifle"),
      s("Glock-18", "Fade", "covert", 1400.00, "pistol"),
      s("M4A4", "Howl", "covert", 3500.00, "rifle"),
      s("Driver Gloves", "King Snake", "special", 1200.00, "gloves"),
      s("Moto Gloves", "Spearmint", "special", 1500.00, "gloves"),
      s("Specialist Gloves", "Crimson Kimono", "special", 1800.00, "gloves"),
      s("Karambit", "Doppler", "special", 1900.00, "knife"),
      s("Talon Knife", "Fade", "special", 2000.00, "knife"),
      s("Sport Gloves", "Pandora's Box", "special", 2200.00, "gloves"),
      s("Karambit", "Fade", "special", 2400.00, "knife"),
      s("Sport Gloves", "Vice", "special", 2500.00, "gloves"),
      s("Butterfly Knife", "Doppler", "special", 2600.00, "knife"),
    ],
  },
];

/* Silhouettes SVG par type d'arme (viewBox 0 0 120 48) */
const WEAPON_ICONS = {
  rifle:
    '<path d="M4 22 L14 20 L16 16 L20 16 L20 20 L74 18 L112 16 L116 18 L114 22 L78 25 L74 24 L60 25 L58 32 L52 38 L46 38 L50 30 L48 26 L34 27 L30 34 L24 34 L27 26 L14 26 Z"/>',
  sniper:
    '<path d="M2 24 L10 22 L12 26 L28 24 L30 18 L44 18 L46 24 L116 20 L118 23 L112 26 L64 28 L60 34 L54 34 L57 28 L44 29 L40 36 L33 36 L37 28 L12 30 Z M32 12 L44 12 L44 16 L32 16 Z"/>',
  pistol:
    '<path d="M28 12 L92 12 L92 22 L60 22 L58 26 L54 40 L38 40 L44 24 L28 24 Z M84 22 L90 22 L88 30 L82 30 Z"/>',
  smg:
    '<path d="M18 18 L26 14 L30 18 L86 16 L98 18 L98 24 L84 26 L80 24 L66 25 L64 36 L56 36 L58 26 L44 27 L40 34 L34 34 L37 26 L22 26 Z"/>',
  shotgun:
    '<path d="M4 22 L16 18 L20 22 L114 18 L118 21 L114 24 L64 27 L60 32 L48 38 L42 36 L50 28 L30 29 L24 36 L18 36 L22 27 L8 28 Z"/>',
  mg:
    '<path d="M8 20 L20 14 L26 18 L98 16 L112 18 L112 26 L94 28 L90 24 L70 26 L68 40 L58 40 L60 27 L46 28 L42 38 L34 38 L38 27 L14 28 Z M50 28 L54 44 L48 44 L44 28 Z"/>',
  knife:
    '<path d="M6 30 Q30 8 66 12 L70 16 Q46 18 30 26 L72 22 L78 26 L76 30 L98 28 L112 30 L112 36 L96 38 L74 34 L30 36 Q14 36 6 30 Z"/>',
  gloves:
    '<path d="M40 6 L52 6 L54 20 L58 20 L60 8 L70 8 L70 22 L76 14 L86 16 L78 32 L76 42 L44 42 L38 28 L30 22 L36 16 L42 22 Z"/>',
};

/* Shared globals for classic scripts (let/const are not cross-file) */
window.CASES = CASES;
window.RARITIES = RARITIES;
window.WEARS = WEARS;
window.WEAPON_ICONS = WEAPON_ICONS;
window.STATTRAK_CHANCE = STATTRAK_CHANCE;
window.STATTRAK_MULT = STATTRAK_MULT;
