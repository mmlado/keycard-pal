package com.keycardpal

import com.facebook.react.bridge.Arguments
import com.facebook.react.uimanager.events.Event

class ReadCodeEvent(
    surfaceId: Int,
    viewId: Int,
    private val codeValue: String,
) : Event<ReadCodeEvent>(surfaceId, viewId) {
    override fun getEventName() = EVENT_NAME

    override fun getEventData() =
        Arguments.createMap().apply {
            putString("codeStringValue", codeValue)
        }

    companion object {
        const val EVENT_NAME = "topReadCode"
    }
}
