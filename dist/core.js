export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

// Gesture direction controls aim. Any deliberate upward flick reaches the target.
export function measureThrow({ dx, dy, width, height, tap = false }, target) {
  if (![dx, dy, width, height, target.x, target.y].every(Number.isFinite) || width <= 0 || height <= 0) return null;
  if (!tap && dy < Math.max(25, height * 0.035)) return null;
  const x = tap ? target.x : clamp(0.5 + (dx / Math.max(dy, 30)) * 0.4, -0.3, 1.3);
  const y = tap ? target.y : 0.5 + clamp((0.13 - dy / height) * 0.9, -0.025, 0.2);
  const distance = Math.hypot((x - target.x) * width, (y - target.y) * height);
  return { x, y, hit: distance <= width * 0.165, accuracy: clamp(1 - distance / (width * 0.165), 0, 1) };
}

export function throwQuality(ring, accuracy) {
  if (accuracy > 0.65 && ring < 0.43) return 'Excellent';
  if (accuracy > 0.35 && ring < 0.72) return 'Great';
  return 'Nice';
}

export function catchChance({ quality = 'Nice', berry = false, ultra = false, hits = 0 }) {
  if (hits >= 3) return 1;
  return clamp(0.46 + ({ Nice: 0.04, Great: 0.14, Excellent: 0.25 }[quality] ?? 0) + (berry ? 0.22 : 0) + (ultra ? 0.2 : 0) + Math.max(0, hits - 1) * 0.1, 0.05, 0.97);
}

export function earnedXP(quality, firstThrow) {
  return 100 + ({ Nice: 20, Great: 50, Excellent: 100 }[quality] ?? 0) + (firstThrow ? 50 : 0);
}

export function loadProfile(raw) {
  const data = raw && typeof raw === 'object' ? raw : {};
  const count = (key, fallback, max = 10000000) => Number.isFinite(data[key]) ? Math.floor(clamp(data[key], 0, max)) : fallback;
  return {
    caught: count('caught', 0), xp: count('xp', 0), throws: count('throws', 0),
    berries: count('berries', 12, 99), ultras: count('ultras', 5, 99),
    sound: data.sound === true,
    catches: Array.isArray(data.catches) ? data.catches.filter(c => c && typeof c.date === 'string' && Number.isFinite(Date.parse(c.date)) && ['Nice','Great','Excellent'].includes(c.quality) && Number.isFinite(c.xp)).slice(0, 20) : []
  };
}
