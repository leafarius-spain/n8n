-- ============================================================================
-- CANARIO — RAMA EJECUCION (lee la BD interna de n8n)
-- ============================================================================
-- Detecta scrapers PARADOS: workflows activos que llevan sin ejecutarse en
-- absoluto mas de lo normal. Complementa a la rama de captura:
--   - rama captura   -> el scraper corre pero no captura (parser roto) [fuentes locales]
--   - ERROR WORKFLOW -> el scraper corre y FALLA (email por cada fallo)
--   - esta rama      -> el scraper NO corre (cron parado, workflow tocado) [todos]
-- Asi una fuente nacional como wegow, que captura 0 legitimamente, se vigila por
-- aqui: mientras se ejecute a diario esta sana; si deja de correr, salta.
--
-- Se excluyen los de cadencia larga (semestral/mensual): la retencion de
-- ejecuciones de n8n es de 7 dias, asi que nunca tienen ejecucion reciente y
-- darian falso positivo. Su vigilancia queda a la revision manual.
--
-- 23/08/2026: el umbral era fijo (3 dias) y SCRAPPER IG PERFILES saltaba como
-- "parado" cada jueves, viernes, sabado y domingo desde que paso a cron semanal
-- en 08/2026. La rama de captura ya lo contemplaba (umbral 9 para fuente_tipo
-- 'instagram'); esta no. Ahora lleva umbral propio en vez de estar excluido, para
-- no quedarnos ciegos si de verdad se para.
--
-- Las fechas salen como texto (to_char) a proposito: con ::date el driver las
-- convierte a medianoche local y al serializar a ISO el correo mostraba el dia
-- anterior. El calculo de dias sigue haciendose aqui, en SQL.
-- ============================================================================
WITH ult AS (
  SELECT w.name,
         max(e."startedAt") AS ultima_ejecucion,
         CASE
             WHEN w.name ILIKE '%IG PERFILES%' THEN 9  -- cron semanal (lunes 22:00): 7 dias + margen
             ELSE 3                                    -- diario L-S: 3 dias cubre el domingo
         END AS umbral_dias
  FROM workflow_entity w
  LEFT JOIN execution_entity e ON e."workflowId" = w.id
  WHERE w.name LIKE 'SCRAPPER %'
    AND w.active = true
    AND w.name NOT ILIKE '%FILARMONICA%'      -- cron semestral
    AND w.name NOT ILIKE '%FESTUP%'           -- cron mensual
  GROUP BY w.name
)
SELECT name                                        AS workflow,
       to_char(ultima_ejecucion, 'YYYY-MM-DD')     AS ultima_ejecucion,
       (now()::date - ultima_ejecucion::date)      AS dias_parado,
       umbral_dias
FROM ult
WHERE ultima_ejecucion IS NULL
   OR (now()::date - ultima_ejecucion::date) > umbral_dias
ORDER BY dias_parado DESC NULLS FIRST;
