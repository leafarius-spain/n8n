#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera un recibo de seguro como imagen JPG (no editable) con el formato del
recibo de Meridiano (Protección Familiar), listo para entregar o enviar por
WhatsApp.

Edita el diccionario DATOS y ejecuta:  python3 generar_recibo.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------
# DATOS DEL RECIBO  (edita aquí y vuelve a ejecutar)
# ----------------------------------------------------------------------
DATOS = {
    # --- Emisor / compañía (panel izquierdo) ---
    "emisor":        "meridiano",
    "emisor_sub":    "COMPAÑÍA DE SEGUROS",
    "info": [
        "DOMICILIO SOCIAL: Avda. Jean Claude",
        "Combaldieu, 5  03008 Alicante",
        "C.I.F  A18000296",
        "info@meridiano.gruposav.com",
        "",
        "SERVICIO DE ATENCIÓN TELEFÓNICA:",
        "900 408 200",
        "O EN SU OFICINA MÁS CERCANA:",
        "cat@meridiano.gruposav.com",
        "958 294 089",
    ],
    "firma_pie":     "DIRECTORA GENERAL OPERATIVA",
    "por_empresa":   "POR MERIDIANO S.A.",

    # --- Cabecera de la rejilla (fila 1) ---
    "poliza":        "",                       # Nº DE PÓLIZA
    "origina":       "OFICINA DE ALMERÍA",     # ORIGINA
    "zona_cobro":    "ALM-001",                # ZONA COBRO

    # --- Fila 2 ---
    "tpago":         "MENSUAL",                # T. PAGO
    "fecha":         "May 2026",               # FECHA
    "suma_aseg":     "",                       # S. ASG. TOTAL
    "periodo":       "DEL 01/05/26 AL 31/05/26",  # PERIODO DE VALIDEZ

    # --- Tomador ---
    "cliente":       "ANA MARIA DIAZ GARCIA",
    "domicilio": [
        "CALLE CALIFORNIA 19",
        "04720 AGUADULCE (ALMERÍA)",
    ],

    # --- Desglose (deja vacío lo que no apliques) ---
    "prima":         "42,00",
    "ccs":           "",
    "rlea":          "",
    "ips":           "",
    "otros":         "",
    "total":         "42,00",

    # --- Pie ---
    "num_recibo":    "260015042001",           # Nº RECIBO (también va en el código de barras)
    "producto":      "Meridiano Protección Familiar",
    "pagado":        True,
}

SALIDA = os.path.join(os.path.dirname(__file__), "recibo.jpg")

# ----------------------------------------------------------------------
# Colores y fuentes
# ----------------------------------------------------------------------
AMARILLO = (245, 196, 0)
ROJO     = (200, 45, 45)
NEGRO    = (25, 25, 25)
GRIS     = (95, 95, 95)
GRIS_CL  = (150, 150, 150)
LINEA    = (60, 60, 60)

def fuente(size, bold=False):
    rutas = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold
            else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for r in rutas:
        if os.path.exists(r):
            return ImageFont.truetype(r, size)
    return ImageFont.load_default()

F  = lambda s: fuente(s, False)
FB = lambda s: fuente(s, True)

# ----------------------------------------------------------------------
# Lienzo apaisado, como el ticket original
# ----------------------------------------------------------------------
W, H = 1500, 660
PANEL = 430                      # ancho del panel izquierdo (emisor)
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

def texto(x, y, t, font, color=NEGRO, right=None, center=None):
    if right is not None:
        x = right - d.textlength(t, font=font)
    if center is not None:
        x = center - d.textlength(t, font=font) / 2
    d.text((x, y), t, font=font, fill=color)

# ----------------------------------------------------------------------
# PANEL IZQUIERDO — emisor
# ----------------------------------------------------------------------
px = 36
# logo: cuadrado amarillo + nombre
d.rounded_rectangle([px, 34, px + 40, 74], radius=8, fill=AMARILLO)
d.ellipse([px + 9, 43, px + 31, 65], fill="white")
texto(px + 52, 30, DATOS["emisor"], FB(48), NEGRO)
texto(px + 54, 84, DATOS["emisor_sub"], F(15), GRIS)

y = 120
for ln in DATOS["info"]:
    texto(px, y, ln, F(15), GRIS)
    y += 22

y += 6
texto(px, y, DATOS["por_empresa"], F(15), GRIS); y += 26
# firma estilizada (genérica, no es la rúbrica de ninguna persona concreta)
d.line([(px, y + 20), (px + 22, y), (px + 40, y + 28), (px + 70, y - 4),
        (px + 90, y + 22)], fill=(40, 40, 90), width=2, joint="curve")
y += 40
texto(px, y, DATOS["firma_pie"], F(13), GRIS)

