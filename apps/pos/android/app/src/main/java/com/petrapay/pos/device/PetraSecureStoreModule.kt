package com.petrapay.pos.device

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Small encrypted key-value store for the signed-in session (the refresh token),
 * so the terminal stays signed in across restarts. Values are encrypted with an
 * AES-GCM key that lives in the Android Keystore and can't be exported; only the
 * ciphertext is written to the app's private preferences.
 */
class PetraSecureStoreModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName() = NAME

  private val prefs by lazy { reactApplicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE) }

  private fun key(): SecretKey {
    val ks = KeyStore.getInstance(KEYSTORE).apply { load(null) }
    (ks.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }
    val gen = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
    gen.init(
      KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
        .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
        .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
        .setKeySize(256)
        .build()
    )
    return gen.generateKey()
  }

  @ReactMethod
  fun set(name: String, value: String, promise: Promise) {
    try {
      val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, key()) }
      val sealed = cipher.iv + cipher.doFinal(value.toByteArray(Charsets.UTF_8))
      prefs.edit().putString(name, Base64.encodeToString(sealed, Base64.NO_WRAP)).apply()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("SECURE_STORE_ERROR", e.message, e)
    }
  }

  @ReactMethod
  fun get(name: String, promise: Promise) {
    val stored = prefs.getString(name, null) ?: return promise.resolve(null)
    try {
      val sealed = Base64.decode(stored, Base64.NO_WRAP)
      val cipher = Cipher.getInstance(TRANSFORMATION)
      cipher.init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, sealed, 0, IV_BYTES))
      promise.resolve(String(cipher.doFinal(sealed, IV_BYTES, sealed.size - IV_BYTES), Charsets.UTF_8))
    } catch (e: Exception) {
      // Unreadable (e.g. the key was reset): drop it and act as signed out.
      prefs.edit().remove(name).apply()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun remove(name: String, promise: Promise) {
    prefs.edit().remove(name).apply()
    promise.resolve(null)
  }

  companion object {
    const val NAME = "PetraSecureStore"
    private const val KEYSTORE = "AndroidKeyStore"
    private const val KEY_ALIAS = "petrapay_pos_session"
    private const val PREFS = "petrapay_secure_store"
    private const val TRANSFORMATION = "AES/GCM/NoPadding"
    private const val IV_BYTES = 12
  }
}
