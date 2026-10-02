package es.sgae.camara

import android.annotation.SuppressLint
import android.content.Context
import android.location.Geocoder
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import java.util.Locale
import java.util.concurrent.Executors

/** Mantiene la última posición GPS y su dirección para sobreimprimirlas. */
class GeoStamp(private val context: Context) : LocationListener {

    @Volatile var location: Location? = null
        private set
    @Volatile var address: String = ""
        private set

    private val manager = context.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private val geocoder = Geocoder(context, Locale("es", "ES"))
    private val io = Executors.newSingleThreadExecutor()
    private var lastGeocoded: Location? = null

    @SuppressLint("MissingPermission")
    fun start() {
        for (p in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
            if (manager.isProviderEnabled(p)) {
                manager.getLastKnownLocation(p)?.let { onLocationChanged(it) }
                manager.requestLocationUpdates(p, 2000L, 5f, this)
            }
        }
    }

    fun stop() = manager.removeUpdates(this)

    /** "36.8433639N 2.4581272W" */
    fun coordsText(): String {
        val l = location ?: return "Sin señal GPS"
        val ns = if (l.latitude >= 0) "N" else "S"
        val ew = if (l.longitude >= 0) "E" else "W"
        return "%.7f%s %.7f%s".format(Locale.US, Math.abs(l.latitude), ns, Math.abs(l.longitude), ew)
    }

    override fun onLocationChanged(l: Location) {
        location = l
        val prev = lastGeocoded
        if (prev == null || prev.distanceTo(l) > 20f) {
            lastGeocoded = l
            io.execute {
                @Suppress("DEPRECATION")
                val a = runCatching { geocoder.getFromLocation(l.latitude, l.longitude, 1)?.firstOrNull() }.getOrNull()
                if (a != null) {
                    val calle = listOfNotNull(a.thoroughfare, a.subThoroughfare).joinToString(" ")
                    val ciudad = listOfNotNull(a.locality, a.subAdminArea, a.postalCode).distinct().joinToString(" ")
                    address = listOf(calle, ciudad).filter { it.isNotBlank() }.joinToString("\n")
                }
            }
        }
    }

    @Deprecated("Requerido en APIs antiguas")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
}
