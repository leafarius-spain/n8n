#!/usr/bin/env python3
"""
Sube las queries de sql/ a los nodos Postgres del workflow VIGILANTE COBERTURA SCRAPERS.
Los .sql del repo son la fuente de verdad; el workflow solo los ejecuta.

    sql/canario_cobertura.sql -> nodo "Detectar Scrapers Mudos"  (el scraper corre pero no lee)
    sql/canario_ejecucion.sql -> nodo "Detectar Parados"         (el scraper no corre)

Uso:  sincronizar_vigilante_sql.py [--aplicar]     (sin --aplicar es dry-run)
"""
import json, os, sys, difflib, urllib.request, datetime

API = os.environ.get('N8N_API_URL', 'http://localhost:5678')
KEY = os.environ['N8N_API_KEY']
WID = 'o51cpZ3iBULHdpvE'
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
MAPA = {
    'Detectar Scrapers Mudos': 'sql/canario_cobertura.sql',
    'Detectar Parados':        'sql/canario_ejecucion.sql',
}


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
    bak = os.path.join(backups, f'VIGILANTE_COBERTURA_SCRAPERS.{stamp}.BACKUP.json')
    with open(bak, 'w') as f:
        json.dump(wf, f, indent=1, ensure_ascii=False)
    print(f'   backup -> {bak}')

    tocados = 0
    for n in wf['nodes']:
        fichero = MAPA.get(n['name'])
        if not fichero:
            continue
        nuevo = open(os.path.join(RAIZ, fichero)).read()
        viejo = n['parameters'].get('query', '')
        if viejo.strip() == nuevo.strip():
            print(f'   = {n["name"]}: ya coincide con {fichero}')
            continue
        print(f'   ~ {n["name"]}  <-  {fichero}')
        for l in difflib.unified_diff(viejo.splitlines(), nuevo.splitlines(),
                                      'n8n', fichero, lineterm='', n=1):
            if l.startswith(('+', '-')) and not l.startswith(('+++', '---')):
                print('       ' + l)
        n['parameters']['query'] = nuevo
        tocados += 1

    if not tocados:
        print('   nada que subir.')
        return 0
    if not aplicar:
        print('   DRY-RUN: no se ha subido nada. Repite con --aplicar')
        return 0

    api(f'workflows/{WID}', 'PUT', {
        'name': wf['name'], 'nodes': wf['nodes'],
        'connections': wf['connections'], 'settings': wf.get('settings', {}),
    })
    print(f'   APLICADO ({tocados} nodo/s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
