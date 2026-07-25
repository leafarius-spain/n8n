-- CANARIO — RAMA EJECUCION (lee la BD interna de n8n)
-- Detecta scrapers PARADOS: workflows activos de cadencia diaria que llevan sin
-- ejecutarse en absoluto mas de lo normal. Complementa a la rama de captura:
--   - rama captura   -> el scraper corre pero no captura (parser roto) [fuentes locales]
--   - ERROR WORKFLOW -> el scraper corre y FALLA (email por cada fallo)
--   - esta rama      -> el scraper NO corre (cron parado, workflow tocado) [todos]
-- Asi una fuente nacional como wegow, que captura 0 legitimamente, se vigila por
-- aqui: mientras se ejecute a diario esta sana; si deja de correr, salta.
--
-- Se excluyen los de cadencia larga (semestral/mensual): la retencion de
-- ejecuciones de n8n es de 7 dias, asi que nunca tienen ejecucion reciente y
-- darian falso positivo. Su vigilancia queda a la revision manual.
WITH ult AS (
  SELECT w.name,
         max(e."startedAt") AS ultima_ejecucion
  FROM workflow_entity w
  LEFT JOIN execution_entity e ON e."workflowId" = w.id
  WHERE w.name LIKE 'SCRAPPER %'
    AND w.active = true
    AND w.name NOT ILIKE '%FILARMONICA%'      -- cron semestral
    AND w.name NOT ILIKE '%FESTUP%'           -- cron mensual
  GROUP BY w.name
)
SELECT name AS workflow,
       ultima_ejecucion::date AS ultima_ejecucion,
       (now()::date - ultima_ejecucion::date) AS dias_parado
FROM ult
WHERE ultima_ejecucion IS NULL
   OR (now()::date - ultima_ejecucion::date) > 3   -- diario L-S: 3 dias cubre el domingo
ORDER BY dias_parado DESC NULLS FIRST;
