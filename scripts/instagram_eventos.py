"""Backfill de Instagram desde enero 2026 hacia raw_front_eventos / raw_detalle_eventos.

Cadena validada en el piloto:
  perfil paginado en imginn (Firecrawl stealth + clics en "More")  -> 5 creditos/cuenta
  imagen por el CDN nativo de Meta (el proxy de imginn bloquea)    -> gratis
  PaddleOCR local                                                  -> gratis
  qwen2.5:7b con format=json                                       -> gratis, ~9 s/post

Clave natural: <cuenta>_<shortcode>_<AAAAMMDD> para cada evento extraido, y
<cuenta>_<shortcode> para los posts que no son evento. El shortcode la hace
estable y la fecha permite que un programa de fiestas genere N entradas.
"""
import base64, datetime, json, os, re, subprocess, sys, time, urllib.parse, urllib.request
import psycopg2
from psycopg2.extras import RealDictCursor

SCRATCH = os.path.dirname(os.path.abspath(__file__))
MODO = os.environ.get('MODO', 'backfill')      # backfill | seguimiento
# En seguimiento no se pagina: la primera tanda de imginn son 12 posts y ademas
# es la unica que trae caption. Con pasada semanal cubre de sobra lo publicado.
CLICS = 0 if MODO == 'seguimiento' else 8
DESDE = os.environ.get('DESDE', '2026-01-01')
LIMITE_DIAS = 21 if MODO == 'seguimiento' else 205
CHEERIO = '/srv/dev/sgae/n8n/node_modules/cheerio'


def env(path, clave):
    m = re.search(rf'^{clave}=(.*)$', open(path).read(), re.M)
    return m.group(1).strip().strip('"\'') if m else None


FIRECRAWL = env('/srv/dev/sgae/julietta-dev/.env', 'FIRECRAWL_API_KEY')
N8NENV = '/srv/dev/sgae/n8n/.env'
DB = dict(host=env(N8NENV, 'DB_HOST') or '192.168.0.50',
          dbname=env(N8NENV, 'DB_NAME') or 'cancerbero-eventos',
          user=env(N8NENV, 'DB_USER') or 'postgres',
          password=env(N8NENV, 'DB_PASSWORD') or env(N8NENV, 'DB_PASS'))

PROMPT = """Analiza este cartel de un ayuntamiento y devuelve JSON:
{"es_evento":true|false,"motivo":"...","eventos":[{"titulo":"...","fecha":"AAAA-MM-DD","hora":"HH:MM","lugar":"...","tipo":"MUSICA|TEATRO|CINE|DEPORTE|RELIGIOSO|OTRO"}]}
es_evento=false SOLO para: avisos meteorologicos, bandos, luto oficial, campañas de salud o concienciacion, felicitaciones y logos institucionales sin acto convocado.
es_evento=true para cualquier acto publico convocado con fecha (fiestas, romerias, conciertos, teatro, deporte, concursos, rutas, talleres).
Si es un PROGRAMA con varios actos, devuelve TODOS. El OCR trae erratas (ceros por O, palabras pegadas). Año 2026."""


# ---------------------------------------------------------------- utilidades
def cdn_meta(src):
    """La URL del proxy de imginn lleva dentro el host y la firma de Meta."""
    p = src.split('?')
    if len(p) < 3:
        return src
    q = '?'.join(p[2:])
    m = re.search(r'(?:^|&)_nc_ht=([^&]+)', q)
    if not m or not m.group(1).endswith('.cdninstagram.com'):
        return src
    return f"https://{m.group(1)}/v/{p[1]}?{q}"


def dias_desde(txt):
    m = re.match(r'(\d+)\s+(minute|hour|day|week|month|year)', txt or '', re.I)
    if not m:
        return None
    n, u = int(m.group(1)), m.group(2).lower()
    return n * {'minute': 0, 'hour': 0, 'day': 1, 'week': 7, 'month': 30, 'year': 365}[u]


def scrape_perfil(url, cache, clics=None):
    clics = CLICS if clics is None else clics
    if MODO != 'seguimiento' and os.path.exists(cache):
        print(f"    (usando cache {os.path.basename(cache)})", flush=True)
        return open(cache).read()
    acciones = []
    for _ in range(clics):
        acciones += [{"type": "click", "selector": "button.load-more"},
                     {"type": "wait", "milliseconds": 2500}]
    body = {"url": url, "formats": ["html"], "proxy": "stealth",
            "waitFor": 5000, "timeout": 180000}
    if acciones:
        body["actions"] = acciones
    req = urllib.request.Request("https://api.firecrawl.dev/v2/scrape",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json",
                                          "Authorization": "Bearer " + FIRECRAWL})
    d = (json.load(urllib.request.urlopen(req, timeout=300)).get('data') or {})
    html = d.get('html', '')
    open(cache, 'w').write(html)
    return html


