package com.keycardpal

import android.os.Bundle
import android.view.ViewGroup
import android.view.ViewTreeObserver
import androidx.core.splashscreen.SplashScreen
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * How long the splash may wait for React. Past this the activity is shown as it
 * is: a stuck bundle must not leave the user on a splash that never ends.
 */
private const val SPLASH_TIMEOUT_MS = 5_000L

class MainActivity : ReactActivity() {
    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "KeycardPal"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate = DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        // Before super: the library replaces the window's theme with
        // `postSplashScreenTheme` and has to do it before the content view exists.
        val splashScreen = installSplashScreen()
        super.onCreate(savedInstanceState)
        holdSplashUntilFirstJsFrame(splashScreen)
    }

    /**
     * The React root view is in the tree from `setContentView` on but stays empty
     * until JavaScript mounts its first component. Holding the splash until then
     * covers the gap the window background used to show.
     */
    private fun holdSplashUntilFirstJsFrame(splashScreen: SplashScreen) {
        val content = findViewById<ViewGroup>(android.R.id.content)
        var jsMounted = false
        splashScreen.setKeepOnScreenCondition { !jsMounted }
        // Nothing to animate out: the splash is the same background the first JS
        // frame paints. The system's exit would fade and zoom it for no reason.
        splashScreen.setOnExitAnimationListener { splashView -> splashView.remove() }

        val release =
            Runnable {
                jsMounted = true
                // The condition is read on the next pre-draw, which a stalled JS
                // thread would never schedule on its own.
                content.invalidate()
            }
        content.viewTreeObserver.addOnPreDrawListener(
            object : ViewTreeObserver.OnPreDrawListener {
                override fun onPreDraw(): Boolean {
                    if (!jsMounted && !hasMountedReactViews(content)) {
                        return true
                    }
                    content.viewTreeObserver.removeOnPreDrawListener(this)
                    release.run()
                    return true
                }
            },
        )
        content.postDelayed(release, SPLASH_TIMEOUT_MS)
    }

    private fun hasMountedReactViews(content: ViewGroup): Boolean =
        (0 until content.childCount).any { index ->
            val rootView = content.getChildAt(index)
            rootView is ViewGroup && rootView.childCount > 0
        }
}
