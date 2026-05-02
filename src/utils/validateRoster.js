export function validateRoster(players) {
  const errors = [];

  for (const p of players) {
    if (!p.hero || String(p.hero).trim() === '') {
      errors.push(`Player ${p.player_index} missing hero`);
    }
    if (!p.role || String(p.role).trim() === '') {
      errors.push(`Player ${p.player_index} missing role`);
    }
  }

  const sides = { blue: [], red: [] };
  for (const p of players) {
    if (!p.role) continue;
    const sideKey = p.player_index <= 5 ? 'blue' : 'red';
    sides[sideKey].push(p.role);
  }

  for (const sideKey of ['blue', 'red']) {
    const counts = {};
    for (const role of sides[sideKey]) {
      counts[role] = (counts[role] || 0) + 1;
    }
    for (const [role, count] of Object.entries(counts)) {
      if (count > 1) {
        const label = sideKey === 'blue' ? 'Blue' : 'Red';
        errors.push(`${label} side has ${count}x ${role}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}
