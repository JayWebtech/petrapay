package com.petrapay.pos.device

import com.petrapay.pos.printer.PetraPrinterModule
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/** The app's own native modules: device facts, the session store, and the receipt printer. */
class PetraDevicePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(
      PetraDeviceModule(reactContext),
      PetraSecureStoreModule(reactContext),
      PetraPrinterModule(reactContext),
    )

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
