import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : SETUP DIC ETIQUETAS
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ManualTrigger                      manualTrigger
// DicData                            code
// WriteDicEtiquetas                  googleSheets               [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ManualTrigger
//    → DicData
//      → WriteDicEtiquetas
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'K6HNZfFH2GhRglOA',
    name: 'SETUP DIC ETIQUETAS',
    active: false,
    settings: {
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
        binaryMode: 'separate',
    },
})
export class SetupDicEtiquetasWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'setup-trigger',
        name: 'Manual Trigger',
        type: 'n8n-nodes-base.manualTrigger',
        version: 1,
        position: [-400, 0],
    })
    ManualTrigger = {};

    @node({
        id: 'setup-data',
        name: 'DIC Data',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-208, 0],
    })
    DicData = {
        jsCode: `return [
  { json: { ETIQUETA: 'CONCIERTO',      SINONIMOS: 'CONCIERTO;CONCIERTOS;CONCIERTO DE;EN CONCIERTO;MUSICA;FESTIVAL', TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 10,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'ORQUESTA',       SINONIMOS: 'ORQUESTA;ORQUESTAS;DUO;TRIO',                                    TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 10,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'PASACALLES',     SINONIMOS: 'PASACALLES;PASACALLE;CHARANGA;CHARANGAS;BATUCADA;PASACALLES DE', TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 30,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'FEST',           SINONIMOS: 'FEST;FESTIVAL;FESTIVALES;FESTIVIDAD',                            TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 30,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'TEATRO',         SINONIMOS: 'TEATRO;DANZA;BALLET;COMEDIA;OBRA;MONOLOGO',                      TIPO_EVENTO: 'DRAMATICOS',      PRIORIDAD: 40,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'ACTUACION',      SINONIMOS: 'ACTUACIÓN;ACTUACION;ACTUACIONES;ACTUACIONES DE',                 TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 40,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'SINFONICA',      SINONIMOS: 'SINFONICA;SINFONICO;SINFONICAS;SINFONICOS;RECITAL',              TIPO_EVENTO: 'SINFONICA',       PRIORIDAD: 50,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'DUO',            SINONIMOS: 'DÚO;DUO;DÚOS;DUOS;TRIO;TRÍO;TRÍOS;TRIOS;CUARTETO;CUARTETOS',   TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 50,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'DJ',             SINONIMOS: 'DJ;SESION DJ;MUSICA CON DJ',                                     TIPO_EVENTO: 'MECANICA',        PRIORIDAD: 60,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'PARTY',          SINONIMOS: 'PARTY;FIESTA;FIESTAS;CELEBRACIÓN;CELEBRACION;CELEBRACIONES',    TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 80,   ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'MAGIA',          SINONIMOS: 'MAGIA;MAGO;MAGA;ILUSIÓN;ILUSION;ILUSIONISMO;PRESTIDIGITACIÓN;PRESTIDIGITACION', TIPO_EVENTO: 'VARIEDADES', PRIORIDAD: 90, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'BANDA',          SINONIMOS: 'BANDA;BANDAS;AGRUPACIÓN;AGRUPACION;AGRUPACIONES',               TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 110,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'CINE',           SINONIMOS: 'CINE;CINES;PELÍCULA;PELICULA;FILM;FILMS;CINE DE',               TIPO_EVENTO: 'CINE',            PRIORIDAD: 120,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'SABINA',         SINONIMOS: 'SABINA;JOAQUÍN SABINA;JOAQUIN SABINA;SABINERO;SABINERA',        TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 125,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'CABALGATA',      SINONIMOS: 'CABALGATA;CABALGATAS;CABALGATA DE',                             TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 130,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'REYES',          SINONIMOS: 'REYES;REYES MAGOS;REY MAGO;REYES DE',                           TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 140,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'DESPISTAOS',     SINONIMOS: 'DESPISTAOS;DESPISTADOS;DESPISTADO;DESPISTADA',                  TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 145,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'GRUPO',          SINONIMOS: 'GRUPO;GRUPOS;GRUPO DE;GRUPOS DE',                               TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 150,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'LOS CHICHOS',    SINONIMOS: 'LOS CHICHOS;CHICHOS;CHICHO',                                    TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 155,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'ANTONIO OROZCO', SINONIMOS: 'ANTONIO OROZCO;OROZCO',                                         TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 165,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'DIEGO AMADOR',   SINONIMOS: 'DIEGO AMADOR;AMADOR',                                           TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 175,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'CARNAVAL',       SINONIMOS: 'CARNAVAL;CARNAVALES;CARNAVAL DE;CARNAVALES DE',                 TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 180,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'VICENTE NAVARRO',SINONIMOS: 'VICENTE NAVARRO;NAVARRO',                                        TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 185,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'CORO',           SINONIMOS: 'CORO;COROS;CORAL;CORALES;CORO DE;COROS DE',                     TIPO_EVENTO: 'REVISION_HUMANA', PRIORIDAD: 190,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'EFECTO PASILLO', SINONIMOS: 'EFECTO PASILLO;PASILLO',                                        TIPO_EVENTO: 'HUMANA',          PRIORIDAD: 195,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'GOSPEL',         SINONIMOS: 'GOSPEL;GÓSPEL;MÚSICA GOSPEL;MUSICA GOSPEL',                     TIPO_EVENTO: 'VARIEDADES',      PRIORIDAD: 200,  ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'POSITIVO' } },
  { json: { ETIQUETA: 'TALLER',         SINONIMOS: 'TALLER;TALLERES;WORKSHOP',                                      TIPO_EVENTO: 'SIN DERECHOS',    PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'EXCURSION',      SINONIMOS: 'EXCURSION;EXCURSIONES;VIAJE ORGANIZADO;SENDERISMO;RUTA SENDERISTA', TIPO_EVENTO: 'SIN DERECHOS', PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'CURSO',          SINONIMOS: 'CURSO;CURSOS;FORMACION;SEMINARIO;ACADEMIA;CLASES DE',            TIPO_EVENTO: 'SIN DERECHOS',    PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'BANDO',          SINONIMOS: 'BANDO;BANDOS;AVISO;COMUNICADO;NOTIFICACION;PLENO;ORDENANZA;CONVOCATORIA PUBLICA;EDICTO', TIPO_EVENTO: 'SIN DERECHOS', PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'SERVICIO',       SINONIMOS: 'RECICLAJE;RECICLAR;CONTENEDOR;CONTENEDORES;IMPUESTO;IMPUESTOS;TASA MUNICIPAL;OBRAS;EMPLEO;VACUNACION;HORARIO DE ATENCION;OFICINA DE ATENCION;SERVICIOS SOCIALES;AYUDA A DOMICILIO;DEPENDENCIA;RECOGIDA DE', TIPO_EVENTO: 'SIN DERECHOS', PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'SALUD',          SINONIMOS: 'CAMPAÑA DE SALUD;REVISION MEDICA;DONACION DE SANGRE',            TIPO_EVENTO: 'SIN DERECHOS',    PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'TRAFICO',        SINONIMOS: 'CORTE DE TRAFICO;CORTE DE CALLE;DESVIO',                         TIPO_EVENTO: 'SIN DERECHOS',    PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
  { json: { ETIQUETA: 'DEPORTE_MUNI',   SINONIMOS: 'ENTRENAMIENTO;FEDERACION;INSCRIPCION DEPORTIVA;LIGA MUNICIPAL;CLUB DEPORTIVO;TORNEO DE PADEL;TORNEO DE TENIS;ESCUELA DEPORTIVA', TIPO_EVENTO: 'SIN DERECHOS', PRIORIDAD: 9999, ACTIVA: 'YES', REQUIRE_IMAGEN: 'NO', FLAG: 'NEGATIVO' } },
];`,
    };

    @node({
        id: 'setup-write-sheet',
        name: 'Write DIC Etiquetas',
        type: 'n8n-nodes-base.googleSheets',
        version: 4.5,
        position: [48, 0],
        credentials: { googleSheetsOAuth2Api: { id: 'dvmGtqHi4eph1ywU', name: 'Google Sheets account' } },
    })
    WriteDicEtiquetas = {
        operation: 'appendOrUpdate',
        documentId: {
            __rl: true,
            value: '1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc',
            mode: 'list',
            cachedResultName: 'FACEBOOK POST',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit?usp=drivesdk',
        },
        sheetName: {
            __rl: true,
            value: 1136108644,
            mode: 'list',
            cachedResultName: 'DIC_ETIQUETAS ',
            cachedResultUrl:
                'https://docs.google.com/spreadsheets/d/1MmFKDvSUkyyOl9XEI_sYPrPaAsbdVhS8lGzZkcjsaFc/edit#gid=1136108644',
        },
        columns: {
            mappingMode: 'defineBelow',
            value: {
                ETIQUETA: '={{ $json.ETIQUETA }}',
                SINONIMOS: '={{ $json.SINONIMOS }}',
                TIPO_EVENTO: '={{ $json.TIPO_EVENTO }}',
                PRIORIDAD: '={{ $json.PRIORIDAD }}',
                ACTIVA: '={{ $json.ACTIVA }}',
                REQUIRE_IMAGEN: '={{ $json.REQUIRE_IMAGEN }}',
                FLAG: '={{ $json.FLAG }}',
            },
            matchingColumns: ['ETIQUETA'],
            schema: [
                {
                    id: 'ETIQUETA',
                    displayName: 'ETIQUETA',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                    removed: false,
                },
                {
                    id: 'SINONIMOS',
                    displayName: 'SINONIMOS',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'TIPO_EVENTO',
                    displayName: 'TIPO_EVENTO',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'PRIORIDAD',
                    displayName: 'PRIORIDAD',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'ACTIVA',
                    displayName: 'ACTIVA',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'REQUIRE_IMAGEN',
                    displayName: 'REQUIRE_IMAGEN',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
                {
                    id: 'FLAG',
                    displayName: 'FLAG',
                    required: false,
                    defaultMatch: false,
                    display: true,
                    type: 'string',
                    canBeUsedToMatch: true,
                },
            ],
            attemptToConvertTypes: false,
            convertFieldsToString: false,
        },
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ManualTrigger.out(0).to(this.DicData.in(0));
        this.DicData.out(0).to(this.WriteDicEtiquetas.in(0));
    }
}
