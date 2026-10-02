# Cámara SGAE

App Android (Kotlin + CameraX) que hace fotos y graba vídeo con **fecha, hora,
coordenadas GPS y dirección sobreimpresas** en el propio archivo (no solo en pantalla).

## Llamarla desde Julietta

    camarasgae://capturar?modo=foto&codigo=L000123&retorno=https://tu-url/callback

- `modo`: `foto` (por defecto) o `video`.
- `codigo`: opcional; se imprime como primera línea y entra en el nombre del archivo.
- `retorno`: opcional; al terminar se abre `retorno?archivo=<content-uri>&tipo=foto|video&codigo=...`.

Los archivos se guardan en `Pictures/CamaraSGAE` y `Movies/CamaraSGAE`.

## Compilar

Abrir esta carpeta en Android Studio y ejecutar `app`, o con Gradle: `gradle :app:assembleDebug`.

## Pendiente

- Minimapa (como en la captura): requiere clave de Google Static Maps o teselas OSM.
- Probar en dispositivo real: el código no se ha compilado ni ejecutado en este entorno.