# Código de barras (decorativo, derivado del nº de recibo)
def barcode(x, y, ancho, alto, codigo):
    import hashlib
    semilla = hashlib.md5(codigo.encode()).digest()
    # patrón de barras determinista a partir del código
    bits = []
    for b in (semilla * 4):
        bits.append((b & 1) + 1)        # ancho 1 o 2
        bits.append(((b >> 1) & 1) + 1)
    cx = x
    i = 0
    # barras de inicio
    for w in [2, 1, 1]:
        d.rectangle([cx, y, cx + w * 3, y + alto], fill=NEGRO); cx += w * 3
        cx += 3
    for w in bits:
        if cx > x + ancho - 30:
            break
        if i % 2 == 0:
            d.rectangle([cx, y, cx + w * 3, y + alto], fill=NEGRO)
        cx += w * 3 + 2
        i += 1
    # barras de fin
    for w in [1, 1, 2]:
        d.rectangle([cx, y, cx + w * 3, y + alto], fill=NEGRO); cx += w * 3 + 3
    texto(x, y + alto + 4, " ".join([codigo[i:i+4] for i in range(0, len(codigo), 4)]),
          F(15), NEGRO)

barcode(px, H - 120, PANEL - 70, 70, DATOS["num_recibo"])

# Divisoria amarilla vertical
d.rectangle([PANEL - 16, 24, PANEL - 6, H - 24], fill=AMARILLO)

# ----------------------------------------------------------------------
# PANEL DERECHO — datos del recibo (rejilla)
# ----------------------------------------------------------------------
RX = PANEL + 30
RW = W - RX - 36

def celda(x, y, label, value, w=None, val_font=None):
    """Etiqueta pequeña arriba y valor debajo."""
    texto(x, y, label, F(16), GRIS)
    texto(x, y + 22, value or "—", val_font or FB(24), NEGRO)

ry = 36
# Fila 1: PÓLIZA / ORIGINA / ZONA COBRO
c = RW / 3
celda(RX,            ry, "Nº DE PÓLIZA", DATOS["poliza"])
celda(RX + c,        ry, "ORIGINA",      DATOS["origina"], val_font=FB(20))
celda(RX + 2 * c,    ry, "ZONA COBRO",   DATOS["zona_cobro"])
ry += 78
d.line([(RX, ry), (W - 36, ry)], fill=LINEA, width=1)
ry += 14

# Fila 2: T.PAGO / FECHA / S.ASG.TOTAL / PERIODO
c4 = RW / 4
celda(RX,             ry, "T. PAGO",       DATOS["tpago"], val_font=FB(20))
celda(RX + c4,        ry, "FECHA",         DATOS["fecha"], val_font=FB(20))
celda(RX + 2 * c4,    ry, "S. ASG. TOTAL", DATOS["suma_aseg"], val_font=FB(20))
celda(RX + 3 * c4 - 30, ry, "PERIODO DE VALIDEZ", DATOS["periodo"], val_font=FB(18))
ry += 78
d.line([(RX, ry), (W - 36, ry)], fill=LINEA, width=1)
ry += 14

# Tomador
texto(RX, ry, "DATOS DEL TOMADOR Y DOMICILIO DEL RECIBO", F(16), GRIS); ry += 26
texto(RX, ry, DATOS["cliente"], FB(28), NEGRO); ry += 38
for ln in DATOS["domicilio"]:
    texto(RX, ry, ln, F(20), NEGRO); ry += 28
ry += 6
d.line([(RX, ry), (W - 36, ry)], fill=LINEA, width=1)
ry += 16

# Desglose: PRIMA TARIFA CCS RLEA IPS OTROS TOTAL
cols = [("PRIMA TARIFA", DATOS["prima"]), ("CCS", DATOS["ccs"]), ("RLEA", DATOS["rlea"]),
        ("IPS", DATOS["ips"]), ("OTROS", DATOS["otros"]), ("TOTAL", DATOS["total"])]
cw = RW / len(cols)
for i, (k, v) in enumerate(cols):
    cx = RX + i * cw
    ultimo = (i == len(cols) - 1)
    texto(cx, ry, k, F(16), GRIS)
    texto(cx, ry + 24, v or "", FB(28 if ultimo else 22), NEGRO)
ry += 80

# Nº recibo + producto
texto(RX, ry, "Nº RECIBO:  " + DATOS["num_recibo"], FB(18), NEGRO)
texto(W - 36, ry, DATOS["producto"], F(18), GRIS, right=W - 36)

# Sello PAGADO (diagonal, sobre la zona del total)
if DATOS["pagado"]:
    sello = Image.new("RGBA", (300, 110), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sello)
    sd.rounded_rectangle([6, 6, 294, 104], radius=12, outline=ROJO, width=6)
    sd.text((34, 24), "PAGADO", font=FB(56), fill=ROJO)
    sello = sello.rotate(10, expand=True)
    img.paste(sello, (W - 400, 250), sello)

# Marco exterior del ticket
d.rectangle([6, 6, W - 7, H - 7], outline=GRIS_CL, width=2)

img.save(SALIDA, "JPEG", quality=92)
print("Recibo generado:", SALIDA, img.size)
