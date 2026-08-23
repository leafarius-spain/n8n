#!/usr/bin/env python3
"""
Invierte el orden de scraping de un workflow: el scraper local (8021) pasa a ser el
principal y Firecrawl queda de red de seguridad. Ver docs/scrapers_orden_firecrawl.md

    antes:   Firecrawl --ok--> Parsear          ahora:   Local --ok--> Parsear
                       \-err-> Local --> Parsear                 \-err-> Firecrawl --> Parsear

Empareja cada nodo Firecrawl con su Fallback por la conexion de error que YA existe
(Scrape X [out1] -> Fallback Y), asi no depende de como se llamen los nodos.

Uso:  migrar_scraper_local_primero.py <workflowId> [--aplicar]
Sin --aplicar solo enseña lo que haría (dry-run).
"""
import json, os, sys, urllib.request, datetime

API = os.environ.get('N8N_API_URL', 'http://localhost:5678')
KEY = os.environ['N8N_API_KEY']
BACKUP_DIR = os.path.join(os.path.dirname(__file__), '..', 'backups')

FIRECRAWL_TYPE = '@mendable/n8n-nodes-firecrawl.firecrawl'
LOCAL_MARK = '8021/scrape'


def api(path, method='GET', payload=None):
    req = urllib.request.Request(f'{API}/api/v1/{path}', method=method)
    req.add_header('X-N8N-API-KEY', KEY)
    data = None
    if payload is not None:
        data = json.dumps(payload).encode()
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req, data, timeout=60) as r:
        return json.loads(r.read())


def es_local(node):
    return LOCAL_MARK in json.dumps(node.get('parameters', {}))


def parejas(wf):
    """[(nodo_firecrawl, nodo_local)] emparejados por la rama de error existente."""
    byname = {n['name']: n for n in wf['nodes']}
    out = []
    for n in wf['nodes']:
        if n['type'] != FIRECRAWL_TYPE:
            continue
        branches = wf['connections'].get(n['name'], {}).get('main', [])
        if len(branches) < 2 or not branches[1]:
            continue
        for t in branches[1]:
            cand = byname.get(t['node'])
            if cand is not None and es_local(cand):
                out.append((n, cand))
                break
    return out


def migrar(wf):
    conns = wf['connections']
    cambios = []
    for fc, local in parejas(wf):
        fcn, ln = fc['name'], local['name']
        destino_ok = conns.get(fcn, {}).get('main', [[]])[0] or []   # -> Parsear
        # quien alimentaba a Firecrawl pasa a alimentar al local
        for src, c in conns.items():
            for br in c.get('main', []):
                for t in (br or []):
                    if t['node'] == fcn:
                        t['node'] = ln
                        cambios.append(f'{src} -> {ln} (antes -> {fcn})')
        # Firecrawl: solo queda colgando de la rama de error del local
        conns[fcn] = {'main': [destino_ok]}
        conns[ln] = {'main': [list(destino_ok), [{'node': fcn, 'type': 'main', 'index': 0}]]}
        fc['onError'] = 'continueRegularOutput'   # ultimo recurso
        local['onError'] = 'continueErrorOutput'  # su error salta a Firecrawl
        cambios.append(f'{ln} [err] -> {fcn} -> {[d["node"] for d in destino_ok]}')
    return cambios


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    wid, aplicar = sys.argv[1], '--aplicar' in sys.argv
    wf = api(f'workflows/{wid}')
    print(f"== {wf['name']} ({wid})  active={wf['active']}")

    ps = parejas(wf)
    if not ps:
        print('   no hay pares Firecrawl->local que invertir. Nada que hacer.')
        return 1
    for fc, lo in ps:
        print(f"   pareja: {fc['name']}  <->  {lo['name']}")

    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    bak = os.path.join(BACKUP_DIR, f"{wf['name'].replace(' ', '_')}.{stamp}.BACKUP.json")
    with open(bak, 'w') as f:
        json.dump(wf, f, indent=1, ensure_ascii=False)
    print(f'   backup -> {bak}')

    for c in migrar(wf):
        print(f'   * {c}')

    if not aplicar:
        print('   DRY-RUN: no se ha subido nada. Repite con --aplicar')
        return 0

    api(f'workflows/{wid}', 'PUT', {
        'name': wf['name'], 'nodes': wf['nodes'],
        'connections': wf['connections'], 'settings': wf.get('settings', {}),
    })
    print('   APLICADO')
    return 0


if __name__ == '__main__':
    sys.exit(main())
