#!/usr/bin/env python3
"""
SCRAPPER SALA BERLIN — arregla el fallo silencioso del listado (23/08/2026).

  1. "Parsear Listado BERLIN" <- parsers/berlin_listado.js
     Recorre TODAS las paginas (antes solo leia $json, la primera) y corta con
     error si la pagina 1 no vino utilizable, en vez de devolver events: [].
  2. "Generar Paginas": TOTAL_PAGES 4 -> 2. Solo la pagina 1 lleva cartelera (12
     eventos, la 2 ya viene vacia); las 4 de golpe disparaban el 503 del hosting.

Uso:  arreglar_berlin_listado.py [--aplicar]
"""
import json, os, sys, re, urllib.request, datetime

API = os.environ.get('N8N_API_URL', 'http://localhost:5678')
KEY = os.environ['N8N_API_KEY']
WID = 'Bot2Ur1fW6NC9fgv'
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# La API publica rechaza el resto ("settings must NOT have additional properties"):
# este workflow lleva callerPolicy, availableInMCP, binaryMode y timeSavedMode, que
# n8n conserva por su cuenta al no enviarlos (hace merge, no reemplazo).
SETTINGS_OK = {'saveExecutionProgress', 'saveManualExecutions', 'saveDataErrorExecution',
               'saveDataSuccessExecution', 'executionTimeout', 'errorWorkflow',
               'timezone', 'executionOrder'}


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
    bak = os.path.join(backups, f'SCRAPPER_SALA_BERLIN.{stamp}.BACKUP.json')
    with open(bak, 'w') as f:
        json.dump(wf, f, indent=1, ensure_ascii=False)
    print(f'   backup -> {bak}')

    tocados = 0
    for n in wf['nodes']:
        if n['name'] == 'Parsear Listado BERLIN':
            nuevo = open(os.path.join(RAIZ, 'parsers/berlin_listado.js')).read()
            if n['parameters'].get('jsCode', '').strip() == nuevo.strip():
                print('   = parser ya actualizado')
                continue
            n['parameters']['jsCode'] = nuevo
            print('   ~ Parsear Listado BERLIN  <- parsers/berlin_listado.js')
            tocados += 1
        elif n['name'] == 'Generar Paginas':
            js = n['parameters']['jsCode']
            # se traga el comentario que ya hubiera para poder repetirlo sin duplicarlo
            nuevo = re.sub(r'const TOTAL_PAGES = \d+;(?:[ \t]*//[^\n]*)?',
                           'const TOTAL_PAGES = 2;   // solo la 1 lleva cartelera; 4 de golpe disparaban el 503',
                           js)
            if nuevo == js:
                print('   = Generar Paginas sin cambios')
                continue
            n['parameters']['jsCode'] = nuevo
            print('   ~ Generar Paginas: TOTAL_PAGES -> 2')
            tocados += 1

    if not tocados:
        print('   nada que subir.')
        return 0
    if not aplicar:
        print('   DRY-RUN: no se ha subido nada. Repite con --aplicar')
        return 0

    api(f'workflows/{WID}', 'PUT', {
        'name': wf['name'], 'nodes': wf['nodes'],
        'connections': wf['connections'],
        'settings': {k: v for k, v in wf.get('settings', {}).items() if k in SETTINGS_OK},
    })
    print(f'   APLICADO ({tocados} nodo/s)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
