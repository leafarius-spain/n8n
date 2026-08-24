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

Los backups de los dos primeros, antes del cambio, quedaron en el scratchpad de la
sesión (`clasijazz.BACKUP.json`, `crash.BACKUP.json`). A partir de Wegow, los scripts
de `scripts/` guardan el backup solos en `backups/`.

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
