package com.keycardpal

import android.content.Context
import android.util.AttributeSet
import android.widget.FrameLayout
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import com.facebook.react.bridge.ReactContext
import com.facebook.react.uimanager.UIManagerHelper
import com.google.zxing.BinaryBitmap
import com.google.zxing.DecodeHintType
import com.google.zxing.MultiFormatReader
import com.google.zxing.NotFoundException
import com.google.zxing.PlanarYUVLuminanceSource
import com.google.zxing.common.HybridBinarizer
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors

class CameraView
    @JvmOverloads
    constructor(
        context: Context,
        attrs: AttributeSet? = null,
    ) : FrameLayout(context, attrs) {
        private val previewView =
            PreviewView(context).apply {
                implementationMode = PreviewView.ImplementationMode.PERFORMANCE
            }
        private val executor: ExecutorService = Executors.newSingleThreadExecutor()
        private val reader = MultiFormatReader()

        init {
            addView(previewView, LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT)
            reader.setHints(
                mapOf(
                    DecodeHintType.POSSIBLE_FORMATS to listOf(com.google.zxing.BarcodeFormat.QR_CODE),
                    DecodeHintType.TRY_HARDER to true,
                ),
            )
        }

        // React Native sets dimensions on this ViewGroup via its own layout pass but doesn't
        // re-measure children. Force a re-layout so PreviewView gets non-zero dimensions.
        override fun requestLayout() {
            super.requestLayout()
            post {
                measure(
                    MeasureSpec.makeMeasureSpec(width, MeasureSpec.EXACTLY),
                    MeasureSpec.makeMeasureSpec(height, MeasureSpec.EXACTLY),
                )
                layout(left, top, right, bottom)
            }
        }

        override fun onAttachedToWindow() {
            super.onAttachedToWindow()
            startCamera()
        }

        private fun startCamera() {
            val reactContext = context as? ReactContext ?: return
            val lifecycleOwner = reactContext.currentActivity as? LifecycleOwner ?: return

            val cameraProviderFuture = ProcessCameraProvider.getInstance(context)
            cameraProviderFuture.addListener(
                {
                    val cameraProvider = cameraProviderFuture.get()

                    val preview =
                        Preview.Builder().build().also {
                            it.setSurfaceProvider(previewView.surfaceProvider)
                        }

                    val imageAnalysis =
                        ImageAnalysis.Builder()
                            .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                            .build()
                            .also { it.setAnalyzer(executor, ::analyzeImage) }

                    try {
                        cameraProvider.unbindAll()
                        cameraProvider.bindToLifecycle(
                            lifecycleOwner,
                            CameraSelector.DEFAULT_BACK_CAMERA,
                            preview,
                            imageAnalysis,
                        )
                    } catch (_: Exception) {
                    }
                },
                ContextCompat.getMainExecutor(context),
            )
        }

        private fun analyzeImage(imageProxy: ImageProxy) {
            try {
                val data = extractLuminanceData(imageProxy)

                val source =
                    PlanarYUVLuminanceSource(
                        data,
                        imageProxy.width,
                        imageProxy.height,
                        0,
                        0,
                        imageProxy.width,
                        imageProxy.height,
                        false,
                    )

                val result = reader.decodeWithState(BinaryBitmap(HybridBinarizer(source)))
                dispatchCodeEvent(result.text)
            } catch (_: NotFoundException) {
                // no QR in frame — expected
            } finally {
                reader.reset()
                imageProxy.close()
            }
        }

        private fun extractLuminanceData(imageProxy: ImageProxy): ByteArray {
            val plane = imageProxy.planes[0]
            val buffer = plane.buffer
            val width = imageProxy.width
            val height = imageProxy.height
            val rowStride = plane.rowStride
            val pixelStride = plane.pixelStride

            if (rowStride == width && pixelStride == 1) {
                return ByteArray(buffer.remaining()).also { buffer.get(it) }
            }

            val data = ByteArray(width * height)
            for (row in 0 until height) {
                for (col in 0 until width) {
                    data[row * width + col] = buffer.get(row * rowStride + col * pixelStride)
                }
            }
            return data
        }

        private fun dispatchCodeEvent(value: String) {
            val reactContext = context as? ReactContext ?: return
            val surfaceId = UIManagerHelper.getSurfaceId(reactContext)
            val dispatcher = UIManagerHelper.getEventDispatcherForReactTag(reactContext, id)
            dispatcher?.dispatchEvent(ReadCodeEvent(surfaceId, id, value))
        }

        override fun onDetachedFromWindow() {
            super.onDetachedFromWindow()
            executor.shutdown()
        }
    }
