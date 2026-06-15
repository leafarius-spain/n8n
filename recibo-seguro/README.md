# Recibo de Seguro

Herramienta para generar recibos de cobro de seguro y entregarlos al momento
(en persona o por WhatsApp). Hay dos formas de usarlo:

## Opción A — Imagen JPG (recomendada, no editable)

`generar_recibo.py` crea un recibo como imagen **JPG** lista para reenviar por
WhatsApp. Al ser imagen, el cliente no la puede modificar.

**Cómo usar:**
1. Abre `generar_recibo.py` y edita el bloque `DATOS` (cliente, importe, mes…).
2. Ejecuta:
   ```bash
   pip install Pillow      # solo la primera vez
   python3 generar_recibo.py
   ```
3. Se genera `recibo.jpg` en esta misma carpeta. Adjúntalo en WhatsApp.

> En el flujo de chat también puedes simplemente pasarme los datos del cliente
> y te devuelvo el JPG ya generado.

## Opción B — Página web en el móvil

`recibo-seguro.html` es un formulario que abres en el navegador del móvil
(funciona **sin internet**). Rellenas los datos, genera el recibo y:
- **📲 WhatsApp**: comparte el texto del recibo.
- **🖨️ Imprimir / PDF**: para entregarlo en papel o guardarlo como PDF.

Tus datos de agente/compañía se guardan en el propio móvil y el nº de recibo
se numera solo.

## Campos del recibo

Basado en un recibo real de Meridiano (Protección Familiar):
nº de póliza, nº de recibo, fecha, forma de pago, periodo de validez, concepto,
datos del tomador y domicilio, desglose de prima (Prima tarifa, CCS, RLEA, IPS,
Otros) y **TOTAL**, con sello de **PAGADO** y firma del agente.
