#!/usr/bin/env python3
"""Baja al Dropbox los carteles pendientes cuya URL todavia esta viva.

Replica la fase de adjuntos de SCRAPPER FLOWTE (nodos "Leer Adjuntos
Pendientes" -> "Preparar Adjunto Dropbox" -> "Guardar en Dropbox" ->
"Registrar Adjunto" -> "Marcar Adjuntos Descargados") pero:

  - escribe por el mount de rclone en vez de por la API de Dropbox,
  - salta las URLs de Instagram cuya firma (parametro oe=) ya caduco, que
    solo darian 403 y bloquean la cabeza de la cola,
  - va de las que menos vida les queda a las que mas.

Uso:  python3 rescatar_adjuntos_pendientes.py [--dry-run] [--limit N]
"""
import argparse
import os
import re
import sys
import unicodedata
from concurrent.futures import ThreadPoolExecutor

import psycopg2
import psycopg2.extras
import requests

# La cadena de conexion NO va escrita aqui. Sale del entorno o del fichero de
# despliegue de Cancerbero (deploy/env/cancerbero-db.env, fuera de este repo).
_ENV_CANCERBERO = "/srv/dev/sgae/cancerbero-v3dev/deploy/env/cancerbero-db.env"


def _leer_dsn() -> str:
    dsn = os.environ.get("CANCERBERO_DSN", "").strip()
    if dsn:
        return dsn
    try:
        with open(_ENV_CANCERBERO) as fh:
            for linea in fh:
                if linea.startswith("DATABASE_URL="):
                    return linea.split("=", 1)[1].strip()
    except OSError:
        pass
    sys.exit(
        "No hay conexion: define CANCERBERO_DSN o deja legible "
        f"{_ENV_CANCERBERO}"
    )


DSN = _leer_dsn()
MOUNT = os.path.expanduser("~/dropbox")
HEADERS = {
    "User-Agent": "Mozilla/5.0 (sgae-c15-scraper)",
    "Referer": "https://imginn.com/",
}

# Misma consulta que el nodo "Leer Adjuntos Pendientes", mas la caducidad de la
# firma de Instagram y sin LIMIT.
SQL_PENDIENTES = """
WITH detail_context AS (
    SELECT d.event_id, d.titulo, d.fecha_captura, d.cartel_url, d.screenshot_url,
           COALESCE(pc.promotor_id, f.source_storefront, 'sin_promotor') AS promotor,
           COALESCE(EXTRACT(YEAR FROM d.fecha_inicio)::text,
                    TO_CHAR(d.fecha_captura, 'YYYY')) AS anio
      FROM raw_detalle_eventos d
      LEFT JOIN raw_front_eventos f ON f.event_id = d.event_id
      LEFT JOIN promotores_configuracion pc
             ON f.event_url LIKE split_part(pc.url_lista, '?', 1) || '%%'
     WHERE (COALESCE(d.cartel_url, '') <> '' OR COALESCE(d.screenshot_url, '') <> '')
       AND COALESCE(d.adjuntos_descargados, false) = false
), pending AS (
    SELECT event_id, 'cartel' AS tipo, cartel_url AS url_origen,
           titulo, fecha_captura, promotor, anio
      FROM detail_context c
     WHERE COALESCE(cartel_url, '') <> ''
       AND NOT EXISTS (SELECT 1 FROM raw_eventos_adjuntos a
                        WHERE a.event_id = c.event_id AND a.tipo = 'cartel')
    UNION ALL
    SELECT event_id, 'screenshot', screenshot_url,
           titulo, fecha_captura, promotor, anio
      FROM detail_context c
     WHERE COALESCE(screenshot_url, '') <> ''
       AND NOT EXISTS (SELECT 1 FROM raw_eventos_adjuntos a
                        WHERE a.event_id = c.event_id AND a.tipo = 'screenshot')
)
SELECT *,
       to_timestamp(('x' || lpad(substring(url_origen from 'oe=([0-9A-Fa-f]+)'),
                                 16, '0'))::bit(64)::bigint) AS expira
  FROM pending
 ORDER BY expira NULLS LAST, fecha_captura, event_id, tipo;
"""

SQL_REGISTRAR = """
INSERT INTO raw_eventos_adjuntos
       (event_id, tipo, url_origen, url_dropbox, nombre_archivo, fecha_captura)
SELECT %(event_id)s, %(tipo)s, %(url_origen)s, %(url_dropbox)s,
       %(nombre_archivo)s, COALESCE(%(fecha_captura)s, NOW())
 WHERE NOT EXISTS (SELECT 1 FROM raw_eventos_adjuntos
                    WHERE event_id = %(event_id)s AND tipo = %(tipo)s);
"""

