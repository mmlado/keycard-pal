package com.keycardpal

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class BuildConfigModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "BuildConfig"

    override fun getConstants(): Map<String, Any> = mapOf(
        "INTERNET_ENABLED" to BuildConfig.INTERNET_ENABLED,
        "WC_PROJECT_ID" to BuildConfig.WC_PROJECT_ID,
    )
}
