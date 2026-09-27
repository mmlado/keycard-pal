package com.keycardpal

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event

class ReadCodeEvent(
    surfaceId: Int,
    viewId: Int,
    private val codeValue: String,
    // Byte-mode payloads only. `codeValue` is charset-guessed and cannot carry
    // arbitrary bytes, so a binary QR is only readable through this field.
    private val codeBytesBase64: String?,
) : Event<ReadCodeEvent>(surfaceId, viewId) {
    override fun getEventName() = EVENT_NAME

    override fun getEventData() =
        Arguments.createMap().apply {
            putString("codeStringValue", codeValue)
            putString("codeBytesBase64", codeBytesBase64)
        }

    companion object {
        const val EVENT_NAME = "topReadCode"
    }
}
