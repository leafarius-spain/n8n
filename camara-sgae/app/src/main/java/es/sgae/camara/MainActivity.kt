package es.sgae.camara

import android.Manifest
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.PorterDuff
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.view.Gravity
import android.view.ViewGroup.LayoutParams.MATCH_PARENT
import android.view.ViewGroup.LayoutParams.WRAP_CONTENT
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.camera.core.CameraEffect
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.Preview
import androidx.camera.core.UseCaseGroup
import androidx.camera.effects.OverlayEffect
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.video.MediaStoreOutputOptions
import androidx.camera.video.Quality
import androidx.camera.video.QualitySelector
import androidx.camera.video.Recorder
import androidx.camera.video.Recording
import androidx.camera.video.VideoCapture
import androidx.camera.video.VideoRecordEvent
import androidx.camera.view.PreviewView
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.workDataOf
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Foto y vídeo con fecha, hora, coordenadas y dirección sobreimpresas
 * (en vista previa, foto y vídeo, vía OverlayEffect de CameraX).
 *
 * Enlace de entrada: camarasgae://capturar?modo=foto|video&codigo=L000123&retorno=<url>
 */
class MainActivity : AppCompatActivity() {

    private lateinit var previewView: PreviewView
    private lateinit var btnCapturar: Button
    private lateinit var btnModo: Button
    private lateinit var geo: GeoStamp

    private var imageCapture: ImageCapture? = null
    private var videoCapture: VideoCapture<Recorder>? = null
    private var recording: Recording? = null

    private var modoVideo = false
    private var codigo: String? = null
    private var retorno: String? = null
    private var subida: String? = null

    private val fechaFmt = SimpleDateFormat("dd/MM/yyyy", Locale.getDefault())
    private val horaFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

    private val texto = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.RIGHT
        setShadowLayer(6f, 0f, 0f, Color.BLACK)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        leerEnlace(intent)
        construirUi()
        geo = GeoStamp(this)

        if (faltanPermisos()) {
            ActivityCompat.requestPermissions(this, PERMISOS, 1)
        } else {
            arrancar()
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        leerEnlace(intent)
        actualizarBotones()
    }

    private fun leerEnlace(i: Intent?) {
        val u = i?.data ?: return
        modoVideo = u.getQueryParameter("modo") == "video"
        codigo = u.getQueryParameter("codigo")
        retorno = u.getQueryParameter("retorno")
        subida = u.getQueryParameter("subida")
    }

