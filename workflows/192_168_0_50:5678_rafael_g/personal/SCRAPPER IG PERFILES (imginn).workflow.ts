import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SCRAPPER IG PERFILES (imginn)
// Nodes   : 22  |  Connections: 26
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ScheduleTrigger                    scheduleTrigger
// ManualTrigger                      manualTrigger
// WebhookTrigger                     webhook
// LoadCuentasIg                      postgres                   [creds]
// ScrapePerfil                       firecrawl                  [onError→regular] [creds] [retry]
// ParsearRejillaIg                   code
// SplitOut                           splitOut
// NormalizarTitulo                   code
// UpsertRawFrontEventos              postgres                   [creds] [alwaysOutput]
// SelectPendientesDetalle            postgres                   [creds]
// LoopEventos                        splitInBatches
// DescargarImagen                    httpRequest                [onError→regular] [retry]
// OcrCartel                          httpRequest                [onError→regular] [retry]
// ConsolidarDetalle                  code
// UpsertRawDetalleEventos            postgres                   [creds]
// ValidarUrlImagen                   code
// ImagenPermitida                    if
// PrepararAdjuntoIg                  code                       [onError→regular] [alwaysOutput]
// HayCartel                          if
// DescargarCartel                    httpRequest                [onError→out(1)] [retry]
// GuardarCartelDropbox               dropbox                    [onError→out(1)] [creds] [retry]
// RegistrarAdjuntoIg                 postgres                   [onError→regular] [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ScheduleTrigger
//    → LoadCuentasIg
//      → ScrapePerfil
//        → ParsearRejillaIg
//          → SplitOut
//            → NormalizarTitulo
//              → UpsertRawFrontEventos
//                → SelectPendientesDetalle
//                  → LoopEventos
//                   .out(1) → ValidarUrlImagen
//                      → ImagenPermitida
//                        → DescargarImagen
//                          → OcrCartel
//                            → ConsolidarDetalle
//                              → UpsertRawDetalleEventos
//                                → PrepararAdjuntoIg
//                                  → HayCartel
//                                    → DescargarCartel
//                                      → GuardarCartelDropbox
//                                        → RegistrarAdjuntoIg
//                                          → LoopEventos (↩ loop)
//                                       .out(1) → LoopEventos (↩ loop)
//                                     .out(1) → LoopEventos (↩ loop)
//                                   .out(1) → LoopEventos (↩ loop)
//                       .out(1) → ConsolidarDetalle (↩ loop)
// ManualTrigger
//    → LoadCuentasIg (↩ loop)
// WebhookTrigger
//    → LoadCuentasIg (↩ loop)
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'vWfsXs24OZ6XeBbl',
    name: 'SCRAPPER IG PERFILES (imginn)',
    active: true,
    settings: {
        executionOrder: 'v1',
        timezone: 'Europe/Madrid',
        errorWorkflow: 'IkqnFDu34CjPjXBj',
        executionTimeout: 3600,
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ScrapperIgPerfilesImginnWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 't1',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [-220, 0],
    })
    ScheduleTrigger = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '0 22 * * 1',
                },
            ],
        },
    };

    @node({
        id: 't2',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-220, 160],
    })
    ManualTrigger = {};

    @node({
        id: 't3',
        webhookId: 'ig-perfiles-trigger-test',
        name: 'Webhook Trigger',
        type: 'n8n-nodes-base.webhook',
        version: 2,
        position: [-220, 320],
    })
    WebhookTrigger = {
        httpMethod: 'POST',
        path: 'ig-perfiles-trigger-test',
        options: {},
    };

    @node({
        id: 'n1',
        name: 'Load Cuentas IG',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [0, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    LoadCuentasIg = {
        operation: 'executeQuery',
        query: `SELECT promotor_id, promotor_nombre, url_lista, localidad_default
FROM promotores_configuracion
WHERE fuente_tipo = 'instagram' AND habilitado = true
ORDER BY promotor_id;`,
        options: {},
    };

    @node({
        id: 'n2',
        name: 'Scrape Perfil',
        type: '@mendable/n8n-nodes-firecrawl.firecrawl',
        version: 1,
        position: [220, 0],
        credentials: { firecrawlApi: { id: '3FsKPT3ZQeVfmMkM', name: 'Firecrawl account' } },
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 5000,
    })
    ScrapePerfil = {
        operation: 'scrape',
        url: '={{ $json.url_lista }}',
        scrapeOptions: {
            options: {
                formats: {
                    format: [
                        {
                            type: 'html',
                        },
                    ],
                },
                onlyMainContent: false,
                headers: {},
                waitFor: 6000,
                proxy: 'stealth',
            },
        },
        requestOptions: {},
    };

    @node({
        id: 'n3',
        name: 'Parsear Rejilla IG',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [440, 0],
    })
    ParsearRejillaIg = {
        mode: 'runOnceForEachItem',
        jsCode: `const MESES={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,
  agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12};

// Extrae los datos del evento del caption de Instagram. Los perfiles
// institucionales los escriben con etiquetas fijas (Lugar:/¿Donde?/Dia:/Hora:)
// o en prosa, casi siempre precedidos de emoji.
function extraer(caption, publicadoISO){
  const t=(caption||'').replace(/\\s+/g,' ').trim();
  const bajo=t.toLowerCase();

  // ---- fecha: "23 de julio de 2026" | "jueves, 23 de julio" | "23/07/2026"
  let fecha=null;
  let m=bajo.match(/(\\d{1,2})\\s+de\\s+([a-záéíóú]+)(?:\\s+de\\s+(\\d{4}))?/);
  if(m && MESES[m[2]]){
    const dia=+m[1], mes=MESES[m[2]];
    let anio=m[3]?+m[3]:null;
    if(!anio){ // sin anio: el del post, +1 si el mes ya paso (evita fechas al pasado)
      const p=new Date(publicadoISO||Date.now());
      anio=p.getFullYear();
      if(mes < p.getMonth()+1) anio++;
    }
    fecha=\`\${anio}-\${String(mes).padStart(2,'0')}-\${String(dia).padStart(2,'0')}\`;
  } else if((m=bajo.match(/(\\d{1,2})[\\/-](\\d{1,2})[\\/-](\\d{4})/))){
    fecha=\`\${m[3]}-\${String(+m[2]).padStart(2,'0')}-\${String(+m[1]).padStart(2,'0')}\`;
  }

  // ---- hora
  const h=t.match(/(\\d{1,2})[:.](\\d{2})\\s*h?/i) || t.match(/\\b(\\d{1,2})\\s*h\\b/i);
  const hora=h?\`\${String(h[1]).padStart(2,'0')}:\${h[2]||'00'}\`:'';

  // ---- lugar: tras la etiqueta, cortando en el siguiente campo o emoji.
  // El caption no lleva saltos de linea, asi que tambien se corta cuando una
  // minuscula choca con una mayuscula ("AlmeriaTraete" -> "Almeria").
  let local='';
  const ETIQ=/^\\s*(?:📍|Lugar|Ubicaci[óo]n|¿D[óo]nde\\??)\\s*:?\\s*/i;
  const l=t.match(/(?:📍|Lugar|Ubicaci[óo]n|¿D[óo]nde\\??)\\s*:?\\s*(.{3,90})/i);
  if(l){
    local=l[1];
    while(ETIQ.test(local)) local=local.replace(ETIQ,'');  // "📍 Lugar: X" -> "X"
    local=local
      .split(/[📅⏰💸🎺✨👉🎶🕗💰🎫]/)[0]
      .split(/\\s+(?:D[íi]a|Hora|Fecha|Entrada|Precio)\\s*:/i)[0]
      .replace(/([a-záéíóúñ])([A-ZÁÉÍÓÚÑ])/g,'$1|$2').split('|')[0]
      .replace(/^[:\\s.–-]+|[,.;:\\s]+$/g,'')
      .trim();
  }

  const es_gratuito=/entrada\\s+libre|gratuit|libre hasta completar|acceso libre/i.test(t);
  const pm=t.match(/(\\d+(?:[.,]\\d{1,2})?)\\s*€/);
  const precio=pm?parseFloat(pm[1].replace(',','.')):0;

  return {fecha_inicio:fecha, hora_inicio:hora, local, es_gratuito, precio,
          // cartel de evento si hay fecha y ademas lugar u hora
          es_espectaculo: !!(fecha && (local||hora))};
}

// ---------------------------------------------------------------------------
// Parsea la rejilla de un perfil en imginn (espejo de Instagram).
// Cada .item trae: enlace al post (shortcode), imagen a resolucion completa y,
// en el atributo alt, el caption entero. Con eso basta: no hace falta abrir
// cada post, que costaria 5 creditos de Firecrawl mas por post.
// ---------------------------------------------------------------------------
const cheerio = require('cheerio');

const cuenta = $('Load Cuentas IG').item.json;
const promotorId = cuenta.promotor_id;
const localidad = cuenta.localidad_default || '';

const html = $json.data?.html || $json.html || '';
const $$ = cheerio.load(html);

// "2 hours ago" / "6 days ago" -> fecha ISO de publicacion
function publicado(txt){
  const m = String(txt||'').match(/(\\d+)\\s+(minute|hour|day|week|month|year)s?\\s+ago/i);
  const ahora = new Date();
  if(!m) return ahora.toISOString().slice(0,10);
  const n = +m[1];
  const ms = {minute:6e4, hour:36e5, day:864e5, week:6048e5, month:2592e6, year:31536e6}[m[2].toLowerCase()];
  return new Date(ahora.getTime() - n*ms).toISOString().slice(0,10);
}

// imginn sirve las imagenes por su propio proxy (sN.imginn.com) y ese proxy
// bloquea por IP: tras ~15 descargas devuelve 403 a todo, incluso a URLs que
// acababan de funcionar. Pero la URL lleva dentro los parametros originales de
// Meta, incluido el host (_nc_ht) y la firma (oh/oe), asi que se puede
// reconstruir la URL nativa del CDN de Instagram y descargar de ahi.
// Probado: 12/12 imagenes con el proxy bloqueado. El CDN de Meta no nos limita.
function urlCdnMeta(src) {
  try {
    const p = String(src || '').split('?');
    if (p.length < 3) return src;                    // no tiene el formato esperado
    const path = p[1];                               // t51.82787-15/<fichero>.jpg
    const query = p.slice(2).join('?');
    const host = (query.match(/(?:^|&)_nc_ht=([^&]+)/) || [])[1];
    if (!host || !/\\.cdninstagram\\.com$/.test(host)) return src;
    return \`https://\${host}/v/\${path}?\${query}\`;
  } catch (e) { return src; }
}

// Sede canonica para la clave: solo la parte anterior a la primera coma, que es
// donde va el recinto; lo de despues es el municipio y varia segun el post.
const sede = (s) => String(s||'').split(',')[0].trim();

const slug = (s) => String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'')
  .toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40);

const events = [];
$$('.item').each((i, el) => {
  const $e = $$(el);
  const href = $e.find('a[href*="/p/"]').first().attr('href') || '';
  const shortcode = (href.match(/\\/p\\/([A-Za-z0-9_-]+)/) || [])[1] || '';
  if (!shortcode) return;                    // sin shortcode no hay clave estable

  const img = $e.find('img').first();
  // se guarda la URL nativa de Meta, no la del proxy de imginn (que bloquea)
  const imgUrl = urlCdnMeta(img.attr('src') || '');
  const caption = img.attr('alt') || '';
  const fechaPost = publicado($e.find('.time').text().trim());

  const d = extraer(caption, fechaPost);

  // Clave natural: un CONCIERTO es una entrada, no un post. La cuenta publica
  // varios posts del mismo concierto (cartel + recordatorio) y asi se fusionan
  // solos por el ON CONFLICT. Los posts que no son cartel no tienen fecha, y
  // para esos la clave es el propio shortcode.
  const event_id = d.es_espectaculo
    ? \`\${promotorId}_\${d.fecha_inicio.replace(/-/g,'')}_\${slug(sede(d.local)) || 'sin-lugar'}\`
    : \`\${promotorId}_\${shortcode}\`;

  // Titulo: primera linea util del caption, sin emojis ni hashtags
  const titulo = caption
    .replace(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}\\u{FE0F}\\u{200B}]/gu, ' ')
    .replace(/#\\w+/g, ' ').replace(/\\s+/g, ' ').trim().slice(0, 160)
    || \`Publicacion \${shortcode}\`;

  events.push({
    event_id, name: titulo,
    datetime_text: d.fecha_inicio ? \`\${d.fecha_inicio} \${d.hora_inicio}\`.trim() : fechaPost,
    venue: d.local || localidad,
    event_url: href,
    // todo lo extra va al payload_json, sin tocar el esquema de raw_*
    shortcode, img_url: imgUrl, caption,
    fecha_publicacion: fechaPost,
    fecha_inicio: d.fecha_inicio || '', hora_inicio: d.hora_inicio || '',
    local: d.local || localidad,
    es_gratuito: d.es_gratuito, precio: d.precio,
    es_espectaculo: d.es_espectaculo,
    municipio_norm: slug(localidad),
    fuente: promotorId, source_storefront: promotorId,
  });
});

// Varios posts pueden colapsar al mismo concierto: nos quedamos con el que
// mas caption trae, que suele ser el cartel original y no el recordatorio.
const porId = new Map();
for (const e of events) {
  const prev = porId.get(e.event_id);
  if (!prev || (e.caption || '').length > (prev.caption || '').length) porId.set(e.event_id, e);
}

// modo runOnceForEachItem: se devuelve el objeto, no un array
return { json: { data: { data: { events: [...porId.values()] } } } };
`,
    };

    @node({
        id: 'n4',
        name: 'Split Out',
        type: 'n8n-nodes-base.splitOut',
        version: 1,
        position: [660, 0],
    })
    SplitOut = {
        fieldToSplitOut: 'data.data.events',
        options: {},
    };

    @node({
        id: 'n5',
        name: 'Normalizar Titulo',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [880, 0],
    })
    NormalizarTitulo = {
        mode: 'runOnceForEachItem',
        jsCode: `// Normaliza el titulo al estandar del proyecto (MAYUSCULAS ASCII conservando N)
// y APLANA el item: el Split Out deja el evento bajo un campo literal llamado
// "data.data.events", y ese nombre con puntos rompe las expresiones del
// queryReplacement del nodo Postgres. Aguas abajo se trabaja con campos planos.
const event = $json["data.data.events"] || $json;

let result = String(event.name || '').trim();
result = result.replace(/Ñ/g, '__ENE_MAY__').replace(/ñ/g, '__ENE_MIN__');
result = result.normalize('NFD').replace(/[̀-ͯ]/g, '');
result = result.replace(/__ENE_MAY__/g, 'Ñ').replace(/__ENE_MIN__/g, 'ñ');
result = result.toUpperCase();
result = result.replace(/[^A-ZÑ0-9,.:+\\- ]/g, '');
result = result.replace(/\\s+/g, ' ').trim();

return { json: { ...event, name: result } };
`,
    };

    @node({
        id: 'n6',
        name: 'Upsert raw_front_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1100, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
        alwaysOutputData: true,
        executeOnce: false,
    })
    UpsertRawFrontEventos = {
        operation: 'executeQuery',
        query: `-- SQL parametrizado: los valores viajan como parametros ($1..$7), no
-- concatenados en el texto de la consulta. Es lo unico que aguanta captions
-- de Instagram con comillas, emojis y saltos de linea.
INSERT INTO raw_front_eventos (
    event_id, name, datetime_text, venue, event_url,
    source_storefront, payload_json, last_seen
)
VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
ON CONFLICT (event_id)
DO UPDATE SET
    name = EXCLUDED.name,
    datetime_text = EXCLUDED.datetime_text,
    venue = EXCLUDED.venue,
    event_url = EXCLUDED.event_url,
    source_storefront = EXCLUDED.source_storefront,
    payload_json = EXCLUDED.payload_json,
    last_seen = NOW();`,
        options: {
            queryReplacement:
                '={{ [ $json.event_id, $json.name, $json.datetime_text, $json.venue, $json.event_url, $json.source_storefront, JSON.stringify($json) ] }}',
        },
    };

    @node({
        id: 'n7',
        name: 'Select pendientes detalle',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [1320, 0],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    SelectPendientesDetalle = {
        operation: 'executeQuery',
        query: `-- Pendientes de detalle de TODAS las cuentas de Instagram habilitadas, para
-- que anadir una cuenta sea un INSERT en promotores_configuracion y nada mas.
-- Incluye refresco: un cartel aun por celebrarse se vuelve a mirar cada 7 dias
-- (el OCR es local y gratis, asi que refrescar no cuesta nada).
SELECT f.id, f.event_id, f.name, f.event_url, f.venue, f.payload_json
FROM raw_front_eventos f
LEFT JOIN raw_detalle_eventos d ON f.event_id = d.event_id
WHERE f.source_storefront IN (
        SELECT promotor_id FROM promotores_configuracion
        WHERE fuente_tipo = 'instagram' AND habilitado = true)
  AND COALESCE((f.payload_json->>'es_espectaculo')::boolean, false) = true
  AND (
        d.id IS NULL
     OR (d.fecha_inicio >= now()::date
         AND d.fecha_captura < now() - interval '7 days')
      )
ORDER BY d.fecha_captura ASC NULLS FIRST, f.id
LIMIT 25;`,
        options: {},
    };

    @node({
        id: 'n8',
        name: 'Loop eventos',
        type: 'n8n-nodes-base.splitInBatches',
        version: 3,
        position: [1540, 0],
    })
    LoopEventos = {
        batchSize: 1,
        options: {},
    };

    @node({
        id: 'n9',
        name: 'Descargar Imagen',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1760, 160],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 3000,
    })
    DescargarImagen = {
        url: '={{ $json.payload_json.img_url }}',
        sendHeaders: true,
        specifyHeaders: 'keypair',
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (sgae-c15-scraper)',
                },
                {
                    name: 'Referer',
                    value: 'https://imginn.com/',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                    outputPropertyName: 'data',
                },
            },
        },
    };

    @node({
        id: 'n10',
        name: 'OCR Cartel',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [1980, 160],
        onError: 'continueRegularOutput',
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 5000,
    })
    OcrCartel = {
        method: 'POST',
        url: 'http://172.18.0.1:5000/predict',
        sendBody: true,
        contentType: 'multipart-form-data',
        bodyParameters: {
            parameters: [
                {
                    parameterType: 'formBinaryData',
                    name: 'file',
                    inputDataFieldName: 'data',
                },
            ],
        },
        options: {
            timeout: 120000,
        },
    };

    @node({
        id: 'n11',
        name: 'Consolidar Detalle',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2200, 160],
    })
    ConsolidarDetalle = {
        mode: 'runOnceForEachItem',
        jsCode: `
// Combina las dos fuentes de informacion del post:
//   - el caption  -> lugar, fecha, hora, precio  (ya extraidos en el listado)
//   - la imagen   -> el REPERTORIO, que solo esta en el cartel (via OCR local)
const front = $('Loop eventos').item.json;
const fp = front.payload_json || {};

// El OCR entra por el nodo anterior; si fallo, seguimos sin el (el upsert
// defensivo conserva lo que ya hubiera guardado).
const ocr = $json.OCR_RAW || '';
const ocrScore = Number($json.OCR_SCORE || 0);

const repertorio_ocr = ocrScore >= 60 ? String(ocr).replace(/\\s+/g, ' ').trim() : '';

const fecha_inicio = String(fp.fecha_inicio || '');
const hora = String(fp.hora_inicio || '');

return {
  json: {
    event_id: front.event_id,
    titulo: front.name || '',
    titulo_original: front.name || '',
    observacion: '',
    datetime_text_original: fp.caption ? String(fp.caption).slice(0, 500) : '',
    fecha_inicio,
    fecha_fin: fecha_inicio,
    hora_inicio: hora,
    tipo_fecha: fecha_inicio ? 'simple' : 'texto_no_parseable',
    num_sesiones_estimadas: fecha_inicio ? 1 : null,
    tiene_multiples_sesiones: false,
    precio_entradas: Number(fp.precio || 0),
    precio_medio_entradas: Number(fp.precio || 0),
    local: String(fp.local || front.venue || ''),
    es_gratuito: !!fp.es_gratuito,
    cartel_url: String(fp.img_url || ''),
    screenshot_url: '',
    ticketera_url: '',
    payload_json: {
      fuente: fp.fuente || '',
      tipo_evento: 'CONCIERTO',
      red_social: 'instagram',
      shortcode: fp.shortcode || '',
      post_url: front.event_url || '',
      fecha_publicacion: fp.fecha_publicacion || '',
      caption: fp.caption || '',
      repertorio_ocr,
      ocr_score: ocrScore,
      municipio_norm: fp.municipio_norm || '',
      venue: { name: String(fp.local || '') },
    },
  }
};
`,
    };

    @node({
        id: 'n12',
        name: 'Upsert raw_detalle_eventos',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [2420, 160],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
    })
    UpsertRawDetalleEventos = {
        operation: 'executeQuery',
        query: `-- SQL parametrizado, mismo motivo que el upsert del front.
INSERT INTO raw_detalle_eventos (
    event_id, titulo, titulo_original, observacion,
    datetime_text_original, fecha_inicio, fecha_fin, hora_inicio,
    tipo_fecha, num_sesiones_estimadas, tiene_multiples_sesiones,
    precio_entradas, precio_medio_entradas, local, es_gratuito,
    cartel_url, screenshot_url, ticketera_url, payload_json
)
VALUES ($1, $2, $3, $4, $5,
        NULLIF($6::text,'')::date, NULLIF($7::text,'')::date, $8,
        $9, NULLIF($10::text,'')::int, $11::text::boolean,
        $12::text::numeric, $13::text::numeric, $14, $15::text::boolean,
        $16, $17, $18, $19::text::jsonb)
ON CONFLICT (event_id)
-- Guardas anti-degradacion: un valor nuevo solo pisa al viejo si trae
-- contenido. Si el OCR falla en un refresco, conserva el repertorio ya extraido.
DO UPDATE SET
    titulo = COALESCE(NULLIF(EXCLUDED.titulo,''), raw_detalle_eventos.titulo),
    titulo_original = COALESCE(NULLIF(EXCLUDED.titulo_original,''), raw_detalle_eventos.titulo_original),
    observacion = COALESCE(NULLIF(EXCLUDED.observacion,''), raw_detalle_eventos.observacion),
    datetime_text_original = COALESCE(NULLIF(EXCLUDED.datetime_text_original,''), raw_detalle_eventos.datetime_text_original),
    fecha_inicio = COALESCE(EXCLUDED.fecha_inicio, raw_detalle_eventos.fecha_inicio),
    fecha_fin = COALESCE(EXCLUDED.fecha_fin, raw_detalle_eventos.fecha_fin),
    hora_inicio = COALESCE(NULLIF(EXCLUDED.hora_inicio,''), raw_detalle_eventos.hora_inicio),
    tipo_fecha = CASE WHEN EXCLUDED.tipo_fecha = 'texto_no_parseable'
                        AND raw_detalle_eventos.tipo_fecha <> 'texto_no_parseable'
                      THEN raw_detalle_eventos.tipo_fecha ELSE EXCLUDED.tipo_fecha END,
    num_sesiones_estimadas = COALESCE(EXCLUDED.num_sesiones_estimadas, raw_detalle_eventos.num_sesiones_estimadas),
    tiene_multiples_sesiones = EXCLUDED.tiene_multiples_sesiones,
    precio_entradas = COALESCE(NULLIF(EXCLUDED.precio_entradas,0), raw_detalle_eventos.precio_entradas),
    precio_medio_entradas = COALESCE(NULLIF(EXCLUDED.precio_medio_entradas,0), raw_detalle_eventos.precio_medio_entradas),
    local = COALESCE(NULLIF(EXCLUDED.local,''), raw_detalle_eventos.local),
    es_gratuito = EXCLUDED.es_gratuito,
    cartel_url = COALESCE(NULLIF(EXCLUDED.cartel_url,''), raw_detalle_eventos.cartel_url),
    screenshot_url = COALESCE(NULLIF(EXCLUDED.screenshot_url,''), raw_detalle_eventos.screenshot_url),
    ticketera_url = COALESCE(NULLIF(EXCLUDED.ticketera_url,''), raw_detalle_eventos.ticketera_url),
    payload_json = CASE WHEN EXCLUDED.payload_json = '{}'::jsonb
                        THEN raw_detalle_eventos.payload_json ELSE EXCLUDED.payload_json END,
    fecha_captura = NOW()
-- Si el scrape no trajo ni titulo ni fecha, no se toca la fila; al no refrescar
-- fecha_captura, el evento vuelve a entrar en la proxima pasada.
WHERE EXCLUDED.titulo <> '' OR EXCLUDED.fecha_inicio IS NOT NULL;`,
        options: {
            queryReplacement:
                "={{ [ $json.event_id, $json.titulo, $json.titulo_original, $json.observacion, $json.datetime_text_original, $json.fecha_inicio, $json.fecha_fin, $json.hora_inicio, $json.tipo_fecha, ($json.num_sesiones_estimadas ?? ''), ($json.tiene_multiples_sesiones ? 'true':'false'), ($json.precio_entradas || 0), ($json.precio_medio_entradas || 0), $json.local, ($json.es_gratuito ? 'true':'false'), $json.cartel_url, $json.screenshot_url, $json.ticketera_url, JSON.stringify($json.payload_json || {}) ] }}",
        },
    };

    @node({
        id: 'v1',
        name: 'Validar URL Imagen',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [1720, 300],
    })
    ValidarUrlImagen = {
        mode: 'runOnceForEachItem',
        jsCode: `// Guarda SSRF. La img_url viene del HTML de imginn (un espejo de terceros), y
// este nodo la pide desde DENTRO de la red, donde hay servicios sin autenticar
// (PaddleOCR :5000, scrapegraph-fallback :8021, Postgres). Un HTML manipulado
// podria apuntarla a un host interno o al endpoint de metadatos del cloud.
// Solo se permiten https y los dominios donde imginn sirve sus imagenes.
//
// El parseo es manual y no con new URL(): el sandbox del nodo Code de n8n no
// expone URL como global (probado: lanza y caia todo por 'URL malformada').
const PERMITIDOS = ['imginn.com', 'cdninstagram.com'];

const front = $json;
const url = String((front.payload_json && front.payload_json.img_url) || '').trim();
let img_ok = false;
let motivo = '';

const m = url.match(/^([a-zA-Z][a-zA-Z0-9+.\\-]*):\\/\\/(?:([^@\\/]*)@)?([^\\/:?#]+)/);

if (!url)                                    motivo = 'sin imagen';
else if (!m)                                 motivo = 'URL malformada';
else if (m[1].toLowerCase() !== 'https')     motivo = \`esquema no https: \${m[1]}\`;
else if (m[2])                               motivo = 'credenciales embebidas';
else {
  const host = m[3].toLowerCase();
  // literal IP (v4 o v6): nunca es un CDN legitimo, es la via directa a la red interna
  if (/^\\d{1,3}(\\.\\d{1,3}){3}$/.test(host) || host.indexOf('[') === 0) motivo = 'host es una IP';
  else if (!PERMITIDOS.some(d => host === d || host.endsWith('.' + d)))
                                             motivo = \`dominio no permitido: \${host}\`;
  else img_ok = true;
}

// No se descarta el item: el evento se guarda igual con los datos del caption,
// solo se queda sin el repertorio que aportaria el OCR.
return { json: { ...front, img_ok, img_motivo: motivo } };
`,
    };

    @node({
        id: 'v2',
        name: 'Imagen permitida?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [1900, 300],
    })
    ImagenPermitida = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    leftValue: '={{ $json.img_ok }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'a1',
        name: 'Preparar Adjunto IG',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [2640, 160],
        onError: 'continueRegularOutput',
        alwaysOutputData: true,
    })
    PrepararAdjuntoIg = {
        mode: 'runOnceForEachItem',
        jsCode: `// Misma convencion de ruta que normalizeSegment()/extractExtension() de
// SCRAPPER FLOWTE, para que el cartel caiga donde el resto del sistema lo
// busca: /0-CANCERBERO/EVENTOS/<promotor>/<anio>/<event_id>+<titulo>/cartel.ext
//
// Se lee de 'Consolidar Detalle' con .first() y no con .item: el nodo Postgres
// intermedio no conserva el pairing, y el Loop va de uno en uno (batchSize 1),
// asi que el primer item ES el del evento en curso.
const det = $('Consolidar Detalle').first().json;
const p = det.payload_json || {};

function slug(v, def) {
  const t = String(v || '')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return t || def;
}

const url = String(det.cartel_url || '').trim();

// La extension sale de la URL; si no se puede leer, jpg (es lo que sirve el CDN).
const sinQuery = url.split('?')[0];
const m = sinQuery.match(/\\.([A-Za-z0-9]{2,5})$/);
const ext = m ? m[1].toLowerCase() : 'jpg';

// El promotor de estos eventos es source_storefront, que en IG es igual que
// payload_json.fuente (comprobado sobre las 2.104 filas ig_ del 21/08/2026).
const anio = String(det.fecha_inicio || '').slice(0, 4) || String(new Date().getFullYear());
const carpeta = '/0-CANCERBERO/EVENTOS/' + slug(p.fuente, 'sin-promotor') +
                '/' + anio + '/' + det.event_id + '+' + slug(det.titulo, 'evento');
const nombre = 'cartel.' + ext;

return {
  json: {
    adj_ok: url !== '',
    event_id: det.event_id,
    url_origen: url,
    nombre_archivo: nombre,
    dropbox_path: carpeta + '/' + nombre,
  },
};
`,
    };

    @node({
        id: 'a2',
        name: 'Hay cartel?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [2860, 160],
    })
    HayCartel = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    leftValue: '={{ $json.adj_ok }}',
                    rightValue: true,
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'a3',
        name: 'Descargar Cartel',
        type: 'n8n-nodes-base.httpRequest',
        version: 4.2,
        position: [3080, 160],
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 3000,
    })
    DescargarCartel = {
        url: '={{ $json.url_origen }}',
        sendHeaders: true,
        specifyHeaders: 'keypair',
        headerParameters: {
            parameters: [
                {
                    name: 'User-Agent',
                    value: 'Mozilla/5.0 (sgae-c15-scraper)',
                },
                {
                    name: 'Referer',
                    value: 'https://imginn.com/',
                },
            ],
        },
        options: {
            response: {
                response: {
                    responseFormat: 'file',
                    outputPropertyName: 'data',
                },
            },
        },
    };

    @node({
        id: 'a4',
        name: 'Guardar Cartel Dropbox',
        type: 'n8n-nodes-base.dropbox',
        version: 1,
        position: [3300, 160],
        credentials: { dropboxOAuth2Api: { id: 'mp4rjzvmnH1bwU8C', name: 'Dropbox account' } },
        onError: 'continueErrorOutput',
        retryOnFail: true,
        maxTries: 2,
        waitBetweenTries: 3000,
    })
    GuardarCartelDropbox = {
        authentication: 'oAuth2',
        path: "={{ $('Preparar Adjunto IG').first().json.dropbox_path }}",
        binaryData: true,
    };

    @node({
        id: 'a5',
        name: 'Registrar Adjunto IG',
        type: 'n8n-nodes-base.postgres',
        version: 2.6,
        position: [3520, 160],
        credentials: { postgres: { id: 'zKHsX0gkTrNFTpm5', name: 'Postgres account' } },
        onError: 'continueRegularOutput',
    })
    RegistrarAdjuntoIg = {
        operation: 'executeQuery',
        query: `-- SQL parametrizado (el titulo y la URL traen comillas y acentos).
-- Una sola sentencia: Postgres no admite varias con parametros.
-- El UPDATE solo marca cuando no hay screenshot pendiente; en IG nunca lo hay
-- (Consolidar Detalle deja screenshot_url en ''), y si algun dia lo hubiera se
-- queda sin marcar y lo recoge la cola de SCRAPPER FLOWTE.
WITH ins AS (
    INSERT INTO raw_eventos_adjuntos (
        event_id, tipo, url_origen, url_dropbox, nombre_archivo, fecha_captura
    )
    SELECT $1, 'cartel', $2, $3, $4, NOW()
     WHERE NOT EXISTS (
        SELECT 1 FROM raw_eventos_adjuntos
         WHERE event_id = $1 AND tipo = 'cartel'
     )
    RETURNING 1
)
UPDATE raw_detalle_eventos d
   SET adjuntos_descargados = true
 WHERE d.event_id = $1
   AND COALESCE(d.screenshot_url, '') = '';`,
        options: {
            queryReplacement:
                "={{ [ $('Preparar Adjunto IG').first().json.event_id, $('Preparar Adjunto IG').first().json.url_origen, $('Preparar Adjunto IG').first().json.dropbox_path, $('Preparar Adjunto IG').first().json.nombre_archivo ] }}",
        },
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ScheduleTrigger.out(0).to(this.LoadCuentasIg.in(0));
        this.ManualTrigger.out(0).to(this.LoadCuentasIg.in(0));
        this.WebhookTrigger.out(0).to(this.LoadCuentasIg.in(0));
        this.LoadCuentasIg.out(0).to(this.ScrapePerfil.in(0));
        this.ScrapePerfil.out(0).to(this.ParsearRejillaIg.in(0));
        this.ParsearRejillaIg.out(0).to(this.SplitOut.in(0));
        this.SplitOut.out(0).to(this.NormalizarTitulo.in(0));
        this.NormalizarTitulo.out(0).to(this.UpsertRawFrontEventos.in(0));
        this.UpsertRawFrontEventos.out(0).to(this.SelectPendientesDetalle.in(0));
        this.SelectPendientesDetalle.out(0).to(this.LoopEventos.in(0));
        this.LoopEventos.out(1).to(this.ValidarUrlImagen.in(0));
        this.DescargarImagen.out(0).to(this.OcrCartel.in(0));
        this.OcrCartel.out(0).to(this.ConsolidarDetalle.in(0));
        this.ConsolidarDetalle.out(0).to(this.UpsertRawDetalleEventos.in(0));
        this.UpsertRawDetalleEventos.out(0).to(this.PrepararAdjuntoIg.in(0));
        this.PrepararAdjuntoIg.out(0).to(this.HayCartel.in(0));
        this.HayCartel.out(0).to(this.DescargarCartel.in(0));
        this.HayCartel.out(1).to(this.LoopEventos.in(0));
        this.DescargarCartel.out(0).to(this.GuardarCartelDropbox.in(0));
        this.DescargarCartel.out(1).to(this.LoopEventos.in(0));
        this.GuardarCartelDropbox.out(0).to(this.RegistrarAdjuntoIg.in(0));
        this.GuardarCartelDropbox.out(1).to(this.LoopEventos.in(0));
        this.RegistrarAdjuntoIg.out(0).to(this.LoopEventos.in(0));
        this.ValidarUrlImagen.out(0).to(this.ImagenPermitida.in(0));
        this.ImagenPermitida.out(0).to(this.DescargarImagen.in(0));
        this.ImagenPermitida.out(1).to(this.ConsolidarDetalle.in(0));
    }
}
