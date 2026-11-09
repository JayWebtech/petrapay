package com.petrapay.pos.device

import android.os.Build
import com.petrapay.pos.BuildConfig
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

/**
 * Static facts about this terminal, read once by JS at startup: the model (used
 * as the default terminal name when pairing) and the PetraPay server baked in at
 * build time (-PPETRAPAY_API_URL=…), which the merchant can change when pairing.
 */
class PetraDeviceModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = NAME

  override fun getConstants(): Map<String, Any> {
    return mapOf(
      "manufacturer" to Build.MANUFACTURER,
      "model" to Build.MODEL,
      "apiBaseUrl" to BuildConfig.PETRAPAY_API_URL,
      "isDebug" to BuildConfig.DEBUG,
    )
  }

  companion object {
    const val NAME = "PetraDevice"
  }
}
