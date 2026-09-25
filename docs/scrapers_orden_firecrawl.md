# Scrapers: primero el local, Firecrawl de respaldo (07/08/2026)

## Por qué

Firecrawl cuesta **~200 €/año** y tiene cuota mensual. Los 13 scrapers activos lo
usaban **solo para traer el HTML**: ninguno usa su extracción con IA, todos parsean
después con código propio (cheerio).

Y ya teníamos el sustituto montado: `scrapegraph-fallback` (puerto 8021), que hace
exactamente eso con Playwright local y **coste cero**. Estaba puesto como plan B en
cada workflow —con sus nodos «Fallback Listado» y «Fallback Detalle» ya conectados al
mismo parseador—, pero solo entraba cuando Firecrawl fallaba.

**El cambio es solo de orden**: el local va primero y Firecrawl queda de red de
seguridad. No se ha tocado ni un parseador ni la lógica de nadie.

> Nota: esto salió buscando si [Obscura](https://github.com/h4ckf0r0day/obscura) —un
> navegador headless en Rust— podía ahorrar esos 200 €. Probado contra Flowte saca lo
> mismo que Firecrawl, pero **el `/scrape` local ya lo hacía y más rápido** (2,9 s
> frente a 11,8 s en Clasijazz), así que no hace falta meter una pieza nueva. Ver
> `INFORME_obscura_flowte.md`.

## Cómo queda cada par de nodos

```
antes:   Firecrawl ──ok──> Parsear
                └─error──> Local ──> Parsear

ahora:   Local ──ok──> Parsear
             └─error──> Firecrawl ──> Parsear
```

En n8n: el nodo local pasa a `onError: continueErrorOutput` (su salida de error va a
Firecrawl) y el de Firecrawl a `continueRegularOutput`, porque ya es el último recurso.
Hay que reapuntar también a quien llamaba al nodo de Firecrawl.

## Hecho hasta ahora

| Scraper | Estado | Comprobación |
|---|---|---|
| SCRAPPER CLASIJAZZ | migrado | ejecución 49589 correcta · Firecrawl no se ejecutó |
| SCRAPPER CRASH MUSIC ALMERIA | migrado | ejecución 49596 correcta · 27 eventos · Firecrawl no se ejecutó |
| SCRAPPER WEGOW ALMERIA | fuera de Firecrawl | 24/08/2026 · pasa a la **API pública** de Wegow, sin render: ni local ni Firecrawl. Ver `wegow_api_publica.md` |
| SCRAPPER FLOWTE | migrado 25/09/2026 | webhook de prueba, ejecución 69950 correcta · Firecrawl no se ejecutó (2 nodos) |
| COMPROBACION TAQUILLA | migrado 25/09/2026 | webhook de prueba, correcta · 10 items · Firecrawl no se ejecutó |
| SCRAPPER SIENTE LA PLAZA ALMERIA | migrado 25/09/2026 | webhook de prueba, correcta · Firecrawl no se ejecutó (3 nodos: Listado/Detalle/Enterticket) |
| SCRAPPER EMMA | migrado 25/09/2026 | webhook de prueba, correcta · Firecrawl no se ejecutó |
| SCRAPPER ALMERIA CIUDAD | migrado 25/09/2026 | webhook de prueba, correcta · 2 eventos · Firecrawl no se ejecutó (Listado y Detalle) |
| SCRAPPER FEVERUP | migrado 25/09/2026 | webhook de prueba, correcta · Firecrawl no se ejecutó |
| SCRAPPER SALA BERLIN | migrado 25/09/2026 | webhook de prueba, correcta · 2 eventos · Firecrawl no se ejecutó |
| SCRAPPER LA VOZ ALMERIA | migrado 25/09/2026 | webhook de prueba, correcta · Firecrawl no se ejecutó |
| SCRAPPER ENTRADAS COM ALMERIA | migrado 25/09/2026 | webhook de prueba, correcta · listado por sitemap (ya sin Firecrawl), 0 pendientes de detalle en el ciclo · Firecrawl no se ejecutó |

Los backups de los dos primeros, antes del cambio, quedaron en el scratchpad de la
sesión (`clasijazz.BACKUP.json`, `crash.BACKUP.json`). A partir de Wegow, los scripts
de `scripts/` guardan el backup solos en `backups/`.

**25/09/2026 — tanda grande, con un fix al script:** `migrar_scraper_local_primero.py`
no filtraba `settings` antes del PUT y la API lo rechazaba con `400 Bad Request`
(mismo problema ya documentado más abajo, "Ojo con el `settings`") — el primer intento
con FLOWTE falló así, **sin llegar a tocar el workflow** (el PUT falló antes de
aplicarse). Arreglado copiando el filtro `SETTINGS_OK` que ya usaba
`migrar_wegow_a_api.py`. Las 9 migraciones de esta tanda se verificaron disparando el
webhook `*-trigger-test` de cada workflow y comprobando en `/executions` que (a)
`status: success`, (b) el nodo Firecrawl no aparece en `runData` (no se ejecutó), y
(c) los nodos con datos de verdad (Listado/Detalle) devolvieron items > 0, no una
lista vacía sospechosa (el fallo silencioso ya documentado abajo).

**Quedan sin migrar, deliberadamente:**
- `SCRAPPER ECI ALMERIA` (El Corte Inglés) — **desactivado el 25/09/2026 en vez de
  migrado**. `elcorteingles.es/entradas` con proxy stealth, sin fallback local (el
  script no tenía nada que invertir). Antes de darle un fallback se midió cuánta
  información única aportaba en `cancerbero-eventos.raw_front_eventos`: **15 eventos
  capturados en 4 meses (23/05→24/09), 5 en el último mes**, y de esos 15, **14 ya
  llegaban por otras fuentes** ya cubiertas (Sala Berlín/Crash Music, Enterticket/
  Siente la Plaza/Taquilla/Tomaticket/Weeky, Qconciertos, Turismo/Instagram) — el
  único que no se repetía era una visita guiada a la catedral, sin derechos SGAE.
  Información prácticamente nula: no compensaba el esfuerzo de darle fallback ni
  seguir pagando Firecrawl por él. `active=false` vía API, reversible si hiciera
  falta reactivarlo.
- `SCRAPPER IG PERFILES (imginn)`: mismo caso de "sin fallback que invertir", pero
  este SÍ se queda activo — depende del caso Instagram/imginn, que se resolverá
  aparte con una cuenta real + bridge Playwright (mismo patrón que
  `social-review/backend/scripts/fb_bridge/` para Facebook), no con el 8021.
- `SCRAPPER KUVER PRODUCCIONES` y `SCRAPPER CLASIJAZZ HISTORICO 2026`: `active=false`,
  no están en producción ahora mismo — se dejan tal cual hasta que se reactiven.

> **Antes de migrar, mirar si la fuente tiene API.** Wegow salió del render entero
> porque la tenía y era pública. Sale más barato y más fiable que cualquier scraper:
> nada de HTML, filtros que funcionan de verdad y `count` exacto.

## Pendiente

- 23/08/2026: los dos primeros llevan **16 días** sin tocar Firecrawl ni una vez, con
  6 de 6 ejecuciones limpias cada uno. El patrón está validado.
- Migrar los 5 restantes que están sanos y tienen fallback: Flowte, Siente la Plaza,
  Emma, Feverup y La Voz.
- **Dos webs que el scraper local habrá que probar aparte**: `almeriaciudad.es`
  (certificado SSL que Obscura rechazaba; comprobar si Playwright lo acepta) y
  `entradas.com` (devolvió vacío, es un sitemap).
- Cuando queden pocos en Firecrawl, mirar si se puede bajar de plan o cancelarlo.

## Cómo comprobar si un scraper sigue gastando Firecrawl

En la ejecución de n8n, mirar si el nodo `Scrape …` (el de Firecrawl) aparece como
ejecutado. Si pone «no se ejecutó», esa pasada salió gratis.
