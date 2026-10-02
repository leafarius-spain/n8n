plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "es.sgae.camara"
    compileSdk = 34
    defaultConfig {
        applicationId = "es.sgae.camara"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
        // Se definen en ~/.gradle/gradle.properties o con -P; nunca en el repo.
        val subidaUrl = (project.findProperty("JULIETTA_UPLOAD_URL") as String?) ?: ""
        val subidaToken = (project.findProperty("JULIETTA_TOKEN") as String?) ?: ""
        buildConfigField("String", "UPLOAD_URL", "\"$subidaUrl\"")
        buildConfigField("String", "UPLOAD_TOKEN", "\"$subidaToken\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
}

dependencies {
    val camerax = "1.4.0"
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.camera:camera-core:$camerax")
    implementation("androidx.camera:camera-camera2:$camerax")
    implementation("androidx.camera:camera-lifecycle:$camerax")
    implementation("androidx.camera:camera-video:$camerax")
    implementation("androidx.camera:camera-view:$camerax")
    implementation("androidx.camera:camera-effects:$camerax")
    implementation("androidx.work:work-runtime-ktx:2.9.1")
}
