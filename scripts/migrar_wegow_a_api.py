#!/usr/bin/env python3
"""
SCRAPPER WEGOW ALMERIA — pasa de raspar el HTML (Firecrawl) a la API publica.

La web dejo de aplicar ?cities=<id>: servia un catalogo mundial bajo cualquier
cabecera geografica, asi que el unico filtro real era la lista C15 del parser.
La API si filtra, pero solo por administrative_division (provincia).
Ver docs/wegow_api_publica.md

  1. "Generar Sitemaps"  -> compone la URL de la API
  2. "Fetch Listado"     -> deja de ser un nodo Firecrawl y pasa a httpRequest
                            (sin onError: un error HTTP debe saltar al ERROR WORKFLOW)
  3. "Parsear Listado"   <- parsers/wegow_listado.js  (JSON en vez de cheerio)

Uso:  migrar_wegow_a_api.py [--aplicar]
"""
import json, os, sys, urllib.request, datetime

API = os.environ.get('N8N_API_URL', 'http://localhost:5678')
KEY = os.environ['N8N_API_KEY']
WID = 'v4mIoAqG4pBpqFis'
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SETTINGS_OK = {'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
               'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow',
               'timezone', 'executionOrder'}

URL_API = ('https://api.wegow.com/api/events/?page=1&page_size=100&count=true'
           '&administrative_division=2521883&country=1&type=0&mongo=true&lang=es&region=es')

GENERAR = """const promoter = ($input.all()[0] && $input.all()[0].json) || {};
// API publica de Wegow. administrative_division=2521883 es la PROVINCIA de Almeria
// (2521886 es la ciudad, y el parametro city= no filtra: devuelve Bilbao, Salamanca...).
// page_size=100 evita paginar; si algun dia se pasa de 100, hay que seguir next_page.
const url = String(promoter.url_lista || '%s');
return [{ json: { ...promoter, url_listado: url } }];""" % URL_API


def api(path, method='GET', payload=None):
    req = urllib.request.Request(f'{API}/api/v1/{path}', method=method)
    req.add_header('X-N8N-API-KEY', KEY)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, data, timeout=60) as r:
        return json.loads(r.read())


def main():
    aplicar = '--aplicar' in sys.argv
    wf = api(f'workflows/{WID}')
    print(f"== {wf['name']} ({WID})  active={wf['active']}")

    backups = os.path.join(RAIZ, 'backups')
    os.makedirs(backups, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    with open(os.path.join(backups, f'SCRAPPER_WEGOW_ALMERIA.{stamp}.BACKUP.json'), 'w') as f:
        json.dump(wf, f, indent=1, ensure_ascii=False)
    print(f'   backup -> backups/SCRAPPER_WEGOW_ALMERIA.{stamp}.BACKUP.json')

    tocados = 0
    for i, n in enumerate(wf['nodes']):
        if n['name'] == 'Generar Sitemaps' and n['parameters'].get('jsCode') != GENERAR:
            n['parameters']['jsCode'] = GENERAR
            print('   ~ Generar Sitemaps: compone la URL de la API'); tocados += 1

        elif n['name'] == 'Parsear Listado':
            nuevo = open(os.path.join(RAIZ, 'parsers/wegow_listado.js')).read()
            if n['parameters'].get('jsCode', '').strip() != nuevo.strip():
                n['parameters']['jsCode'] = nuevo
                print('   ~ Parsear Listado <- parsers/wegow_listado.js'); tocados += 1

        elif n['name'] == 'Fetch Listado' and 'firecrawl' in n['type']:
            # se conserva el NOMBRE para no tocar ninguna conexion
            wf['nodes'][i] = {
                'id': n['id'], 'name': 'Fetch Listado', 'type': 'n8n-nodes-base.httpRequest',
                'typeVersion': 4.4, 'position': n['position'],
                'parameters': {
                    'url': '={{ $json.url_listado }}',
                    'sendHeaders': True,
                    'headerParameters': {'parameters': [
                        {'name': 'Accept', 'value': 'application/json'},
                        {'name': 'User-Agent', 'value': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/147 Safari/537.36'},
                    ]},
                    'options': {'response': {'response': {'neverError': False}}},
                },
            }
            print('   ~ Fetch Listado: firecrawl -> httpRequest (y sin tragarse los errores)')
            tocados += 1

    if not tocados:
        print('   nada que subir.'); return 0
    if not aplicar:
        print('   DRY-RUN: no se ha subido nada. Repite con --aplicar'); return 0

    api(f'workflows/{WID}', 'PUT', {
        'name': wf['name'], 'nodes': wf['nodes'], 'connections': wf['connections'],
        'settings': {k: v for k, v in wf.get('settings', {}).items() if k in SETTINGS_OK},
    })
    print(f'   APLICADO ({tocados} nodo/s)')
    print(f'   RECUERDA: promotores_configuracion.url_lista de wegow_almeria -> {URL_API[:60]}...')
    return 0


if __name__ == '__main__':
    sys.exit(main())
