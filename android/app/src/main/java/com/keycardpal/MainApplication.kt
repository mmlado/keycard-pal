package com.keycardpal

import android.app.Application
import androidx.appcompat.app.AppCompatDelegate
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {
    override val reactHost: ReactHost by lazy {
        getDefaultReactHost(
            context = applicationContext,
            packageList =
                PackageList(this).packages.apply {
                    addAll(onlineNativePackages())
                    add(BuildConfigPackage())
                    add(CameraPackage())
                },
        )
    }

    override fun onCreate() {
        // The app is dark on every phone. React Native's edge-to-edge setup picks the
        // system bar icon colours from night mode, for the activity and every Modal.
        AppCompatDelegate.setDefaultNightMode(AppCompatDelegate.MODE_NIGHT_YES)
        super.onCreate()
        loadReactNative(this)
    }
}
