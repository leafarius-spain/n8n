const fs = require('fs');
const F = '/srv/dev/sgae/n8n/parsers/fixtures/';
const src = fs.readFileSync('/srv/dev/sgae/n8n/parsers/wegow_listado.js', 'utf8');
const correr = (items) => new Function('$input', 'require', src)({ all: () => items }, require);
const fix = (f) => ({ json: JSON.parse(fs.readFileSync(F + f, 'utf8')) });

let ok = 0, ko = 0;
const t = (n, fn) => { try { fn(); console.log('  OK   ' + n); ok++; } catch (e) { console.log('  FALLO ' + n + ' -> ' + e.message); ko++; } };
const assert = (c, m) => { if (!c) throw new Error(m); };

t('Almeria sin eventos (count 0 real) -> events: [] SIN lanzar', () => {
  const ev = correr([fix('wegow_almeria_vacio.json')])[0].json.data.data.events;
  assert(ev.length === 0, 'esperaba 0, saco ' + ev.length);
});

t('Granada real (11 eventos, ninguno C15) -> los descarta todos', () => {
  const ev = correr([fix('wegow_granada.json')])[0].json.data.data.events;
  assert(ev.length === 0, 'no deberia colar nada de fuera de C15, colo ' + ev.length);
});

t('municipios C15 -> mapea 4 y descarta Roquetas (no es C15)', () => {
  const ev = correr([fix('wegow_c15_sintetico.json')])[0].json.data.data.events;
  assert(ev.length === 4, 'esperaba 4 (Almeria, Nijar, Viator, Tabernas), saco ' + ev.length);
  const munis = ev.map(e => e.municipio_norm).sort();
  assert(JSON.stringify(munis) === JSON.stringify(['almeria', 'nijar', 'tabernas', 'viator']), 'municipios: ' + munis);
  assert(!ev.some(e => /roquetas/i.test(e.venue_city)), 'Roquetas no es C15 y ha entrado');
});

t('campos que espera el resto del workflow', () => {
  const e = correr([fix('wegow_c15_sintetico.json')])[0].json.data.data.events[0];
  for (const k of ['event_id', 'name', 'event_url', 'cartel_url', 'slug', 'fecha_inicio_listado',
                   'hora_listado', 'venue_name', 'venue_city', 'municipio_norm', 'es_espectaculo', 'estado_listado'])
    assert(e[k] !== undefined, 'falta el campo ' + k);
  assert(/^wegow_/.test(e.event_id), 'event_id sin prefijo: ' + e.event_id);
  assert(/^\d{4}-\d{2}-\d{2}$/.test(e.fecha_inicio_listado), 'fecha mal: ' + e.fecha_inicio_listado);
  assert(/^\d{2}:\d{2}$/.test(e.hora_listado), 'hora mal: ' + e.hora_listado);
  assert(/^https?:\/\//.test(e.event_url), 'url mal: ' + e.event_url);
});

t('respuesta inutil (sin array events) -> LANZA, no devuelve vacio', () => {
  let lanzo = false;
  try { correr([{ json: { detail: 'Not found' } }]); } catch (e) { lanzo = /no trae el array/.test(e.message); }
  assert(lanzo, 'se tragaria una respuesta rota como si fueran 0 eventos');
});

t('varias paginas: acumula y deduplica', () => {
  const ev = correr([fix('wegow_c15_sintetico.json'), fix('wegow_c15_sintetico.json')])[0].json.data.data.events;
  assert(ev.length === 4, 'la dedup por event_id fallo: ' + ev.length);
});

console.log(`\n${ok} ok, ${ko} fallos`);
process.exit(ko ? 1 : 0);
