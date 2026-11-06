'use strict';
(() => {
  /* ================= CONFIGURACIÓN ================= */
  const CONFIG = {
    // Pegá acá la URL de tu App Web (termina en /exec)
    API_URL: 'https://script.google.com/macros/s/AKfycbwq_P0pVpqMCraHDwPCbJeeFbfgewcs0KofegcPABPnka3Gy8SUJqk3Q7-ircvPQcxy/exec',
    POLL_MS: 30000,          // cada cuánto se actualiza (30 s)
    JITTER_MS: 10000,        // dispersión aleatoria para no pegarle todos juntos
    MAX_BACKOFF_MS: 300000,  // espera máxima si hay errores (5 min)
    TIMEOUT_MS: 15000,
    STORAGE_KEY: 'vsd_newcom_v1',
    ZONA: 'America/Argentina/Cordoba'
  };
  const DEMO = CONFIG.API_URL.includes('TU_ID');

  const DIAS = [
    { id: 'all', txt: 'Todos' }, { id: 'V', txt: 'Viernes' }, { id: 'S', txt: 'Sábado' }
  ];
  const CATS = ['+50', '+60'];
  const CAT_ITEMS = [{ id: 'all', txt: 'Todas' }].concat(CATS.map(c => ({ id: c, txt: c })));
  const DIA_TXT = { V: 'Viernes', S: 'Sábado', D: 'Domingo', O: '' };

  /* ================= ESTADO ================= */
  const $ = id => document.getElementById(id);
  const el = {
    grid: $('grid'), vacio: $('vacio'), filtros: $('filtros'),
    fDia: $('f-dia'), fCat: $('f-cat'),
    estado: $('estado'), estadoTxt: $('estado-txt'), contador: $('contador'),
    tpl: $('tpl-card').content.firstElementChild
  };
  const st = {
    v: null, m: [], dia: 'all', cat: 'all',
    fallos: 0, timer: 0, cargando: false,
    ultimaOk: 0, ultimoIntento: 0,
    vistos: null, nuevos: new Set()
  };

  /* ================= FILTROS ================= */
  function leerHash() {
    const p = new URLSearchParams(location.hash.slice(1));
    const d = p.get('dia'), c = p.get('cat');
    if (d && DIAS.some(x => x.id === d)) st.dia = d;
    else if (!location.hash) st.dia = diaDeHoy();
    st.cat = c && CATS.includes(c) ? c : 'all';
  }
  function escribirHash() {
    const p = new URLSearchParams();
    if (st.dia !== 'all') p.set('dia', st.dia);
    if (st.cat !== 'all') p.set('cat', st.cat);
    const h = p.toString();
    history.replaceState(null, '', h ? '#' + h : location.pathname + location.search);
  }
  function diaDeHoy() {
    try {
      const d = new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: CONFIG.ZONA }).format(new Date());
      return { Fri: 'V', Sat: 'S' }[d] || 'all';
    } catch { return 'all'; }
  }

  function crearChips(cont, items, grupo) {
    const frag = document.createDocumentFragment();
    for (const it of items) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      b.dataset.g = grupo; b.dataset.v = it.id;
      const t = document.createElement('span'); t.textContent = it.txt;
      const n = document.createElement('span'); n.className = 'chip-n';
      b.append(t, n);
      frag.append(b);
    }
    cont.append(frag);
  }

  function actualizarChips() {
    const porDia = { all: 0 }, porCat = { all: 0 };
    for (const x of st.m) {
      if (st.cat === 'all' || x.cat === st.cat) { porDia.all++; porDia[x.dia] = (porDia[x.dia] || 0) + 1; }
      if (st.dia === 'all' || x.dia === st.dia) { porCat.all++; porCat[x.cat] = (porCat[x.cat] || 0) + 1; }
    }
    for (const b of el.filtros.querySelectorAll('.chip')) {
      const esDia = b.dataset.g === 'dia';
      const activo = esDia ? st.dia : st.cat;
      b.setAttribute('aria-pressed', String(b.dataset.v === activo));
      const n = (esDia ? porDia : porCat)[b.dataset.v] || 0;
      b.lastChild.textContent = st.m.length ? String(n) : '';
    }
  }

  el.filtros.addEventListener('click', e => {
    const b = e.target.closest('.chip');
    if (!b) return;
    if (b.dataset.g === 'dia') st.dia = b.dataset.v; else st.cat = b.dataset.v;
    escribirHash();
    render();
  });
  window.addEventListener('hashchange', () => { leerHash(); render(); });

  /* ================= RENDER ================= */
  function tarjeta(x) {
    const n = el.tpl.cloneNode(true);
    n.querySelector('.cat').textContent = 'Categoría ' + x.cat;
    n.querySelector('.cancha-txt').textContent = x.cancha;
    n.querySelector('.when').textContent = [DIA_TXT[x.dia], x.fecha, x.hora && x.hora + ' h'].filter(Boolean).join(' · ');
    if (x.cat === '+60') n.classList.add('c60');

    const [ta, tb] = n.querySelectorAll('.team');
    // El ganador sólo se resalta cuando el partido terminó
    const ganaA = x.fin && x.pa > x.pb, ganaB = x.fin && x.pb > x.pa;
    equipo(ta, x.ea, x.pa, x.sets, 0, ganaA, ganaB);
    equipo(tb, x.eb, x.pb, x.sets, 1, ganaB, ganaA);

    const tag = n.querySelector('.tag');
    if (!x.fin) { n.classList.add('en-juego'); tag.textContent = 'En juego · Set ' + Math.min(x.sets.length + 1, 3); }
    else if (!ganaA && !ganaB) { n.classList.add('empate'); tag.textContent = 'Empate'; }
    else tag.textContent = 'Final';

    if (st.nuevos.has(x.k)) n.classList.add('nuevo');
    const detalle = x.sets.map((z, i) => `set ${i + 1} ${z[0]} a ${z[1]}`).join(', ');
    n.setAttribute('aria-label', `Categoría ${x.cat}, ${x.cancha}. ${x.ea} ${x.pa} sets, ${x.eb} ${x.pb} sets. ${detalle}. ${tag.textContent}`);
    return n;
  }
  function equipo(nodo, nombre, ganados, sets, lado, gana, pierde) {
    nodo.querySelector('.name').textContent = nombre;
    nodo.querySelector('.score').textContent = String(ganados);
    const celdas = nodo.querySelectorAll('.set');
    sets.forEach((z, i) => {
      celdas[i].textContent = String(z[lado]);
      if (z[lado] > z[1 - lado]) celdas[i].classList.add('w');
    });
    if (gana) nodo.classList.add('gana');
    if (pierde) nodo.classList.add('pierde');
  }

  function render() {
    const lista = st.m.filter(x =>
      (st.dia === 'all' || x.dia === st.dia) && (st.cat === 'all' || x.cat === st.cat));
    const frag = document.createDocumentFragment();
    for (const x of lista) frag.append(tarjeta(x));
    el.grid.replaceChildren(frag);
    el.vacio.hidden = lista.length > 0 || (!st.v && !st.ultimaOk && !st.fallos);
    el.contador.textContent = st.v ? `${lista.length} partido${lista.length === 1 ? '' : 's'}` : '';
    actualizarChips();
    st.nuevos.clear();
  }

  /* ================= DATOS ================= */
  const txt = (s, max = 60) => String(s == null ? '' : s).slice(0, max);

  function normalizar(j) {
    if (!j || typeof j !== 'object' || !Array.isArray(j.m)) return null;
    const out = [];
    for (const r of j.m.slice(0, 3000)) {
      if (!Array.isArray(r) || r.length < 9) continue;
      const sets = (Array.isArray(r[9]) ? r[9] : []).slice(0, 3)
        .filter(x => Array.isArray(x) && Number.isInteger(x[0]) && Number.isInteger(x[1]))
        .map(x => [x[0], x[1]]);
      const pa = Number(r[6]), pb = Number(r[8]);
      const cat = txt(r[3]);
      if (!Number.isInteger(pa) || !Number.isInteger(pb) || !CATS.includes(cat)) continue;
      const dia = ['V', 'S', 'D'].includes(r[0]) ? r[0] : 'O';
      const x = {
        dia, fecha: txt(r[1], 5), hora: txt(r[2], 5), cat,
        cancha: txt(r[4]), ea: txt(r[5]), pa, eb: txt(r[7]), pb,
        sets, fin: r[10] !== 'J'
      };
      x.k = [x.fecha, x.cat, x.cancha, x.ea, x.eb].join('|').toLowerCase();
      x.firma = x.k + '|' + sets.map(z => z.join('-')).join(',') + '|' + r[10];
      out.push(x);
    }
    return out;
  }

  function aplicar(j, desdeRed) {
    const m = normalizar(j);
    if (!m) throw new Error('Formato inválido');
    if (j.v === st.v) return;
    // Marcar como "nuevo" sólo lo que llegó por red después de la primera carga
    if (desdeRed && st.vistos) for (const x of m) if (!st.vistos.has(x.firma)) st.nuevos.add(x.k);
    st.vistos = new Set(m.map(x => x.firma));
    st.v = j.v; st.m = m;
    render();
    if (desdeRed) guardarLocal(j);
  }

  function guardarLocal(j) {
    try { localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(j)); } catch { /* sin storage */ }
  }
  function leerLocal() {
    try {
      const s = localStorage.getItem(CONFIG.STORAGE_KEY);
      if (s) aplicar(JSON.parse(s), false);
    } catch { /* ignorar */ }
  }

  async function pedir() {
    if (DEMO) return demo();
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), CONFIG.TIMEOUT_MS);
    try {
      const r = await fetch(CONFIG.API_URL, {
        method: 'GET', cache: 'no-store', credentials: 'omit',
        redirect: 'follow', referrerPolicy: 'no-referrer', signal: ctrl.signal
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(to); }
  }

  async function cargar() {
    if (st.cargando || document.hidden) return;
    st.cargando = true;
    st.ultimoIntento = Date.now();
    try {
      aplicar(await pedir(), true);
      st.fallos = 0;
      st.ultimaOk = Date.now();
    } catch {
      st.fallos++;
      if (!st.v) render();
    } finally {
      st.cargando = false;
      pintarEstado();
      programar(siguienteEspera());
    }
  }

  function siguienteEspera() {
    if (st.fallos) return Math.min(CONFIG.POLL_MS * 2 ** st.fallos, CONFIG.MAX_BACKOFF_MS) * (0.8 + Math.random() * 0.4);
    return CONFIG.POLL_MS + Math.random() * CONFIG.JITTER_MS;
  }
  function programar(ms) {
    clearTimeout(st.timer);
    if (!document.hidden) st.timer = setTimeout(cargar, ms);
  }

  // Si la pestaña no se ve, no consulta: esto baja muchísimo la carga total
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { clearTimeout(st.timer); return; }
    const pasado = Date.now() - st.ultimoIntento;
    programar(Math.max(0, CONFIG.POLL_MS - pasado));
  });
  window.addEventListener('online', () => programar(500));

  /* ================= ESTADO VISUAL ================= */
  function pintarEstado() {
    const err = st.fallos > 0;
    el.estado.classList.toggle('err', err);
    if (err) {
      el.estadoTxt.textContent = st.v ? 'Sin conexión · mostrando últimos datos, reintentando…' : 'No se pudo conectar, reintentando…';
    } else if (st.ultimaOk) {
      const s = Math.round((Date.now() - st.ultimaOk) / 1000);
      el.estadoTxt.textContent = 'En vivo · actualizado ' + (s < 10 ? 'recién' : s < 60 ? `hace ${s} s` : `hace ${Math.floor(s / 60)} min`);
    }
  }
  setInterval(() => { if (!document.hidden) pintarEstado(); }, 10000);

  /* ================= DEMO (si no hay URL configurada) ================= */
  function demo() {
    const eq = ['Club Atlético Rosario', 'Las Leonas de Córdoba', 'Newcom Mendoza', 'Club San Lorenzo', 'Unión de Tandil', 'Las Panteras', 'Club Náutico', 'Abuelos del Sur'];
    const filas = [
      ['V', '13/11', '10:30', '+50', 'Cancha 1', eq[0], 2, eq[1], 0, [[25, 18], [25, 21]], 'F'],
      ['V', '13/11', '11:15', '+60', 'Cancha 2', eq[2], 1, eq[3], 2, [[25, 23], [19, 25], [12, 15]], 'F'],
      ['V', '13/11', '12:00', '+50', 'Cancha 3', eq[4], 1, eq[5], 1, [[25, 20], [22, 25]], 'J'],
      ['S', '14/11', '10:00', '+60', 'Cancha 1', eq[6], 2, eq[7], 1, [[20, 25], [25, 17], [15, 11]], 'F'],
      ['S', '14/11', '10:45', '+50', 'Cancha 2', eq[1], 0, eq[4], 1, [[21, 25]], 'J'],
      ['S', '14/11', '11:30', '+60', 'Cancha 3', eq[3], 0, eq[7], 2, [[18, 25], [23, 25]], 'F']
    ];
    return Promise.resolve({ v: 1, m: filas });
  }

  /* ================= INICIO ================= */
  crearChips(el.fDia, DIAS, 'dia');
  crearChips(el.fCat, CAT_ITEMS, 'cat');
  leerHash();
  leerLocal();               // muestra al instante lo último que vio este navegador
  actualizarChips();
  setTimeout(cargar, Math.random() * 600);
})();
