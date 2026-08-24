# El fallo que no avisa: cuando el origen contesta con una página de error (24/08/2026)

## Qué pasó

Sala Berlín estuvo **tres días capturando cero eventos** (20, 21 y 22 de agosto) y las
tres ejecuciones terminaron en `success`. Nadie se enteró hasta que el canario de
cobertura avisó el día 23, con 4 días de silencio ya cumplidos.

`berlinalmeria.com` devolvía **HTTP 503**. Pero ni Firecrawl ni el scraper local del
8021 tratan eso como un error: los dos devuelven `success: true` con el HTML **de la
página de error** dentro. El nodo no lanza excepción, así que:

- no salta el `ERROR WORKFLOW` (solo se dispara con fallos de nodo),
- no salta la rama `onError`, así que **el fallback ni se ejecuta**,
- el parser hace `cheerio.load()` del HTML del 503, no encuentra nada y devuelve
  `events: []`,
- el workflow acaba en verde.

El único que lo caza es el canario de cobertura, y por diseño tarda 3 días.

## Los dos agujeros que había en Berlín

**1. El parser se tragaba el error.** La cabecera era:

```js
const html = ($json.data && $json.data.html) || ($json.data && $json.data.rawHtml) || '';
if (!html) {
  return [{ json: { data: { data: { events: [] } } } }];   // <- silencio
}
```

Un 503 sí trae `html`, así que ni siquiera entraba por ese `if`. Y aunque hubiera
entrado, devolver `events: []` es exactamente lo que hace que el fallo sea invisible.

**2. El parser solo leía la primera página.** El nodo está en `runOnceForAllItems`
pero usaba `$json`, que es únicamente el primer item. `Generar Paginas` bajaba 4
páginas y **se tiraban 3**. Por eso los días 21 y 22, con `?product-page=3`
devolviendo 200, el resultado seguía siendo 0: esa página ni se miraba.

Además era un bug latente de pérdida de datos: el día que la cartelera pase de una
página, esos eventos no se capturarían nunca.

## Por qué el 503

Las 4 páginas se pedían **de golpe**, y solo la primera tiene cartelera (12 eventos;
la 2 ya viene vacía). Pidiéndolas espaciadas 4 segundos, las 4 responden 200. Era
rate-limit del hosting disparado por nuestra propia ráfaga, no un bloqueo contra
Firecrawl ni un cambio de HTML.

## Cómo quedó

- `parsers/berlin_listado.js` recorre **todas** las páginas y, si la primera no vino
  utilizable, **lanza error** en vez de devolver la lista vacía. Así salta el
  `ERROR WORKFLOW` el mismo día en vez de esperar 3 al canario.
- Las páginas siguientes que fallen se ignoran: puede ser el fin de la paginación.
- Una cartelera legítimamente vacía (200 sin productos) **no** lanza error — para eso
  ya está el canario de cobertura.
- `TOTAL_PAGES` de 4 a 2.
- `parsers/test_berlin_listado.js` cubre los 6 casos contra HTML real guardado en
  `parsers/fixtures/`. Se ejecuta con `node parsers/test_berlin_listado.js`.

## Lo que queda por hacer

Este agujero **no es de Berlín, es del patrón**. Auditados los 16 scrapers con nodo
Firecrawl (23/08/2026):

- **Solo 2 miran `metadata.statusCode`**: `COMPROBACION TAQUILLA` y `entradas_almeria`.
  El de taquilla es el modelo a copiar: clasifica el 404 como `despublicado` con su
  motivo, en vez de tragárselo.
- **CLASIJAZZ y CRASH MUSIC son inmunes por accidente**: como ya se migraron a
  «local primero» (ver `scrapers_orden_firecrawl.md`), su nodo primario es un
  `httpRequest`, que **sí** falla de verdad ante un error HTTP.
- ~~**WEGOW lleva desde el 29/06/2026 sin capturar nada** — 54 días.~~ **Revisado el
  24/08/2026**: el cero era legítimo (Wegow no tiene nada en la provincia de Almería),
  pero la URL estaba obsoleta y traía 24 conciertos del mundo que solo se salvaban
  porque el filtro C15 del parser los tiraba. Migrado a la API pública, que sí filtra.
  Ver `wegow_api_publica.md`.
- `IG PERFILES (imginn)` **no tiene fallback** al 8021 y su nodo va sin rama de error.
- `My workflow copy.workflow.ts` es un fichero huérfano: ese workflow ya no existe en
  n8n (la API devuelve 404).

**Ojo con el `settings` al subir por la API pública**: rechaza `callerPolicy`,
`availableInMCP`, `binaryMode` y `timeSavedMode` con
`settings must NOT have additional properties`. Hay que filtrarlas antes del `PUT`;
n8n las conserva por su cuenta porque hace merge, no reemplazo. Los scripts de
`scripts/` ya lo hacen.
