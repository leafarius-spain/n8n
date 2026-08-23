const cheerio = require('cheerio');

function clean(t) { return String(t || '').replace(/\s+/g, ' ').trim(); }
function normalize(t) { return clean(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(); }

const NOT_ESPECTACULO_BASE = /TALLER|MASTERCLASS|MASTER\s+CLASS|WORKSHOP|CURSO|CLASE\s+DE|INTERCAMBIO|APERITIVO|CHARLA|COLOQUIO|CONFERENCIA|MESA\s+REDONDA|JORNADA\s+DE\s+CONVIVENCIA|VISITA\s+GUIADA|RUTA\s+GUIADA|DEPORTE|ESCAPE\s+ROOM|TARJETA\s+REGALO|GIFT\s+CARD|YELMO/;
const ES_CINE = /CINE|PELICULA|FILM\b|PROYECCION/;
const PRECIO_MINIMO = 12;

const MONTHS_ES = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SEPT: '09', OCTUBRE: '10',
  NOVIEMBRE: '11', DICIEMBRE: '12',
  ENE: '01', FEB: '02', MAR: '03', ABR: '04', MAY: '05', JUN: '06',
  JUL: '07', AGO: '08', SEP: '09', OCT: '10', NOV: '11', DIC: '12',
};

function parseFechaDeTitulo(titulo) {
  // Formatos: "16 MAYO – COMPRO ORO + ORINA" / "9 mayo – LORNA" / "30 MAYO – Desert" / "1 AGOSTO"
  // Devuelve { fecha_inicio (YYYY-MM-DD), titulo_limpio (sin la fecha), mes }
  const norm = normalize(titulo);
  const m = norm.match(/^\s*(\d{1,2})\s+(?:DE\s+)?([A-Z]+)\s*[–-]\s*(.*)$/);
  if (!m) return { fecha_inicio: '', titulo_limpio: titulo, mes: '' };
  const dia = m[1];
  const mes = MONTHS_ES[m[2]];
  if (!mes) return { fecha_inicio: '', titulo_limpio: titulo, mes: '' };
  // El año se infiere: si el mes/dia es anterior al actual, asumir año siguiente
  const today = new Date();
  const yyyy = today.getUTCFullYear();
  const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(today.getUTCDate()).padStart(2, '0');
  const candidato = yyyy + '-' + mes + '-' + String(dia).padStart(2, '0');
  let anio = yyyy;
  if (candidato < (yyyy + '-' + mm + '-' + dd)) anio = yyyy + 1;
  // Limpia titulo: quitamos la parte de la fecha del título original (no el normalizado)
  const tit_clean = String(titulo).replace(/^\s*\d{1,2}\s+(?:de\s+|DE\s+)?[A-Za-zñÑÁÉÍÓÚáéíóú]+\s*[–-]\s*/, '').trim();
  return { fecha_inicio: anio + '-' + mes + '-' + String(dia).padStart(2, '0'), titulo_limpio: tit_clean, mes };
}

function detectarPrecioListado(text) {
  const t = String(text || '');
  if (/ENTRADA\s+LIBRE|GRATUIT[OA]|GRATIS/i.test(t)) return 0;
  const matches = [...t.matchAll(/(\d+(?:[.,]\d{1,2})?)\s*€/g)]
    .map((m) => parseFloat(m[1].replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0 && n < 1000);
  return matches.length ? Math.min(...matches) : null;
}

// Sala Berlin: regla general — todo entra. Los precio<12€ se etiquetan como
// 'DISCO 328' en payload_json.tipo_evento. Cine también entra siempre.
function clasificarEspectaculo(tituloNorm, precio) {
  if (NOT_ESPECTACULO_BASE.test(tituloNorm)) return false;
  return true;
}

const seen = new Set();
const events = [];

// Recorre TODAS las paginas descargadas. Antes solo se leia $json (la primera):
// las otras se bajaban y se tiraban, asi que si algun dia la cartelera pasa de una
// pagina, esos eventos no se capturaban nunca.
const paginas = $input.all();

for (let idx = 0; idx < paginas.length; idx++) {
  const j = (paginas[idx] && paginas[idx].json) || {};
  const html = (j.data && (j.data.html || j.data.rawHtml)) || '';
  const status = (j.data && j.data.metadata && j.data.metadata.statusCode) || null;

  // Firecrawl y el scraper local devuelven success=true aunque el origen conteste
  // con una pagina de error: el HTML llega, pero es el del 503. El scraper local
  // ni siquiera trae statusCode, asi que hay que mirar tambien el contenido.
  const paginaError = !html
    || (status && status !== 200)
    || /Service Temporarily Unavailable|error-code|<title>\s*(4|5)\d\d\b/i.test(html.slice(0, 2000));

  if (paginaError) {
    // La pagina 1 lleva la cartelera: si falla, no hay nada que parsear y hay que
    // ENTERARSE. Antes se devolvia events: [] y el workflow acababa en success con
    // cero eventos, en silencio (20, 21 y 22/08/2026, HTTP 503 de berlinalmeria.com).
    if (idx === 0) {
      throw new Error('Sala Berlin: la pagina 1 del listado no vino utilizable (HTTP ' + (status || 'sin codigo') + '). No se parsea nada.');
    }
    continue;   // en las siguientes puede ser simplemente el fin de la paginacion
  }

  const $ = cheerio.load(html);

  $('ul.products li.product, .products .product').each((_, c) => {
    const $c = $(c);
    const $a = $c.find('a').first();
    const href = clean($a.attr('href') || '');
    if (!href) return;
    // Quitamos /producto/ si está y derivamos slug del último segmento.
    const slugMatch = href.match(/\/producto\/([^\/?#]+)/);
    if (!slugMatch) return;
    const slug = slugMatch[1];
    const event_id = 'berlin_' + slug;
    if (seen.has(event_id)) return;
    seen.add(event_id);

    const titulo_raw = clean($c.find('.woocommerce-loop-product__title, h2, h3').first().text());
    if (!titulo_raw) return;

    const priceRaw = clean($c.find('.amount').first().text());
    const cartel_url = clean($c.find('img').first().attr('src') || $c.find('img').first().attr('data-src') || '');

    const fecha = parseFechaDeTitulo(titulo_raw);
    const titNorm = normalize(fecha.titulo_limpio || titulo_raw);
    const precio_listado = detectarPrecioListado(priceRaw);
    const es_espectaculo = clasificarEspectaculo(titNorm, precio_listado);

    events.push({
      event_id,
      name: fecha.titulo_limpio || titulo_raw,
      datetime_text: titulo_raw,
      venue: 'Sala Berlin Social Club',
      event_url: href,
      cartel_url,
      slug,
      fecha_inicio_listado: fecha.fecha_inicio,
      precio_listado,
      descripcion_listado: '',
      es_espectaculo,
      es_cine: ES_CINE.test(titNorm),
      estado_listado: es_espectaculo ? 'En cartelera' : 'Otra actividad',
    });
  });
}

return [{ json: { data: { data: { events } } } }];
