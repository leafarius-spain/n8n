#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Genera un recibo de seguro como imagen JPG (no editable) listo para WhatsApp.
Uso: edita el diccionario DATOS y ejecuta:  python3 generar_recibo.py
"""
import os
from PIL import Image, ImageDraw, ImageFont

# ----------------------------------------------------------------------
# DATOS DEL RECIBO  (edita aquí y vuelve a ejecutar)
# ----------------------------------------------------------------------
DATOS = {
    # Emisor / compañía
    "emisor":      "Meridiano",
    "emisor_sub":  "COMPAÑÍA DE SEGUROS",
    "domicilio_social": "Avda. Jean Claude Combaldieu, 5 · 03008 Alicante",
    "cif":         "A18000296",
    "telefono":    "900 408 200",
    "email":       "info@meridiano.gruposav.com",
    "agente":      "",                       # nombre del agente / cobrador

    # Datos del recibo
    "num_recibo":  "2026-0001",
    "poliza":      "",
    "producto":    "Protección Familiar",
    "fecha":       "15/05/26",
    "forma_pago":  "MENSUAL",
    "metodo":      "EFECTIVO",
    "periodo":     "Del 01/05/26 al 31/05/26",
    "concepto":    "Mes de mayo",

    # Cliente
    "cliente":     "ANA MARIA DIAZ GARCIA",
    "domicilio":   "Calle California 19, Aguadulce, Almería",

    # Importe (deja desglose vacío si solo quieres el total)
    "prima":       "",
    "ccs":         "",
    "rlea":        "",
    "ips":         "",
    "otros":       "",
    "total":       "42,00",
}

SALIDA = os.path.join(os.path.dirname(__file__), "recibo.jpg")

# ----------------------------------------------------------------------
# Colores y medidas
# ----------------------------------------------------------------------
W = 1000
AMARILLO = (244, 194, 13)
ROJO     = (198, 40, 40)
GRIS     = (90, 90, 90)
GRIS_CL  = (140, 140, 140)
NEGRO    = (30, 30, 30)
LINEA    = (210, 210, 210)

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

F      = lambda s: fuente(s, False)
FB     = lambda s: fuente(s, True)

# Lienzo amplio; recortamos al final a la altura usada
img = Image.new("RGB", (W, 1600), "white")
d = ImageDraw.Draw(img)

PAD = 50
y = 0

def texto(x, yy, t, font, color=NEGRO, right=None):
    if right is not None:
        w = d.textlength(t, font=font)
        x = right - w
    d.text((x, yy), t, font=font, fill=color)

def linea_kv(yy, k, v):
    texto(PAD, yy, k, F(26), GRIS)
    texto(0, yy, v, FB(26), NEGRO, right=W - PAD)
    d.line([(PAD, yy + 38), (W - PAD, yy + 38)], fill=LINEA, width=1)
    return yy + 50

# ---------- Cabecera con barra amarilla ----------
d.rectangle([0, 0, W, 200], fill="white")
d.rectangle([0, 0, 16, 200], fill=AMARILLO)          # barra lateral
texto(PAD, 30, DATOS["emisor"], FB(58), NEGRO)
texto(PAD, 100, DATOS["emisor_sub"], F(22), GRIS)
# datos pequeños del emisor a la derecha
infos = []
if DATOS["domicilio_social"]: infos.append(DATOS["domicilio_social"])
if DATOS["cif"]:      infos.append("C.I.F. " + DATOS["cif"])
if DATOS["telefono"]: infos.append("Tel. " + DATOS["telefono"])
if DATOS["email"]:    infos.append(DATOS["email"])
yy = 30
for it in infos:
    texto(0, yy, it, F(18), GRIS, right=W - PAD)
    yy += 26
d.rectangle([0, 200, W, 206], fill=AMARILLO)         # línea inferior cabecera
y = 240

# ---------- Datos del recibo ----------
y = linea_kv(y, "Nº de póliza", DATOS["poliza"] or "—")
y = linea_kv(y, "Nº de recibo", DATOS["num_recibo"])
y = linea_kv(y, "Fecha", DATOS["fecha"])
y = linea_kv(y, "Forma de pago", DATOS["forma_pago"])
y = linea_kv(y, "Periodo de validez", DATOS["periodo"] or "—")
y = linea_kv(y, "Concepto", DATOS["concepto"] or DATOS["producto"] or "—")

# ---------- Tomador ----------
y += 14
d.line([(PAD, y), (W - PAD, y)], fill=GRIS, width=2)
y += 14
texto(PAD, y, "DATOS DEL TOMADOR Y DOMICILIO DEL RECIBO", F(18), GRIS_CL); y += 30
texto(PAD, y, DATOS["cliente"], FB(34), NEGRO); y += 44
if DATOS["domicilio"]:
    texto(PAD, y, DATOS["domicilio"], F(26), (60, 60, 60)); y += 38
y += 8
d.line([(PAD, y), (W - PAD, y)], fill=GRIS, width=2)
y += 24

# ---------- Desglose (si hay) ----------
desg = [("Prima", DATOS["prima"]), ("CCS", DATOS["ccs"]), ("RLEA", DATOS["rlea"]),
        ("IPS", DATOS["ips"]), ("Otros", DATOS["otros"]), ("Total", DATOS["total"])]
hay_desglose = any(v.strip() for _, v in desg[:-1])
if hay_desglose:
    cols = len(desg)
    cw = (W - 2 * PAD) // cols
    x0 = PAD
    d.rectangle([x0, y, x0 + cw * cols, y + 40], fill=(247, 247, 247))
    for i, (k, _) in enumerate(desg):
        cx = x0 + i * cw
        d.rectangle([cx, y, cx + cw, y + 80], outline=LINEA, width=1)
        texto(cx + 8, y + 8, k, F(20), GRIS)
    for i, (_, v) in enumerate(desg):
        cx = x0 + i * cw
        texto(0, y + 46, (v or "0,00"), FB(22), NEGRO, right=cx + cw - 8)
    y += 100

# ---------- Sello PAGADO (a la izquierda del total, sin tapar texto) ----------
sello = Image.new("RGBA", (260, 90), (0, 0, 0, 0))
sd = ImageDraw.Draw(sello)
sd.rounded_rectangle([4, 4, 256, 86], radius=10, outline=ROJO, width=5)
sd.text((30, 18), "PAGADO", font=FB(48), fill=ROJO)
sello = sello.rotate(8, expand=True)
img.paste(sello, (PAD, y - 6), sello)

# ---------- Total grande ----------
total_txt = DATOS["total"] + " €"
total_w = d.textlength(total_txt, font=FB(56))
texto(0, y + 8, "TOTAL", FB(34), GRIS, right=W - PAD - total_w - 24)
texto(0, y - 6, total_txt, FB(56), NEGRO, right=W - PAD)
y += 80
texto(0, y, "Pagado en " + DATOS["metodo"].lower(), F(24), GRIS, right=W - PAD)
y += 50

# ---------- Pie / firma ----------
d.line([(PAD, y), (W - PAD, y)], fill=LINEA, width=1); y += 18
texto(PAD, y, "He recibido la cantidad indicada en concepto", F(20), GRIS)
texto(PAD, y + 26, "de pago del recibo.", F(20), GRIS)
# firma
fx = W - PAD - 280
d.line([(fx, y + 70), (fx + 280, y + 70)], fill=(120, 120, 120), width=2)
texto(fx, y + 76, "Firma / Agente", F(20), GRIS)
if DATOS["agente"]:
    texto(fx, y + 102, DATOS["agente"], FB(22), NEGRO)
y += 150

# ---------- Marco y recorte ----------
final = img.crop((0, 0, W, y + 20))
marco = ImageDraw.Draw(final)
marco.rectangle([0, 0, W - 1, final.height - 1], outline=(150, 150, 150), width=2)
final.save(SALIDA, "JPEG", quality=92)
print("Recibo generado:", SALIDA, final.size)
