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

Los backups de ambos workflows, antes del cambio, quedaron en el scratchpad de la
sesión (`clasijazz.BACKUP.json`, `crash.BACKUP.json`).

## Pendiente

- Dejar una semana estos dos y mirar que no aparezcan errores.
- Si van bien, migrar los 11 activos restantes.
- **Dos webs que el scraper local habrá que probar aparte**: `almeriaciudad.es`
  (certificado SSL que Obscura rechazaba; comprobar si Playwright lo acepta) y
  `entradas.com` (devolvió vacío, es un sitemap).
- Cuando queden pocos en Firecrawl, mirar si se puede bajar de plan o cancelarlo.

## Cómo comprobar si un scraper sigue gastando Firecrawl

En la ejecución de n8n, mirar si el nodo `Scrape …` (el de Firecrawl) aparece como
ejecutado. Si pone «no se ejecutó», esa pasada salió gratis.
