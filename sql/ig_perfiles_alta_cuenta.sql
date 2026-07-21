-- Alta de una cuenta de Instagram para SCRAPPER IG PERFILES (imginn).
-- Anadir una cuenta es solo este INSERT: el workflow lee de aqui y no hay que
-- tocarlo (el SELECT de pendientes filtra por fuente_tipo='instagram').
INSERT INTO promotores_configuracion
  (promotor_id, promotor_nombre, url_lista, fuente_tipo, localidad_default,
   parser_lista_tipo, habilitado, descripcion, hora_ejecutar, dias)
VALUES
  ('ig_<slug_cuenta>', '<Nombre> (Instagram)',
   'https://imginn.com/<handle>/', 'instagram', 'Almeria',
   'imginn_grid', true, '<para que sirve>', '22:00', 'L,J')
ON CONFLICT (promotor_id) DO UPDATE SET
   url_lista=EXCLUDED.url_lista, habilitado=EXCLUDED.habilitado, updated_at=now();
