// 삼국무쌍 서바이벌 — 클라우드 저장 + 천하 순위 (Durable Object, 로그인 없음)
const JSONH = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS', 'access-control-allow-headers': 'content-type' };
const ok = (o) => new Response(JSON.stringify(o), { headers: JSONH });
const bad = (m, s = 400) => new Response(JSON.stringify({ error: m }), { status: s, headers: JSONH });
const KEY_RE = /^SG-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: JSONH });
    try {
      if (url.pathname === '/api/ping') return ok({ ok: true });
      if (url.pathname === '/api/save') {
        const key = (url.searchParams.get('key') || '').toUpperCase();
        if (!KEY_RE.test(key)) return bad('bad key');
        const stub = env.STORE.get(env.STORE.idFromName('save:' + key));
        if (req.method === 'GET') return stub.fetch(new Request('https://do/get'));
        if (req.method === 'POST') {
          const body = await req.text();
          if (body.length > 64 * 1024) return bad('too large', 413);
          return stub.fetch(new Request('https://do/put', { method: 'POST', body }));
        }
      }
      if (url.pathname === '/api/board') {
        const stub = env.STORE.get(env.STORE.idFromName('board'));
        if (req.method === 'GET') return stub.fetch(new Request('https://do/board?mode=' + (url.searchParams.get('mode') || 'all') + '&date=' + (url.searchParams.get('date') || '')));
        if (req.method === 'POST') {
          const body = await req.text();
          if (body.length > 4096) return bad('too large', 413);
          return stub.fetch(new Request('https://do/submit', { method: 'POST', body }));
        }
      }
      return bad('not found', 404);
    } catch (e) { return bad('server error', 500); }
  }
};

export class SaveStore {
  constructor(state) { this.state = state; }
  async fetch(req) {
    const url = new URL(req.url);
    const st = this.state.storage;
    if (url.pathname === '/get') {
      const v = await st.get('meta');
      return v ? ok({ meta: v.meta, at: v.at }) : bad('not found', 404);
    }
    if (url.pathname === '/put') {
      let meta; try { meta = JSON.parse(await req.text()); } catch { return bad('bad json'); }
      if (!meta || typeof meta !== 'object' || typeof meta.gold !== 'number') return bad('bad meta');
      await st.put('meta', { meta, at: Date.now() });
      return ok({ ok: true, at: Date.now() });
    }
    if (url.pathname === '/submit') {
      let s; try { s = JSON.parse(await req.text()); } catch { return bad('bad json'); }
      const name = String(s.name || '무명').slice(0, 12), id = String(s.id || '').slice(0, 24);
      const score = Math.max(0, Math.min(9e6, Math.floor(+s.score || 0)));
      if (!id || !score) return bad('bad score');
      const row = { id, name, hero: String(s.hero || '').slice(0, 20), score, time: Math.floor(+s.time || 0), kills: Math.floor(+s.kills || 0), at: Date.now() };
      const all = (await st.get('all')) || [];
      const i = all.findIndex(r => r.id === id);
      if (i < 0) all.push(row); else if (all[i].score < score) all[i] = row; else all[i].name = name;
      all.sort((a, b) => b.score - a.score); all.length = Math.min(all.length, 200);
      await st.put('all', all);
      let drank = 0;
      if (s.daily && /^\d{4}-\d{2}-\d{2}$/.test(s.ddate || '')) {
        const k = 'day:' + s.ddate; const day = (await st.get(k)) || [];
        const j = day.findIndex(r => r.id === id);
        if (j < 0) day.push(row); else if (day[j].score < score) day[j] = row;
        day.sort((a, b) => b.score - a.score); day.length = Math.min(day.length, 200);
        await st.put(k, day); drank = day.findIndex(r => r.id === id) + 1;
      }
      return ok({ ok: true, rank: all.findIndex(r => r.id === id) + 1, drank });
    }
    if (url.pathname === '/board') {
      const mode = url.searchParams.get('mode'), date = url.searchParams.get('date');
      const rows = mode === 'daily' ? ((await st.get('day:' + date)) || []) : ((await st.get('all')) || []);
      return ok({ rows: rows.slice(0, 50).map(r => ({ id: r.id, name: r.name, hero: r.hero, score: r.score, time: r.time, kills: r.kills })) });
    }
    return bad('not found', 404);
  }
}
