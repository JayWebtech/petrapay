package com.petrapay.pos.printer

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.os.IBinder
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.bridge.ReadableMap
import recieptservice.com.recieptservice.PrinterInterface
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

/**
 * The H10's built-in thermal printer, reached through the device's printer
 * service (recieptservice.com.recieptservice) over its AIDL interface.
 *
 * JS sends a receipt as a list of simple operations (text, columns, QR, feed);
 * they run on one background thread as a single job (beginWork/endWork), so
 * printing never blocks the UI and two receipts can't interleave.
 */
class PetraPrinterModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName() = NAME

  private val worker = Executors.newSingleThreadExecutor()
  @Volatile private var printer: PrinterInterface? = null
  @Volatile private var connected = CountDownLatch(1)
  private var bound = false

  private val connection = object : ServiceConnection {
    override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
      printer = PrinterInterface.Stub.asInterface(service)
      connected.countDown()
    }

    override fun onServiceDisconnected(name: ComponentName?) {
      printer = null
      connected = CountDownLatch(1)
    }

    override fun onBindingDied(name: ComponentName?) {
      printer = null
      connected = CountDownLatch(1)
      synchronized(this@PetraPrinterModule) {
        runCatching { reactContext.unbindService(this) }
        bound = false
      }
    }
  }

  /** Bind on first use and wait briefly for the service; null if there is no printer. */
  private fun ensurePrinter(timeoutMs: Long = 3000): PrinterInterface? {
    printer?.let { return it }
    synchronized(this) {
      if (!bound) {
        val intent = Intent().setClassName(SERVICE_PACKAGE, SERVICE_CLASS)
        bound = runCatching { reactContext.bindService(intent, connection, Context.BIND_AUTO_CREATE) }.getOrDefault(false)
        if (!bound) return null
      }
    }
    connected.await(timeoutMs, TimeUnit.MILLISECONDS)
    return printer
  }

  @ReactMethod
  fun isAvailable(promise: Promise) {
    worker.execute { promise.resolve(ensurePrinter() != null) }
  }

  @ReactMethod
  fun print(ops: ReadableArray, promise: Promise) {
    worker.execute {
      val p = ensurePrinter()
      if (p == null) {
        promise.reject("PRINTER_UNAVAILABLE", "No receipt printer found on this device.")
        return@execute
      }
      try {
        p.beginWork()
        try {
          for (i in 0 until ops.size()) {
            ops.getMap(i)?.let { apply(p, it) }
          }
        } finally {
          p.endWork()
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("PRINTER_ERROR", "The printer reported an error: ${e.message ?: "unknown"}", e)
      }
    }
  }

  private fun apply(p: PrinterInterface, op: ReadableMap) {
    when (op.getString("type")) {
      "text" -> {
        p.setAlignment(alignment(op.str("align")))
        p.setTextSize(op.num("size", DEFAULT_SIZE).toFloat())
        p.setTextBold(op.bool("bold"))
        p.printText((op.getString("text") ?: "") + "\n")
        resetStyle(p)
      }
      "columns" -> {
        val texts = op.getArray("texts") ?: return
        val n = texts.size()
        val weights = op.getArray("weights")
        val aligns = op.getArray("aligns")
        p.setTextSize(op.num("size", DEFAULT_SIZE).toFloat())
        p.setTextBold(op.bool("bold"))
        p.printTableText(
          Array(n) { texts.getString(it) ?: "" },
          IntArray(n) { if (weights != null && it < weights.size()) weights.getInt(it) else 1 },
          IntArray(n) { alignment(aligns?.takeIf { a -> it < a.size() }?.getString(it)) },
        )
        resetStyle(p)
      }
      "qr" -> {
        p.setAlignment(1)
        p.printQRCode(op.getString("data") ?: "", op.num("moduleSize", 5).toInt(), op.num("errorLevel", 1).toInt())
        p.printText("\n")
        p.setAlignment(0)
      }
      "divider" -> {
        p.setAlignment(0)
        p.printText("-".repeat(op.num("width", 32).toInt()) + "\n")
      }
      "feed" -> p.nextLine(op.num("lines", 1).toInt())
    }
  }

  private fun resetStyle(p: PrinterInterface) {
    p.setTextBold(false)
    p.setTextSize(DEFAULT_SIZE.toFloat())
    p.setAlignment(0)
  }

  private fun alignment(a: String?) = when (a) {
    "center" -> 1
    "right" -> 2
    else -> 0
  }

  private fun ReadableMap.str(key: String) = if (hasKey(key) && !isNull(key)) getString(key) else null
  private fun ReadableMap.num(key: String, fallback: Number) = if (hasKey(key) && !isNull(key)) getDouble(key) else fallback.toDouble()
  private fun ReadableMap.bool(key: String) = hasKey(key) && !isNull(key) && getBoolean(key)

  override fun invalidate() {
    synchronized(this) {
      if (bound) runCatching { reactContext.unbindService(connection) }
      bound = false
    }
    worker.shutdown()
    super.invalidate()
  }

  companion object {
    const val NAME = "PetraPrinter"
    const val SERVICE_PACKAGE = "recieptservice.com.recieptservice"
    const val SERVICE_CLASS = "recieptservice.com.recieptservice.service.PrinterService"
    const val DEFAULT_SIZE = 24
  }
}
