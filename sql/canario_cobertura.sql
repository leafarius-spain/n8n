-- ============================================================================
-- CANARIO DE COBERTURA DE SCRAPERS
-- ============================================================================
-- Problema que resuelve: un scraper puede terminar en 'success' y no capturar
-- nada. Los nodos de fetch llevan onError: continueRegularOutput, asi que un
-- cambio de HTML en el origen (o Firecrawl + fallback caidos) hace que el
-- parser saque 0 items sin que el ERROR WORKFLOW se entere. Caso real: WEGOW
-- corrio a diario durante 22 dias sin capturar un solo evento.
--
-- Senal: max(last_seen). Cada pasada sana refresca last_seen via el
-- ON CONFLICT DO UPDATE del upsert, AUNQUE no haya eventos nuevos. Si last_seen
-- se congela, el scraper no esta leyendo la web.
--
-- No se usa first_seen: una fuente puede pasar semanas sin publicar nada nuevo
-- y estar sana (feverup lleva 34 dias sin novedades y lee 45 eventos por pasada).
--
-- Solo mira fuentes con habilitado = true en promotores_configuracion, para que
-- desactivar un scraper (kuver, qconciertos) silencie su alerta sin tocar esto.
-- ============================================================================
WITH mapa AS (
    -- promotor_id no siempre coincide con source_storefront. 21 de 25 si.
    -- Estas 4 son las excepciones historicas.
    SELECT c.promotor_id,
           CASE c.promotor_id
               WHEN 'ayto_alm_cul'  THEN 'almeria-cultura-401'
               WHEN 'crash_music'   THEN 'crash_music_almeria'
               WHEN 'emma'          THEN 'emma_almeria'
               WHEN 'siente_plaza'  THEN 'siente_plaza_almeria'
               ELSE c.promotor_id
           END AS fuente,
           -- cadencia declarada; el cron real de casi todos es diario 1-6.
           -- El suelo de 3 dias cubre el domingo sin ejecucion.
           CASE
               WHEN c.promotor_id = 'filarmonica_almeria' THEN 200  -- cron semestral: 30 23 1 1,7 *
               WHEN c.fuente_tipo = 'instagram'           THEN 5    -- cron L,J: de jueves a lunes hay 4 dias
               ELSE 3
           END AS umbral_dias
    FROM promotores_configuracion c
    WHERE c.habilitado = true
      AND c.vigila_captura = true   -- las nacionales (wegow) se vigilan por ejecucion, no por captura
)
SELECT m.fuente,
       max(r.last_seen)::date                        AS ultima_lectura,
       (now()::date - max(r.last_seen)::date)        AS dias_en_silencio,
       m.umbral_dias,
       count(*)                                      AS eventos_en_tabla
FROM mapa m
LEFT JOIN raw_front_eventos r ON r.source_storefront = m.fuente
GROUP BY m.fuente, m.umbral_dias
HAVING max(r.last_seen) IS NULL
    OR (now()::date - max(r.last_seen)::date) > m.umbral_dias
ORDER BY dias_en_silencio DESC NULLS FIRST;
