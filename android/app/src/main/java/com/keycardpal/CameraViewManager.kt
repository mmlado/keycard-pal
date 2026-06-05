package com.keycardpal

import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext

class CameraViewManager : SimpleViewManager<CameraView>() {
    override fun getName() = "CameraView"

    override fun createViewInstance(context: ThemedReactContext) = CameraView(context)

    override fun getExportedCustomDirectEventTypeConstants() =
        mapOf(
            ReadCodeEvent.EVENT_NAME to mapOf("registrationName" to "onReadCode"),
        )
}
