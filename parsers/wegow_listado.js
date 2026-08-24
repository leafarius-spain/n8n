// Wegow — listado desde la API publica (api.wegow.com), no desde el HTML.
//
// La web dejo de aplicar el filtro ?cities=<id>: servia un catalogo mundial
// (Nashville, Hamburgo, Las Vegas...) bajo cualquier cabecera geografica, y el
// unico filtro real acababa siendo la lista C15 de aqui abajo. La API si filtra,
// pero SOLO por administrative_division (provincia); city= tampoco funciona.
// Ver docs/wegow_api_publica.md
//
// Entra: la respuesta JSON de /api/events/  ->  { count, events: [...], next_page }
// Sale : el mismo formato que esperaba el resto del workflow.

const C15 = new Set([
  'almeria','nijar','tabernas','lucainena de las torres','turrillas',
  'huercal de almeria','viator','pechina','rioja','sorbas',
  'alhama de almeria','benahadux','santa fe de mondujar','finana',
  'abla','abrucena','tres villas las','las tres villas','nacimiento','gergal','gador'
]);

function municipioNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[\(\)\[\]\.,;:'"!\?\-–—\/]/g, ' ').replace(/\s+/g, ' ').trim();
}
function detectarMunicipioC15(loc) {
  if (!loc) return null;
  const last = String(loc).split(',').pop().trim();
  const norm = municipioNorm(last);
  if (C15.has(norm)) return norm;
  if (/\btres villas\b/.test(norm)) return 'las tres villas';
  const sinProv = norm.replace(/\s+almeria$/, '').trim();
  if (sinProv !== norm && C15.has(sinProv)) return sinProv;
  return null;
}
function clean(t) { return String(t == null ? '' : t).replace(/\s+/g, ' ').trim(); }

const events = [];
const seenIds = new Set();
const paginas = $input.all();

for (let idx = 0; idx < paginas.length; idx++) {
  const j = (paginas[idx] && paginas[idx].json) || {};
  // El nodo HTTP entrega el JSON ya parseado; si viniera como texto, se intenta igual.
  let cuerpo = j;
  if (typeof j.data === 'string') { try { cuerpo = JSON.parse(j.data); } catch (e) { cuerpo = {}; } }
  else if (j.data && typeof j.data === 'object' && Array.isArray(j.data.events)) cuerpo = j.data;

  // Igual que en Berlin: una respuesta inutil no puede acabar en "0 eventos" en
  // silencio. count: 0 con events: [] SI es valido — Wegow puede no tener nada en
  // la provincia, que es justo el caso de Almeria (comprobado 24/08/2026).
  if (!cuerpo || !Array.isArray(cuerpo.events)) {
    throw new Error('Wegow: la respuesta de la API no trae el array "events" (pagina ' + (idx + 1) + '). No se parsea nada.');
  }

  for (const ev of cuerpo.events) {
    const slug = clean(ev.slug);
    if (!slug) continue;
    const event_id = ('wegow_' + slug).slice(0, 80);
    if (seenIds.has(event_id)) continue;

    const ciudad = clean(ev.city && ev.city.name);
    const muniNorm = detectarMunicipioC15(ciudad);
    if (!muniNorm) continue;   // fuera de la zona C15

    const titulo = clean(ev.title || ev.name);
    if (!titulo) continue;
    seenIds.add(event_id);

    // start_date viene como '2026-09-03T19:30:00Z' pero es hora local de la sala
    // (city.timezone = Europe/Madrid): se toma tal cual, sin convertir.
    const ini = clean(ev.start_date);
    const fin = clean(ev.end_date || ev.start_date);
    const hora = (ini.match(/T(\d{2}:\d{2})/) || [])[1] || '';
    const venue = ev.venue || {};
    const precio = (ev.price == null || isNaN(parseFloat(ev.price))) ? null : parseFloat(ev.price);

    events.push({
      event_id,
      name: titulo,
      datetime_text: ini.slice(0, 10) + (hora ? ' ' + hora : ''),
      venue: clean(venue.name),
      event_url: clean(ev.permalink) || ('https://www.wegow.com/es/conciertos/' + slug),
      cartel_url: clean(ev.image_url),
      slug,
      fecha_inicio_listado: ini.slice(0, 10),
      fecha_fin_listado: fin.slice(0, 10),
      hora_listado: hora,
      venue_name: clean(venue.name),
      venue_address: clean(venue.address || venue.street || ''),
      venue_city: ciudad,
      municipio_norm: muniNorm,
      precio_listado: precio,
      es_espectaculo: true,
      estado_listado: 'A la venta',
    });
  }
}

return [{ json: { data: { data: { events } } } }];