    private fun construirUi() {
        previewView = PreviewView(this)
        btnCapturar = Button(this).apply { setOnClickListener { capturar() } }
        btnModo = Button(this).apply {
            setOnClickListener {
                if (recording == null) { modoVideo = !modoVideo; actualizarBotones() }
            }
        }
        val barra = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER
            addView(btnModo)
            addView(btnCapturar)
        }
        setContentView(FrameLayout(this).apply {
            addView(previewView, FrameLayout.LayoutParams(MATCH_PARENT, MATCH_PARENT))
            addView(barra, FrameLayout.LayoutParams(MATCH_PARENT, WRAP_CONTENT, Gravity.BOTTOM).apply {
                bottomMargin = 48
            })
        })
        actualizarBotones()
    }

    private fun actualizarBotones() {
        btnModo.text = if (modoVideo) "Modo: Vídeo" else "Modo: Foto"
        btnCapturar.text = when {
            recording != null -> "Parar"
            modoVideo -> "Grabar"
            else -> "Foto"
        }
    }

    private fun faltanPermisos() = PERMISOS.any {
        ContextCompat.checkSelfPermission(this, it) != PackageManager.PERMISSION_GRANTED
    }

    override fun onRequestPermissionsResult(code: Int, perms: Array<out String>, res: IntArray) {
        super.onRequestPermissionsResult(code, perms, res)
        if (faltanPermisos()) {
            Toast.makeText(this, "Se necesitan cámara, micrófono y ubicación", Toast.LENGTH_LONG).show()
            finish()
        } else arrancar()
    }

    private fun arrancar() {
        geo.start()
        val future = ProcessCameraProvider.getInstance(this)
        future.addListener({
            val provider = future.get()

            val preview = Preview.Builder().build().also { it.setSurfaceProvider(previewView.surfaceProvider) }
            val image = ImageCapture.Builder().build().also { imageCapture = it }
            val video = VideoCapture.withOutput(
                Recorder.Builder().setQualitySelector(QualitySelector.from(Quality.HD)).build()
            ).also { videoCapture = it }

            val group = UseCaseGroup.Builder()
                .addUseCase(preview).addUseCase(image).addUseCase(video)
                .addEffect(crearSobreimpresion())
                .build()

            provider.unbindAll()
            provider.bindToLifecycle(this, CameraSelector.DEFAULT_BACK_CAMERA, group)
        }, ContextCompat.getMainExecutor(this))
    }

    /** Dibuja los datos en cada fotograma: preview, foto y vídeo salen idénticos. */
    private fun crearSobreimpresion(): OverlayEffect {
        val efecto = OverlayEffect(
            CameraEffect.PREVIEW or CameraEffect.IMAGE_CAPTURE or CameraEffect.VIDEO_CAPTURE,
            0, Handler(Looper.getMainLooper())
        ) { it.printStackTrace() }

        efecto.setOnDrawListener { frame ->
            val c: Canvas = frame.overlayCanvas
            c.drawColor(Color.TRANSPARENT, PorterDuff.Mode.CLEAR)

            val ancho = frame.size.width.toFloat()
            val alto = frame.size.height.toFloat()
            // El buffer puede ir girado: el tamaño de letra sigue al lado corto.
            texto.textSize = minOf(ancho, alto) * 0.045f
            val margen = texto.textSize * 0.6f
            val interlinea = texto.textSize * 1.15f

            val ahora = Date()
            val lineas = mutableListOf<String>()
            codigo?.let { lineas += it }
            lineas += fechaFmt.format(ahora)
            lineas += horaFmt.format(ahora)
            lineas += geo.coordsText()
            lineas += geo.address.split("\n").filter { it.isNotBlank() }

            var y = alto - margen - interlinea * (lineas.size - 1)
            for (l in lineas) { c.drawText(l, ancho - margen, y, texto); y += interlinea }
            true
        }
        return efecto
    }

    private fun capturar() {
        if (modoVideo) alternarGrabacion() else hacerFoto()
    }

    private fun nombre() = "SGAE_" + (codigo?.let { "${it}_" } ?: "") +
        SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())

    private fun hacerFoto() {
        val ic = imageCapture ?: return
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, nombre())
            put(MediaStore.MediaColumns.MIME_TYPE, "image/jpeg")
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Pictures/CamaraSGAE")
        }
        val opts = ImageCapture.OutputFileOptions.Builder(
            contentResolver, MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values
        ).build()
        ic.takePicture(opts, ContextCompat.getMainExecutor(this), object : ImageCapture.OnImageSavedCallback {
            override fun onImageSaved(r: ImageCapture.OutputFileResults) = terminar(r.savedUri, "foto")
            override fun onError(e: ImageCaptureException) {
                Toast.makeText(this@MainActivity, "Error: ${e.message}", Toast.LENGTH_LONG).show()
            }
        })
    }

    private fun alternarGrabacion() {
        recording?.let { it.stop(); return }
        val vc = videoCapture ?: return
        val values = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, nombre())
            put(MediaStore.MediaColumns.RELATIVE_PATH, "Movies/CamaraSGAE")
        }
        val opts = MediaStoreOutputOptions.Builder(contentResolver, MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
            .setContentValues(values).build()
        @Suppress("MissingPermission")
        recording = vc.output.prepareRecording(this, opts).withAudioEnabled()
            .start(ContextCompat.getMainExecutor(this)) { ev ->
                if (ev is VideoRecordEvent.Finalize) {
                    recording = null
                    actualizarBotones()
                    if (ev.hasError()) {
                        Toast.makeText(this, "Error de vídeo (${ev.error})", Toast.LENGTH_LONG).show()
                    } else terminar(ev.outputResults.outputUri, "video")
                }
            }
        actualizarBotones()
    }

    /** Sube a Julietta en segundo plano; reintenta solo si no hay red. */
    private fun encolarSubida(uri: Uri, tipo: String) {
        val url = subida ?: BuildConfig.UPLOAD_URL
        if (url.isBlank()) return
        val req = OneTimeWorkRequestBuilder<UploadWorker>()
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
            .setInputData(workDataOf(
                UploadWorker.K_URI to uri.toString(),
                UploadWorker.K_TIPO to tipo,
                UploadWorker.K_CODIGO to codigo,
                UploadWorker.K_URL to url,
                UploadWorker.K_LAT to geo.location?.latitude,
                UploadWorker.K_LON to geo.location?.longitude,
            ))
            .build()
        WorkManager.getInstance(this).enqueue(req)
    }

    /** Si Julietta pasó `retorno`, se vuelve a ella con la ruta del archivo; si no, se queda aquí. */
    private fun terminar(uri: Uri?, tipo: String) {
        Toast.makeText(this, "Guardado: $tipo", Toast.LENGTH_SHORT).show()
        if (uri != null) encolarSubida(uri, tipo)
        val base = retorno ?: return
        val destino = Uri.parse(base).buildUpon()
            .appendQueryParameter("archivo", uri.toString())
            .appendQueryParameter("tipo", tipo)
            .apply { codigo?.let { appendQueryParameter("codigo", it) } }
            .build()
        startActivity(Intent(Intent.ACTION_VIEW, destino))
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        if (::geo.isInitialized) geo.stop()
    }

    companion object {
        private val PERMISOS = arrayOf(
            Manifest.permission.CAMERA,
            Manifest.permission.RECORD_AUDIO,
            Manifest.permission.ACCESS_FINE_LOCATION,
        )
    }
}
