-- Todo lo que entra por Instagram visto como UN canal, sin perder de que cuenta
-- viene. Cada cuenta es su propia fuente (source_storefront) para que el canario
-- de cobertura pueda vigilarlas una a una; esta vista es para mirarlas juntas.
CREATE OR REPLACE VIEW v_eventos_instagram AS
SELECT c.promotor_nombre AS cuenta, f.source_storefront AS fuente,
       c.localidad_default AS localidad,
       f.event_id, f.name AS titulo, f.event_url AS post_url,
       (f.payload_json->>'es_espectaculo')::boolean AS es_evento,
       d.fecha_inicio, d.hora_inicio, d.local, d.es_gratuito,
       (d.payload_json->>'ocr_score')::numeric      AS ocr_score,
       NULLIF(d.payload_json->>'repertorio_ocr','') AS repertorio,
       f.last_seen
FROM raw_front_eventos f
JOIN promotores_configuracion c ON c.promotor_id = f.source_storefront
LEFT JOIN raw_detalle_eventos d ON d.event_id = f.event_id
WHERE c.fuente_tipo = 'instagram';
