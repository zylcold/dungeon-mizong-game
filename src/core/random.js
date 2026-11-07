/** 种子随机、哈希和加权抽样。 */


export function mulberry32(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(input) {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function randomSeed() {
  if (typeof window !== "undefined" && window.crypto && typeof window.crypto.getRandomValues === "function") {
    return window.crypto.getRandomValues(new Uint32Array(1))[0];
  }
  return (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
}

export function parseSeedInput(raw) {
  if (typeof raw === "number" && Number.isFinite(raw) && raw > 0) {
    return (raw >>> 0) || 1;
  }
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^[0-9]+$/u.test(trimmed)) {
    const num = Number(trimmed);
    if (Number.isFinite(num) && num > 0) return (num >>> 0) || 1;
  }
  if (/^[0-9a-fA-F]{1,8}$/u.test(trimmed)) {
    const hex = parseInt(trimmed, 16);
    if (Number.isFinite(hex) && hex > 0) return (hex >>> 0) || 1;
  }
  return hashString(trimmed) || 1;
}

export function dailySeed(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return hashString(`daily-${year}-${month}-${day}`) || 1;
}

export function formatSeedCode(seed) {
  return (((seed >>> 0) || 1).toString(16)).toUpperCase().padStart(8, "0");
}

export function shuffled(items, rng) {
  const output = [...items];
  for (let i = output.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [output[i], output[j]] = [output[j], output[i]];
  }
  return output;
}

export function weightedPick(entries, rng) {
  const total = entries.reduce((sum, entry) => sum + entry.weight, 0);
  let target = rng() * total;
  for (const entry of entries) {
    target -= entry.weight;
    if (target <= 0) return entry.value;
  }
  return entries[entries.length - 1].value;
}
