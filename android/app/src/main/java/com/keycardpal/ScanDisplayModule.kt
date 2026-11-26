package com.keycardpal

import android.view.WindowManager
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class ScanDisplayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {
    override fun getName() = "ScanDisplay"

    @ReactMethod
    fun raise() = setWindow(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_FULL, true)

    @ReactMethod
    fun restore() = setWindow(WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE, false)

    private fun setWindow(brightness: Float, keepAwake: Boolean) {
        val activity = reactApplicationContext.currentActivity ?: return
        activity.runOnUiThread {
            val window = activity.window
            window.attributes = window.attributes.apply { screenBrightness = brightness }
            if (keepAwake) {
                window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            } else {
                window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
            }
        }
    }
}