SQL_MARCAR = """
UPDATE raw_detalle_eventos d
   SET adjuntos_descargados = (
       (COALESCE(d.cartel_url, '') = '' OR EXISTS (
            SELECT 1 FROM raw_eventos_adjuntos a
             WHERE a.event_id = d.event_id AND a.tipo = 'cartel'))
       AND
       (COALESCE(d.screenshot_url, '') = '' OR EXISTS (
            SELECT 1 FROM raw_eventos_adjuntos a
             WHERE a.event_id = d.event_id AND a.tipo = 'screenshot'))
   )
 WHERE d.event_id = %(event_id)s;
"""


def normalizar(valor, defecto="sin-valor"):
    """Equivalente de normalizeSegment() del nodo Preparar Adjunto Dropbox."""
    txt = unicodedata.normalize("NFD", str(valor or ""))
    txt = "".join(c for c in txt if unicodedata.category(c) != "Mn")
    txt = re.sub(r"[^A-Za-z0-9]+", "-", txt).strip("-").lower()
    return txt or defecto


def extension(url, tipo):
    limpia = str(url or "").split("?")[0]
    m = re.search(r"\.([A-Za-z0-9]{2,5})$", limpia)
    if m:
        return m.group(1).lower()
    return "png" if tipo == "screenshot" else "jpg"


def ruta_dropbox(fila):
    slug_evento = f"{fila['event_id']}+{normalizar(fila['titulo'], 'evento')}"
    carpeta = "/0-CANCERBERO/EVENTOS/{}/{}/{}".format(
        normalizar(fila["promotor"], "sin-promotor"),
        str(fila["anio"] or "").strip() or "sin-anio",
        slug_evento,
    )
    nombre = f"{fila['tipo']}.{extension(fila['url_origen'], fila['tipo'])}"
    return carpeta, nombre, f"{carpeta}/{nombre}"


def bajar(fila):
    carpeta, nombre, destino = ruta_dropbox(fila)
    try:
        r = requests.get(fila["url_origen"], headers=HEADERS, timeout=60)
        if r.status_code != 200:
            return fila, None, f"HTTP {r.status_code}"
        if not r.content:
            return fila, None, "0 bytes"
        local = os.path.join(MOUNT, carpeta.lstrip("/"))
        os.makedirs(local, exist_ok=True)
        with open(os.path.join(local, nombre), "wb") as fh:
            fh.write(r.content)
        return fila, {"url_dropbox": destino, "nombre_archivo": nombre,
                      "bytes": len(r.content)}, None
    except Exception as exc:  # noqa: BLE001 - queremos el motivo, sea cual sea
        return fila, None, f"{type(exc).__name__}: {exc}"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int)
    ap.add_argument("--hilos", type=int, default=4)
    args = ap.parse_args()

    conn = psycopg2.connect(DSN)
    conn.autocommit = True
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(SQL_PENDIENTES)
        todas = cur.fetchall()

    vivas, muertas = [], []
    for f in todas:
        # sin oe= no es de Instagram: no caduca por firma, se intenta igual
        (muertas if f["expira"] and f["expira"].timestamp() <= __import__("time").time()
         else vivas).append(f)

    print(f"pendientes: {len(todas)}  ·  vivas: {len(vivas)}  ·  caducadas: {len(muertas)}")
    if args.limit:
        vivas = vivas[: args.limit]
    if args.dry_run:
        for f in vivas[:5]:
            print("  ->", ruta_dropbox(f)[2])
        print(f"(dry-run) se bajarian {len(vivas)}")
        return 0

    ok = fallo = 0
    with ThreadPoolExecutor(max_workers=args.hilos) as pool:
        for fila, res, err in pool.map(bajar, vivas):
            if err:
                fallo += 1
                print(f"  ✗ {fila['event_id']} [{fila['tipo']}] {err}", flush=True)
                continue
            with conn.cursor() as cur:
                cur.execute(SQL_REGISTRAR, {
                    "event_id": fila["event_id"], "tipo": fila["tipo"],
                    "url_origen": fila["url_origen"],
                    "url_dropbox": res["url_dropbox"],
                    "nombre_archivo": res["nombre_archivo"],
                    "fecha_captura": fila["fecha_captura"],
                })
                cur.execute(SQL_MARCAR, {"event_id": fila["event_id"]})
            ok += 1
            if ok % 25 == 0:
                print(f"  … {ok} guardados", flush=True)

    print(f"guardados: {ok}  ·  fallidos: {fallo}  ·  caducados no intentados: {len(muertas)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