def posts_de(html_path):
    js = '''
const cheerio=require(process.argv[2]);
const $=cheerio.load(require('fs').readFileSync(process.argv[1],'utf8'));
const out=[];
$('.item').each((i,el)=>{
  const $e=$(el);
  const href=$e.find('a[href*="/p/"]').first().attr('href')||'';
  const sc=(href.match(/\\/p\\/([\\w-]+)/)||[])[1];
  const img=$e.find('img').first();
  if(sc) out.push({shortcode:sc, src:img.attr('src')||'', alt:img.attr('alt')||'',
                   time:$e.find('.time').text().trim(), post_url:href});
});
console.log(JSON.stringify(out));'''
    r = subprocess.run(['node', '-e', js, html_path, CHEERIO], capture_output=True, text=True)
    return json.loads(r.stdout or '[]')


def ocr(path):
    r = subprocess.run(['curl', '-s', '--max-time', '120', '-F', f'file=@{path}',
                        'http://localhost:5000/predict'], capture_output=True, text=True)
    d = json.loads(r.stdout)
    return str(d.get('OCR_RAW') or ''), float(d.get('OCR_SCORE') or 0)


def extraer_eventos(texto):
    body = {"model": "qwen2.5:7b", "prompt": PROMPT + "\n\nCARTEL:\n" + texto[:1600],
            "stream": False, "format": "json",
            "options": {"temperature": 0, "num_predict": 900}}
    req = urllib.request.Request("http://localhost:11434/api/generate",
                                 data=json.dumps(body).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        return json.loads(json.load(urllib.request.urlopen(req, timeout=300)).get('response', ''))
    except Exception:
        return None


def norm_titulo(s):
    s = str(s or '').strip()
    s = s.replace('Ñ', '__A__').replace('ñ', '__B__')
    s = re.sub(r'[̀-ͯ]', '', __import__('unicodedata').normalize('NFD', s))
    s = s.replace('__A__', 'Ñ').replace('__B__', 'ñ').upper()
    s = re.sub(r'[^A-ZÑ0-9,.:+\- ]', '', s)
    return re.sub(r'\s+', ' ', s).strip()[:200]


SQL_FRONT = """
INSERT INTO raw_front_eventos (event_id,name,datetime_text,venue,event_url,
       source_storefront,payload_json,last_seen)
VALUES (%s,%s,%s,%s,%s,%s,%s::jsonb,NOW())
ON CONFLICT (event_id) DO UPDATE SET
  name=EXCLUDED.name, datetime_text=EXCLUDED.datetime_text, venue=EXCLUDED.venue,
  event_url=EXCLUDED.event_url, source_storefront=EXCLUDED.source_storefront,
  payload_json=EXCLUDED.payload_json, last_seen=NOW();"""

SQL_DET = """
INSERT INTO raw_detalle_eventos (event_id,titulo,titulo_original,observacion,
  datetime_text_original,fecha_inicio,fecha_fin,hora_inicio,tipo_fecha,
  num_sesiones_estimadas,tiene_multiples_sesiones,precio_entradas,
  precio_medio_entradas,local,es_gratuito,cartel_url,screenshot_url,
  ticketera_url,payload_json)
VALUES (%s,%s,%s,%s,%s,NULLIF(%s,'')::date,NULLIF(%s,'')::date,%s,%s,
        NULLIF(%s,'')::int,%s::boolean,0,0,%s,%s::boolean,%s,'','',%s::jsonb)
ON CONFLICT (event_id) DO UPDATE SET
  titulo=COALESCE(NULLIF(EXCLUDED.titulo,''),raw_detalle_eventos.titulo),
  fecha_inicio=COALESCE(EXCLUDED.fecha_inicio,raw_detalle_eventos.fecha_inicio),
  hora_inicio=COALESCE(NULLIF(EXCLUDED.hora_inicio,''),raw_detalle_eventos.hora_inicio),
  local=COALESCE(NULLIF(EXCLUDED.local,''),raw_detalle_eventos.local),
  cartel_url=COALESCE(NULLIF(EXCLUDED.cartel_url,''),raw_detalle_eventos.cartel_url),
  payload_json=CASE WHEN EXCLUDED.payload_json='{}'::jsonb
                    THEN raw_detalle_eventos.payload_json ELSE EXCLUDED.payload_json END,
  fecha_captura=NOW()
WHERE EXCLUDED.titulo <> '' OR EXCLUDED.fecha_inicio IS NOT NULL;"""


def main():
    cn = psycopg2.connect(**DB)
    cn.autocommit = True
    cur = cn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT promotor_id,promotor_nombre,url_lista,localidad_default "
                "FROM promotores_configuracion WHERE fuente_tipo='instagram' AND habilitado ORDER BY 1")
    cuentas = cur.fetchall()
    print(f"MODO={MODO} | cuentas de Instagram habilitadas: {len(cuentas)}\n", flush=True)

    total_ev = total_post = 0
    hechas = set()
    if MODO != 'seguimiento' and os.path.exists(os.path.join(SCRATCH, 'cuentas_completadas.txt')):
        hechas = {l.strip() for l in open(os.path.join(SCRATCH, 'cuentas_completadas.txt')) if l.strip()}
        print(f"se saltan {len(hechas)} cuentas ya completadas\n", flush=True)

    solo = os.environ.get('SOLO', '')          # para probar una cuenta suelta
    for c in cuentas:
        pid = c['promotor_id']
        if pid in hechas:
            continue
        if solo and pid != solo:
            continue
        print(f"=== {pid} ({c['promotor_nombre']})", flush=True)
        cache = os.path.join(SCRATCH, f"bf_{pid}.html")
        # Abla ya se pagino durante las pruebas: se reaprovecha ese HTML
        if pid == 'ig_aytoabla' and os.path.exists(os.path.join(SCRATCH, 'abla_paginado.html')):
            cache = os.path.join(SCRATCH, 'abla_paginado.html')
        try:
            html = scrape_perfil(c['url_lista'], cache)
        except Exception as e:
            print(f"    ERROR scrape: {e}", flush=True)
            continue
        tmp = os.path.join(SCRATCH, f"_tmp_{pid}.html")
        open(tmp, 'w').write(html)
        posts = posts_de(tmp)
        recientes = [p for p in posts
                     if dias_desde(p['time']) is not None and dias_desde(p['time']) <= LIMITE_DIAS]
        print(f"    posts: {len(posts)} | desde {DESDE}: {len(recientes)}", flush=True)

        for i, p in enumerate(recientes):
            total_post += 1
            img_url = cdn_meta(p['src'])
            jpg = f"/tmp/bf_{pid}_{i}.jpg"
            try:
                req = urllib.request.Request(img_url, headers={'User-Agent': 'Mozilla/5.0'})
                open(jpg, 'wb').write(urllib.request.urlopen(req, timeout=60).read())
            except Exception as e:
                print(f"      [{i}] descarga fallida: {getattr(e,'code',e)}", flush=True)
                continue
            texto, score = ocr(jpg)
            caption = p['alt'] or ''
            base = (caption + "\n" + texto).strip() if caption else texto
            j = extraer_eventos(base) if base else None
            os.remove(jpg)

            payload_post = {'fuente': pid, 'red_social': 'instagram',
                            'shortcode': p['shortcode'], 'post_url': p['post_url'],
                            'img_url': img_url, 'caption': caption[:2000],
                            'ocr_score': score, 'repertorio_ocr': texto[:4000],
                            'municipio_norm': (c['localidad_default'] or '').lower()}

            if not j or not j.get('es_evento') or not (j.get('eventos') or []):
                # se guarda igual, marcado, por si cambia el criterio
                eid = f"{pid}_{p['shortcode']}"
                payload_post['es_espectaculo'] = False
                payload_post['motivo_descarte'] = (j or {}).get('motivo', 'sin texto')[:300]
                cur.execute(SQL_FRONT, (eid, norm_titulo(caption or texto)[:200] or 'POST SIN TEXTO',
                                        p['time'], c['localidad_default'] or '', p['post_url'],
                                        pid, json.dumps(payload_post, ensure_ascii=False)))
                continue

            for ev in j['eventos']:
                fecha = str(ev.get('fecha') or '')[:10]
                if not re.match(r'^\d{4}-\d{2}-\d{2}$', fecha):
                    continue
                try:                      # el LLM inventa fechas tipo 2026-16-10
                    datetime.date.fromisoformat(fecha)
                except ValueError:
                    print(f"      fecha invalida descartada: {fecha}", flush=True)
                    continue
                if fecha < DESDE:
                    continue
                eid = f"{pid}_{p['shortcode']}_{fecha.replace('-','')}"
                titulo = norm_titulo(ev.get('titulo'))
                if not titulo:
                    continue
                hora = str(ev.get('hora') or '')[:5]
                lugar = str(ev.get('lugar') or c['localidad_default'] or '')[:200]
                pj = dict(payload_post)
                pj.update({'es_espectaculo': True, 'tipo_evento': ev.get('tipo') or 'OTRO',
                           'extraido_por': 'ocr+qwen2.5:7b'})
                try:
                    cur.execute(SQL_FRONT, (eid, titulo, f"{fecha} {hora}".strip(), lugar,
                                            p['post_url'], pid, json.dumps(pj, ensure_ascii=False)))
                    cur.execute(SQL_DET, (eid, titulo, titulo, '', (caption or texto)[:500],
                                          fecha, fecha, hora, 'simple', '1', False,
                                          lugar, True, img_url, json.dumps(pj, ensure_ascii=False)))
                    total_ev += 1
                except Exception as e:
                    print(f"      evento descartado ({eid}): {str(e)[:90]}", flush=True)
            if (i + 1) % 10 == 0:
                print(f"      {i+1}/{len(recientes)} posts, {total_ev} eventos", flush=True)
                time.sleep(5)   # respiro para PaddleOCR
        print(flush=True)

    print(f"=== FIN: {total_post} posts procesados, {total_ev} eventos insertados")


if __name__ == '__main__':
    main()
