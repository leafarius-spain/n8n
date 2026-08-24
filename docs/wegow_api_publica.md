# Wegow: la web dejó de filtrar, la API sí filtra (24/08/2026)

## El aviso que no era

`wegow_almeria` llevaba **desde el 29/06/2026 sin capturar un solo evento** — 54 días.
No saltaba ninguna alarma porque tiene `vigila_captura = false` en
`promotores_configuracion`, dado por bueno como «captura 0 legítimamente».

Y el cero **era legítimo**: Wegow no tiene ni un concierto en la provincia de Almería.
Comprobado contra su propia API, con `count_mode: "exact"`:

| Provincia | `administrative_division` | Eventos |
|---|---|---|
| Madrid | 6355233 | 42 |
| Granada | 2517115 | 11 |
| Sevilla | 2510910 | 2 |
| Málaga | 2514254 | 1 |
| **Almería** | **2521883** | **0** |

## Pero el scraper estaba raspando basura

La URL configurada era:

```
https://www.wegow.com/es/conciertos/geo/espana?cities=2521886&cities=2516543&type=both&query=&page=1
```

**Wegow ya no interpreta el parámetro `cities=`.** Lo que devolvía cada tarde eran
22-24 conciertos aleatorios del mundo —Nashville, Hamburgo, Las Vegas, Eindhoven,
Adelaida— varios de ellos con fecha de 2025, ya pasada. Comprobado en navegador real:
la página `/es/conciertos/geo/espana/almeria` muestra bajo el H1
«Conciertos en Almería 2026 2027» exactamente esa misma lista mundial.

Es decir: el cero no salía de la fuente, salía de que **la lista blanca C15 del parser
tiraba las 24 tarjetas**. Funcionaba de carambola. El día que un evento global cayera
en un municipio homónimo, se habría colado como evento de Almería.

## La API pública

Sin autenticación, devuelve JSON limpio y `count` exacto:

```
https://api.wegow.com/api/events/?page=1&page_size=100&count=true
    &administrative_division=2521883&country=1&type=0&mongo=true&lang=es&region=es
```

Campos útiles por evento: `id`, `slug`, `title`, `subtitle`, `description`,
`start_date`, `end_date`, `city{id,name,administrative_division_id,timezone}`,
`venue{id,name,permalink,latitude,longitude}`, `image_url`, `price`, `currency`,
`permalink`, `artists[]`.

### Tres trampas

1. **`city=` NO filtra.** `city=2521886` (ciudad de Almería) devuelve Bilbao,
   Salamanca, Palencia, Ávila... y da el mismo `count` (154) que Roquetas. Solo
   funciona `administrative_division`.
2. **`2521886` es la CIUDAD de Almería, `2521883` es la PROVINCIA.** El scraper
   llevaba el de la ciudad. Se usa el de la provincia: así entran también Níjar,
   Tabernas, Viator o Gérgal, y la lista C15 del parser decide después.
3. **`start_date` viene con `Z`** (`2026-09-03T19:30:00Z`) pero es la hora local de
   la sala (`city.timezone = Europe/Madrid`). Se toma tal cual, **sin convertir**.

Para sacar el id de provincia de cualquier otra:

```
https://api.wegow.com/api/filters-config/?country=espana&administrative_division=<slug>&genres=NaN&type=0&mongo=true&lang=es&region=es
```
→ `data.locations.administrative_division`

## Cómo queda

- `Generar Sitemaps` compone la URL de la API (nombre heredado de una versión vieja
  con sitemaps; se mantiene para no tocar las conexiones).
- `Fetch Listado` deja de ser un nodo Firecrawl y pasa a `httpRequest`, **sin**
  `onError: continueRegularOutput`: un error HTTP tiene que saltar al ERROR WORKFLOW,
  no acabar en «0 eventos» en silencio (ver
  `scrapers_fallo_silencioso_html_de_error.md`).
- `parsers/wegow_listado.js` lee el JSON en vez de cargar cheerio. Si la respuesta no
  trae el array `events`, **lanza error**. Un `count: 0` con `events: []` sí es válido
  y devuelve lista vacía: es el caso normal de Almería.
- `parsers/test_wegow_listado.js` — 6 casos con fixtures reales de la API
  (`fixtures/wegow_granada.json`, `wegow_almeria_vacio.json`) más uno sintético con
  municipios C15, porque hoy no hay datos reales de Almería con los que probar el mapeo.
- `promotores_configuracion.url_lista` actualizada.

Comprobado en ejecución real (56469): `count: 0`, 0 eventos, `success`, y **Firecrawl
no se ejecutó**. Un scraper menos gastando cuota (ver `scrapers_orden_firecrawl.md`).

## Qué vigilar

Sigue con `vigila_captura = false`, y debe seguir así: capturar 0 es su estado normal.
Se vigila por ejecución, que es lo correcto para una fuente que casi nunca publica
nada de Almería.

**Lo que no sabemos es si funciona cuando sí hay algo**, porque no ha habido un evento
real de Almería con el que probarlo end-to-end. El mapeo está cubierto por el test con
el fixture sintético. La primera vez que Wegow publique algo en la provincia, conviene
mirar la ejecución a mano.
