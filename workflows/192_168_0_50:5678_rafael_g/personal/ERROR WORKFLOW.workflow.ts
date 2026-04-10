import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : ERROR WORKFLOW
// Nodes   : 3  |  Connections: 2
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// ErrorTrigger                       errorTrigger
// FormatErrorAlert                   code
// SendErrorEmail                     gmail                      [creds]
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// ErrorTrigger
//    → FormatErrorAlert
//      → SendErrorEmail
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: 'IkqnFDu34CjPjXBj',
    name: 'ERROR WORKFLOW',
    active: true,
    settings: {
        timezone: 'Europe/Madrid',
        executionOrder: 'v1',
        callerPolicy: 'workflowsFromSameOwner',
        availableInMCP: false,
    },
})
export class ErrorWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'error-workflow-trigger',
        name: 'Error Trigger',
        type: 'n8n-nodes-base.errorTrigger',
        version: 1,
        position: [-600, -120],
    })
    ErrorTrigger = {};

    @node({
        id: 'error-workflow-format-alert',
        name: 'Format Error Alert',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [-320, -120],
    })
    FormatErrorAlert = {
        mode: 'runOnceForEachItem',
        language: 'javaScript',
        jsCode: `const payload = $json || {};

const execution = payload.execution || {};
const executionError = execution.error || {};
const trigger = payload.trigger || {};
const triggerError = trigger.error || {};
const topLevelError = payload.error || {};
const n8nDetails = payload.n8nDetails || topLevelError.n8nDetails || executionError.n8nDetails || triggerError.n8nDetails || {};

const pickFirst = (...values) => values.find((value) => {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim() !== '';
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return true;
});

const toStringValue = (value, fallback = '') => {
  if (value === undefined || value === null) {
    return fallback;
  }

  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.message || fallback;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
};

const clip = (value, maxLength = 6000) => {
  const normalized = toStringValue(value);
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength
    ? normalized.slice(0, maxLength) + '\\n...[recortado]'
    : normalized;
};

const escapeHtml = (value) => toStringValue(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const rawTimestamp = pickFirst(
  triggerError.timestamp,
  topLevelError.timestamp,
  payload.timestamp,
  execution.startedAt,
  execution.stoppedAt,
  execution.lastNodeExecutedAt,
  new Date().toISOString(),
);

const parsedTimestamp = typeof rawTimestamp === 'number'
  ? new Date(rawTimestamp)
  : new Date(rawTimestamp);

const errorDate = Number.isNaN(parsedTimestamp.getTime())
  ? new Date().toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  : parsedTimestamp.toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

const workflowName = toStringValue(pickFirst(payload.workflowName, payload.workflow?.name, 'Desconocido'));
const workflowId = toStringValue(pickFirst(payload.workflowId, payload.workflow?.id, 'N/A'));
const executionId = toStringValue(pickFirst(payload.executionId, execution.id, ''));
const executionMode = toStringValue(pickFirst(payload.executionMode, execution.mode, trigger.mode, 'N/A'));

const failedNode = toStringValue(pickFirst(
  execution.lastNodeExecuted,
  triggerError.node?.name,
  triggerError.context?.nodeName,
  topLevelError.node?.name,
  topLevelError.nodeName,
  executionError.node?.name,
  executionError.nodeName,
  n8nDetails.nodeName,
  'Desconocido',
));

const errorType = toStringValue(pickFirst(
  executionError.name,
  triggerError.name,
  topLevelError.name,
  payload.name,
  '',
));

const errorMessage = toStringValue(pickFirst(
  executionError.message,
  triggerError.message,
  triggerError.cause?.message,
  topLevelError.message,
  topLevelError.cause?.message,
  payload.errorMessage,
  payload.errorDescription,
  payload.errorDetails?.rawErrorMessage?.[0],
  executionError.errorDetails?.rawErrorMessage?.[0],
  topLevelError.errorDetails?.rawErrorMessage?.[0],
  n8nDetails.stackTrace?.[0],
  'Sin mensaje de error',
));

const errorDescription = toStringValue(pickFirst(
  executionError.description,
  triggerError.description,
  topLevelError.description,
  payload.errorDescription,
  '',
));

const httpCode = toStringValue(pickFirst(
  payload.errorDetails?.httpCode,
  executionError.errorDetails?.httpCode,
  topLevelError.errorDetails?.httpCode,
  triggerError.errorDetails?.httpCode,
  n8nDetails.httpCode,
  '',
));

const errorStack = clip(pickFirst(
  executionError.stack,
  triggerError.cause?.stack,
  triggerError.stack,
  topLevelError.stack,
  topLevelError.cause?.stack,
  Array.isArray(n8nDetails.stackTrace) ? n8nDetails.stackTrace.join('\\n') : '',
), 8000);

const rawPayload = clip(payload, 12000);

const executionUrl = toStringValue(pickFirst(execution.url, payload.executionUrl, ''));
const executionContextNote = executionUrl
  ? ''
  : executionId
    ? 'No se ha recibido una URL directa de ejecucion en el payload del Error Trigger.'
    : 'El fallo ocurrio antes de que n8n guardara una ejecucion persistida, por eso no hay execution id ni enlace directo.';

const summaryRows = [
  ['Fecha', errorDate],
  ['Workflow', workflowName],
  ['Workflow ID', workflowId],
  ['Nodo fallido', failedNode],
  ['Execution ID', executionId || 'No disponible'],
  ['Modo', executionMode],
  ['Tipo de error', errorType || 'No disponible'],
  ['HTTP code', httpCode || 'No disponible'],
].map(([label, value]) => '<tr><td style="padding:8px 10px;border:1px solid #d9dee5;background:#f7f9fc;font-weight:600;width:170px;">' + escapeHtml(label) + '</td><td style="padding:8px 10px;border:1px solid #d9dee5;">' + escapeHtml(value) + '</td></tr>').join('');

const optionalSection = (title, value) => {
  if (!value) {
    return '';
  }

  return '<h3 style="margin:24px 0 8px;font-size:16px;">' + escapeHtml(title) + '</h3><pre style="margin:0;padding:12px;background:#101828;color:#f8fafc;border-radius:6px;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5;">' + escapeHtml(value) + '</pre>';
};

const executionLinkHtml = executionUrl
  ? '<p style="margin:16px 0 0;"><a href="' + escapeHtml(executionUrl) + '" style="display:inline-block;padding:10px 14px;background:#b42318;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">Abrir ejecucion en n8n</a></p>'
  : '<p style="margin:16px 0 0;color:#667085;">' + escapeHtml(executionContextNote) + '</p>';

const emailBodyHtml = '<!DOCTYPE html>' +
  '<html><body style="margin:0;padding:24px;background:#f2f4f7;font-family:Arial, Helvetica, sans-serif;color:#101828;">' +
  '<div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d9dee5;border-radius:10px;overflow:hidden;">' +
  '<div style="padding:20px 24px;background:#b42318;color:#ffffff;">' +
  '<h1 style="margin:0 0 6px;font-size:22px;">Error en n8n</h1>' +
  '<p style="margin:0;font-size:14px;opacity:0.95;">Se ha detectado un fallo en un workflow configurado con este Error Workflow.</p>' +
  '</div>' +
  '<div style="padding:24px;">' +
  '<h2 style="margin:0 0 12px;font-size:18px;">Resumen</h2>' +
  '<table style="width:100%;border-collapse:collapse;border-spacing:0;">' + summaryRows + '</table>' +
  '<div style="margin-top:20px;padding:16px;border-left:4px solid #f79009;background:#fffaeb;border-radius:6px;">' +
  '<div style="font-weight:700;margin-bottom:8px;">Mensaje principal</div>' +
  '<div style="white-space:pre-wrap;word-break:break-word;">' + escapeHtml(errorMessage) + '</div>' +
  (errorDescription ? '<div style="margin-top:10px;color:#475467;white-space:pre-wrap;word-break:break-word;">' + escapeHtml(errorDescription) + '</div>' : '') +
  '</div>' +
  executionLinkHtml +
  optionalSection('Stack trace', errorStack) +
  optionalSection('Payload bruto del Error Trigger', rawPayload) +
  '<p style="margin:24px 0 0;font-size:12px;color:#667085;">Este correo se ha generado automaticamente desde el workflow compartido de alertas de error.</p>' +
  '</div></div></body></html>';

const emailSubject = ['ERROR n8n', workflowName, failedNode]
  .filter((part) => part && part !== 'Desconocido')
  .join(' | ')
  .slice(0, 180);

return {
  json: {
    errorDate,
    workflowName,
    workflowId,
    executionId: executionId || 'No disponible',
    executionMode,
    executionUrl,
    failedNode,
    errorType,
    httpCode,
    errorMessage,
    errorDescription,
    errorStack,
    executionContextNote,
    rawPayload,
    emailSubject,
    emailBodyHtml,
  },
};`,
    };

    @node({
        id: 'error-workflow-send-email',
        name: 'Send Error Email',
        type: 'n8n-nodes-base.gmail',
        version: 2.2,
        position: [-40, -120],
        credentials: { gmailOAuth2: { id: 'nGpyEu1Iud0VK7xH', name: 'Gmail account' } },
    })
    SendErrorEmail = {
        authentication: 'oAuth2',
        resource: 'message',
        operation: 'send',
        sendTo: "={{ $env.N8N_ERROR_ALERT_EMAIL || 'rfguerrero@gmail.com' }}",
        subject: '={{ $json.emailSubject }}',
        emailType: 'html',
        message: '={{ $json.emailBodyHtml }}',
        options: {},
    };

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.ErrorTrigger.out(0).to(this.FormatErrorAlert.in(0));
        this.FormatErrorAlert.out(0).to(this.SendErrorEmail.in(0));
    }
}
