# SCRAPPER FLOWTE — por qué se atascaban los adjuntos (06-07/08/2026)

Llegaban correos de error de n8n a diario y había **1.803 adjuntos pendientes**
acumulados. Eran tres fallos encadenados, no uno.

## 1. Un fallo de descarga tumbaba la ejecución entera

`Descargar Adjunto` no tenía ni reintentos ni control de errores. Flowte devolvió
un `ExpiredToken` suyo —una firma interna caducada, no nuestra— y con eso se
cayó toda la ejecución en el `itemIndex: 7`: los 13 adjuntos siguientes de esa
tanda se quedaron sin bajar.

La imagen del error estaba **perfectamente**: probada a mano el 06/08 devuelve
`200`. Era un fallo pasajero del servidor de Flowte.

→ `retryOnFail` con 3 intentos y 5 s de espera, y `onError: continueErrorOutput`
con la salida de error de vuelta al bucle: el adjunto que falla se salta, queda
pendiente y se reintenta en la pasada siguiente.

## 2. El bucle nunca llegaba a la fase de adjuntos

`Loop Over Items` tiene dos salidas: la de "terminado" va a
`Leer Adjuntos Pendientes`, y la de cada vuelta al scraping del detalle.

Si `Normalizar Eventos` no sacaba ningún evento devolvía `[]`, y en n8n eso
**mata la rama**: no corre el `Insert`, el bucle no recibe la vuelta y nunca
alcanza su salida de "terminado". Resultado: la descarga de adjuntos casi nunca
se ejecutaba. De ahí la acumulación.

→ `alwaysOutputData: true` en `Normalizar Eventos` (emite `{}` si no hay nada) y
`onError: continueRegularOutput` en `Insert Normalized Events` (ese `{}` no
tiene `event_id`, que es NOT NULL, así que el INSERT falla y se ignora sin
romper el bucle).

## 3. Los caducados tapaban la cola

`Leer Adjuntos Pendientes` ordena por `fecha_captura` ascendente y coge 20. Las
URLs de Instagram llevan su caducidad en el parámetro `oe=` (UNIX en hexadecimal)
y **1.513 estaban caducadas** —expiraron entre el 26/07 y el 01/08—, dando 403.

Como eran las más antiguas, encabezaban la cola: se cogían en cada pasada,
fallaban, y las 284 que sí se podían bajar nunca llegaban a su turno. Un
bloqueo de cabeza de cola de manual.

→ Marcadas en `raw_eventos_adjuntos` con `url_dropbox = NULL` y
`nombre_archivo = 'NO DESCARGADO · la firma de Instagram caducó el …'`. Salen de
la cola, queda constancia de qué pasó, y se distinguen de los bajados de verdad
por tener `url_dropbox` a nulo.

## Corrección: las imágenes SÍ estaban en el Dropbox

Di 1.513 por irrecuperables y me equivoqué. Lo corrigió el operador —*"las
tenemos en teoría guardadas en el Dropbox"*— y así era: **1.425 de esas 1.513
estaban descargadas**. Lo que fallaba era el índice, no la descarga.

Mi comprobación buscó las carpetas con el título dentro
(`…-20260822+cooltural-fest`) y las reales no siempre lo llevan
(`…-20260822`), así que dio falsos negativos. Al cruzar hay que quedarse con lo
que va **antes del `+`**.

Otros dos detalles que dan falsos negativos al buscar:

- La extensión se saca de la URL y no siempre acierta: hay ficheros `cartel.es`
  —cogió el TLD de `juntadeandalucia.es`— y también `.avif` y `.heic`. Hay que
  comparar el nombre **sin extensión** (`cartel`, `screenshot`).
- El mount de rclone es lento: 5.700 comprobaciones una a una tardan minutos.
  Mejor un `find` de una pasada y cruzar en memoria.

Tras reindexar: **5.773 adjuntos con su imagen localizada** y solo 111 sin
fichero en ninguna parte.

## Lo que queda pendiente

- **Los 111 sin imagen**: URL caducada y nada en el Dropbox. El post de
  Instagram sigue ahí, así que se recuperarían re-scrapeando esos eventos.
- **La causa de fondo**: entre que se captura la URL y se descarga pueden pasar
  días, y las firmas de Instagram duran ~1 semana. Lo sano sería descargar en el
  momento de capturar, o priorizar por caducidad (`oe=`) en vez de por antigüedad.
- El `LIMIT 20` por pasada, con una ejecución diaria, no da abasto si vuelve a
  acumularse.

## Consultas útiles

```sql
-- Cola real
SELECT count(*) FROM raw_detalle_eventos d
 WHERE COALESCE(d.adjuntos_descargados,false)=false
   AND (COALESCE(d.cartel_url,'')<>'' OR COALESCE(d.screenshot_url,'')<>'');

-- Marcados como caducados (no bajados)
SELECT count(*) FROM raw_eventos_adjuntos WHERE url_dropbox IS NULL;
```

Para deshacer el marcado: `DELETE FROM raw_eventos_adjuntos WHERE url_dropbox IS NULL;`
(el respaldo de los afectados quedó en el scratchpad de la sesión).
