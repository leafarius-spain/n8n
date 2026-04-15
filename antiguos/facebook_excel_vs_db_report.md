# Comparativa: Excel flujo antiguo vs BD actual
Generado: 2026-04-11T15:42:00

## Scope real usado
- Excel baseline: antiguos/EVENTOS_FACEBOOK_AYTOS.xlsx, hoja FB_POSTS_RAW
- BD actual: candidate_events finales (is_processed_final=true y candidate_status en OK_EVENTO/DUDA_EVENTO/REVISION_MANUAL)
- Criterio de comparacion aplicado: cobertura por POST_ID

## Hallazgo clave
- El Excel no trae capa final de eventos util para comparar (TITULO_FINAL_EVENTO todo vacio y ES_EVENTO_LLM todo NaN).
- Por eso la comparativa valida y objetiva se hizo a nivel post detectado (POST_ID del Excel vs external_post_id de candidate_events).

## Metricas de comparacion (POST_ID)
- Filas en Excel FB_POSTS_RAW: 432
- POST_ID unicos en Excel: 432
- Filas candidatas finales en BD: 7
- POST_ID unicos en BD: 7
- Coincidencias POST_ID: 4
- Solo Excel (faltan en BD): 428
- Solo BD (no presentes en ese Excel): 3
- Cobertura BD sobre baseline antiguo: 0.93%

## Distribucion status en BD actual
- DUDA_EVENTO: 5
- OK_EVENTO: 2

## Coincidencias exactas (4)
- POST_ID=1078434217802855 | CE_ID=100 | STATUS=DUDA_EVENTO | IDEMPOT=FACEBOOK:1078434217802855 | TITLE=None
- POST_ID=1079219277724349 | CE_ID=72  | STATUS=DUDA_EVENTO | IDEMPOT=FACEBOOK:1079219277724349 | TITLE=None
- POST_ID=1081226080857002 | CE_ID=87  | STATUS=DUDA_EVENTO | IDEMPOT=FACEBOOK:1081226080857002 | TITLE=None
- POST_ID=1100811358898474 | CE_ID=73  | STATUS=OK_EVENTO   | IDEMPOT=FACEBOOK:1100811358898474 | TITLE=TALLER

## Solo BD (3)
- POST_ID=1224877139825228 | CE_ID=33 | STATUS=DUDA_EVENTO
- POST_ID=1226888332957442 | CE_ID=25 | STATUS=DUDA_EVENTO
- POST_ID=media-test-1      | CE_ID=6  | STATUS=OK_EVENTO (registro de test)

## Muestra de Solo Excel (primeros 20 POST_ID)
- 1001718905474387
- 1004524931860451
- 1005290338450577
- 1005784025067875
- 1006545138325097
- 1007207638258847
- 1009452141367730
- 1010317391281205
- 1010908357888775
- 1011555024490775
- 1012455461067398
- 1013589484287329
- 1013783884267889
- 1014412410871703
- 1015296174116660
- 1015754207404190
- 1016584500654494
- 1016881587291452
- 1016911927288418
- 1017375623908715

## Conclusiones
- La diferencia es masiva: el resultado actual en BD cubre solo 4 de 432 posts del baseline antiguo.
- Ademas, 3 de 7 candidatos actuales no estan en ese baseline, incluyendo un registro de test (media-test-1).
- Este desajuste confirma que el estado actual no es aceptable respecto al historico que pasaste.