import fs from 'fs';

// --- tiny CSV parser (handles quoted fields with commas) ---
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && text[i + 1] === '\n') i++;
        row.push(cur); cur = '';
        if (row.some(v => v !== '')) rows.push(row);
        row = [];
      } else cur += c;
    }
  }
  if (cur !== '' || row.length) { row.push(cur); if (row.some(v => v !== '')) rows.push(row); }
  return rows;
}
const v2n = s => { const m = String(s || '').replace(/[\s$]/g, '').replace(/,/g, ''); const n = parseFloat(m); return isFinite(n) ? n : 0; };
const norm = s => String(s || '').trim().toLowerCase().replace(/[_ ]+/g, '');

const D = p => fs.readFileSync('data/' + p, 'utf8');

// ---------- MASTER: S23 players.csv -> name, rank, rating, value ----------
const master = new Map(); // norm -> player
for (const r of parseCSV(D('players.csv'))) {
  const name = (r[1] || '').trim();
  if (!name || name === 'S23 Values + Ratings') continue;
  const rank = (r[2] || '').trim(), rating = parseInt(r[3]), value = v2n(r[4]);
  if (!['X','A','B','C','D'].includes(rank) || !isFinite(rating)) continue;
  master.set(norm(name), { n: name, rk: rank, rt: rating, v: value, tm: 'Free Agent', nt: '', ro: 'Player', hs: {}, st: {} });
}
console.log('master players:', master.size);

// ---------- HUBS: season snapshots {rating,value,team,role,(nation)} ----------
function hub(file, season, cfg) {
  const rows = parseCSV(D(file));
  for (const r of rows) {
    const name = (r[cfg.name] || '').trim();
    if (!name || /username|playersheet/i.test(name) || name === '|') continue;
    const rank = (r[cfg.rank] || '').trim();
    if (!['X','A','B','C','D'].includes(rank)) continue;
    const key = norm(name);
    const rating = cfg.rating != null ? parseInt(r[cfg.rating]) : NaN;
    const value = cfg.value != null ? v2n(r[cfg.value]) : 0;
    const team = cfg.team != null ? (r[cfg.team] || '').trim() : '';
    const role = cfg.role != null ? (r[cfg.role] || '').trim() : '';
    const nation = cfg.nation != null ? (r[cfg.nation] || '').trim() : '';
    let p = master.get(key);
    if (!p) { const rt = isFinite(rating) ? rating : ({X:90,A:85,B:80,C:72,D:64})[rank]; p = { n: name, rk: rank, rt, v: value || 1e7, tm: 'Free Agent', nt: '', ro: 'Player', hs: {}, st: {} }; master.set(key, p); }
    p.hs[season] = { rt: isFinite(rating) ? rating : undefined, v: value || undefined, tm: team || undefined };
    if (season === 's22') {
      if (team) p.tm = team;
      if (role) p.ro = role;
      if (nation) p.nt = nation;
    }
  }
}
hub('s22hub.csv', 's22', { name: 12, rank: 13, value: 14, team: 16, role: 18, nation: 30 });
hub('s21hub.csv', 's21', { name: 7, rank: 8, rating: 9, value: 10, team: 11, role: 12 });
hub('s20hub.csv', 's20', { name: 7, rank: 8, rating: 9, value: 10, team: 11, role: 12 });
hub('x2.csv', 's19', { name: 8, rank: 9, rating: 10, value: 11, team: 12, role: 13 });
hub('x3.csv', 's18', { name: 1, rank: 2, value: 3, team: 5, role: 6 });

// ---------- STATS: goals/assists/CS/MOTM/mentions/cards per season ----------
function stats(file, season, off) {
  const rows = parseCSV(D(file));
  for (const r of rows) {
    const grab = (i, ti, vi) => {
      const name = (r[i] || '').trim();
      const val = parseInt(r[vi]);
      if (!name || !isFinite(val) || /name|rank|player/i.test(name)) return null;
      const key = norm(name);
      let p = master.get(key);
      if (!p) return null; // ignore very old unknown players
      p.st[season] = p.st[season] || {};
      return p.st[season];
    };
    let s;
    if ((s = grab(off.g, off.g + 1, off.g + 2))) { s.g = parseInt(r[off.g + 2]) || 0; }
    if ((s = grab(off.a, off.a + 1, off.a + 2))) { s.a = parseInt(r[off.a + 2]) || 0; }
    if ((s = grab(off.c, off.c + 1, off.c + 2))) { s.cs = parseInt(r[off.c + 2]) || 0; }
    if ((s = grab(off.m, off.m + 1, off.m + 2))) { s.m = parseInt(r[off.m + 2]) || 0; }
    if ((s = grab(off.me, off.me + 1, off.me + 2))) { s.me = parseInt(r[off.me + 2]) || 0; }
  }
}
// layout: goals(2), assists(7), CS(12), MOTM(17), mentions(22), cards(31)
stats('s22stats.csv', 's22', { g: 2, a: 7, c: 12, m: 17, me: 22 });
stats('s21stats.csv', 's21', { g: 2, a: 7, c: 12, m: 17, me: 22 });
stats('s20stats.csv', 's20', { g: 2, a: 7, c: 12, m: 17, me: 22 });
stats('x1.csv', 's19b', { g: 2, a: 7, c: 12, m: 17, me: 22 });
stats('x4.csv', 's18b', { g: 2, a: 7, c: 12, m: 17, me: 22 });
stats('allstats.csv', 's23', { g: 9, a: 16, c: 23, m: 37, me: 44 });

// merge duplicate alt-keys (s18b->s18 etc.)
for (const [, p] of master) {
  for (const [b, t] of [['s18b', 's18'], ['s19b', 's19']]) {
    if (p.st[b]) { p.st[t] = { ...(p.st[t] || {}), ...p.st[b] }; delete p.st[b]; }
  }
}

// ---------- TEAMS ----------
const T1 = ['Real Madrid C.F', 'Tottenham Hotspur', 'Juventus F.C', 'Inter Milan', 'Atletico Madrid', 'Manchester City'];
const T2 = ['Bloxalona United', 'Leon FC', 'Momoyama Predators', 'Spartans United', 'Majesty United', 'Petropolis Lions'];

// count team strengths
const out = { players: [...master.values()], t1: T1, t2: T2 };
// drop players with only-junk single records? keep all.

fs.mkdirSync('src/data', { recursive: true });
fs.writeFileSync('src/data/db.json', JSON.stringify(out));
const kb = Math.round(fs.statSync('src/data/db.json').size / 1024);
console.log('total players:', out.players.length, '| size:', kb + 'KB');
// quick sanity
const teamCount = {};
for (const p of out.players) { if (p.tm && p.tm !== 'Free Agent') teamCount[p.tm] = (teamCount[p.tm] || 0) + 1; }
console.log('tier1 squads:', T1.map(t => `${t}:${teamCount[t] || 0}`).join(' '));
const withStats = out.players.filter(p => Object.keys(p.st).length).length;
console.log('players with any stats:', withStats);
