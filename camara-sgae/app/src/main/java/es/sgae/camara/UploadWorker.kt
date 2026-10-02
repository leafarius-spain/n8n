package es.sgae.camara

import android.content.Context
import android.net.Uri
import androidx.work.Worker
import androidx.work.WorkerParameters
import java.net.HttpURLConnection
import java.net.URL
import java.util.UUID

/**
 * POST multipart/form-data a Julietta:
 *   archivo (binario), tipo (foto|video), codigo_local, lat, lon
 * Cabecera Authorization: Bearer <token> si hay token.
 * Reintenta con backoff ante error de red o 5xx; 4xx se descarta.
 */
class UploadWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {

    override fun doWork(): Result {
        val uri = Uri.parse(inputData.getString(K_URI) ?: return Result.failure())
        val url = inputData.getString(K_URL) ?: return Result.failure()
        val tipo = inputData.getString(K_TIPO) ?: "foto"
        val b = "----sgae" + UUID.randomUUID()

        return try {
            val con = (URL(url).openConnection() as HttpURLConnection).apply {
                requestMethod = "POST"
                doOutput = true
                setChunkedStreamingMode(64 * 1024)
                connectTimeout = 20_000
                readTimeout = 60_000
                setRequestProperty("Content-Type", "multipart/form-data; boundary=$b")
                if (BuildConfig.UPLOAD_TOKEN.isNotBlank())
                    setRequestProperty("Authorization", "Bearer ${BuildConfig.UPLOAD_TOKEN}")
            }
            con.outputStream.buffered().use { out ->
                fun campo(n: String, v: String?) {
                    if (v == null) return
                    out.write("--$b\r\nContent-Disposition: form-data; name=\"$n\"\r\n\r\n$v\r\n".toByteArray())
                }
                campo("tipo", tipo)
                campo("codigo_local", inputData.getString(K_CODIGO))
                if (inputData.keyValueMap.containsKey(K_LAT)) {
                    campo("lat", inputData.getDouble(K_LAT, 0.0).toString())
                    campo("lon", inputData.getDouble(K_LON, 0.0).toString())
                }
                val mime = if (tipo == "video") "video/mp4" else "image/jpeg"
                val nombre = uri.lastPathSegment ?: "captura"
                out.write("--$b\r\nContent-Disposition: form-data; name=\"archivo\"; filename=\"$nombre\"\r\nContent-Type: $mime\r\n\r\n".toByteArray())
                applicationContext.contentResolver.openInputStream(uri)?.use { it.copyTo(out) }
                    ?: return Result.failure()
                out.write("\r\n--$b--\r\n".toByteArray())
            }
            when (con.responseCode) {
                in 200..299 -> Result.success()
                in 400..499 -> Result.failure()
                else -> Result.retry()
            }
        } catch (e: java.io.IOException) {
            Result.retry()
        }
    }

    companion object {
        const val K_URI = "uri"
        const val K_TIPO = "tipo"
        const val K_CODIGO = "codigo"
        const val K_URL = "url"
        const val K_LAT = "lat"
        const val K_LON = "lon"
    }
}
