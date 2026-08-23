const fs = require('fs');
const src = fs.readFileSync('/srv/dev/sgae/n8n/parsers/berlin_listado.js', 'utf8');
const F = '/srv/dev/sgae/n8n/parsers/fixtures/';
const correr = (items) => new Function('$input', 'require', src)({ all: () => items }, require);
const pag = (f, status) => ({ json: { data: { html: fs.readFileSync(f, 'utf8'), ...(status ? { metadata: { statusCode: status } } : {}) } } });

let ok = 0, ko = 0;
const t = (nombre, fn) => { try { fn(); console.log('  OK   ' + nombre); ok++; } catch (e) { console.log('  FALLO ' + nombre + ' -> ' + e.message); ko++; } };
const assert = (c, m) => { if (!c) throw new Error(m); };

t('4 paginas reales (1 con cartelera, 3 vacias) -> 12 eventos', () => {
  const r = correr([pag(F+'berlin_pag1_con_cartelera.html'), pag(F+'berlin_pag2_vacia.html'), pag(F+'berlin_pag2_vacia.html'), pag(F+'berlin_pag2_vacia.html')]);
  const ev = r[0].json.data.data.events;
  assert(ev.length === 12, 'esperaba 12, saco ' + ev.length);
  assert(ev.every(e => e.event_id.startsWith('berlin_')), 'event_id mal formado');
  assert(ev.every(e => e.fecha_inicio_listado), 'hay eventos sin fecha');
});

t('pagina 1 en 503 -> LANZA error (antes devolvia events: [])', () => {
  let lanzo = false;
  try { correr([pag(F+'berlin_503.html'), pag(F+'berlin_pag2_vacia.html')]); } catch (e) { lanzo = /pagina 1 del listado/.test(e.message); }
  assert(lanzo, 'NO lanzo error: se tragaria el 503 otra vez');
});

t('503 en una pagina posterior -> se ignora, la 1 se parsea igual', () => {
  const r = correr([pag(F+'berlin_pag1_con_cartelera.html'), pag(F+'berlin_503.html')]);
  assert(r[0].json.data.data.events.length === 12, 'deberia seguir sacando 12');
});

t('statusCode 503 de Firecrawl con HTML bueno -> tambien lanza', () => {
  let lanzo = false;
  try { correr([pag(F+'berlin_pag1_con_cartelera.html', 503)]); } catch (e) { lanzo = true; }
  assert(lanzo, 'ignoro el statusCode que si trae Firecrawl');
});

t('html vacio en pagina 1 -> lanza', () => {
  let lanzo = false;
  try { correr([{ json: { data: { html: '' } } }]); } catch (e) { lanzo = true; }
  assert(lanzo, 'no lanzo con html vacio');
});

t('cartelera legitimamente vacia (200 sin productos) -> events: [] sin lanzar', () => {
  const r = correr([pag(F+'berlin_pag2_vacia.html')]);
  assert(r[0].json.data.data.events.length === 0, 'deberia devolver 0 sin lanzar');
});

console.log(`\n${ok} ok, ${ko} fallos`);
process.exit(ko ? 1 : 0);
