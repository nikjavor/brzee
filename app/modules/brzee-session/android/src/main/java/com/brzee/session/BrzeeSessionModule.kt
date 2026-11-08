package com.brzee.session

import android.content.Intent
import android.os.Build
import android.content.Context
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BrzeeSessionModule : Module() {
  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  private var focusRequest: AudioFocusRequest? = null
  private val interruption = FocusInterruption { type, resume ->
    sendEvent("focusInterruption", mapOf("type" to type, "shouldResume" to resume))
  }
  private val focusListener = AudioManager.OnAudioFocusChangeListener { change ->
    when (change) {
      AudioManager.AUDIOFOCUS_LOSS -> { interruption.permanentLoss(); sendEvent("focusLost") }
      AudioManager.AUDIOFOCUS_LOSS_TRANSIENT, AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK -> {
        interruption.began()
      }
      AudioManager.AUDIOFOCUS_GAIN -> {
        interruption.gained()
      }
    }
  }
  private fun releaseFocus() {
    interruption.abandon()
    if (Build.VERSION.SDK_INT >= 26) focusRequest?.let { audioManager?.abandonAudioFocusRequest(it) }
    else audioManager?.abandonAudioFocus(focusListener)
    focusRequest = null
  }
  private val devices = object : AudioDeviceCallback() {
    override fun onAudioDevicesRemoved(removed: Array<out AudioDeviceInfo>) {
      val privateTypes = setOf(AudioDeviceInfo.TYPE_WIRED_HEADSET, AudioDeviceInfo.TYPE_WIRED_HEADPHONES,
        AudioDeviceInfo.TYPE_USB_DEVICE, AudioDeviceInfo.TYPE_USB_HEADSET, AudioDeviceInfo.TYPE_LINE_ANALOG,
        AudioDeviceInfo.TYPE_BLUETOOTH_A2DP, AudioDeviceInfo.TYPE_BLE_HEADSET, AudioDeviceInfo.TYPE_HEARING_AID)
      if (removed.any { it.isSink && it.type in privateTypes }) sendEvent("routeRemoved")
    }
  }
  override fun definition() = ModuleDefinition {
    Name("BrzeeSession")
    Events("sessionStopped", "routeRemoved", "focusLost", "focusInterruption")
    OnCreate {
      SessionService.onStopRequested = { sendEvent("sessionStopped") }
      (appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager)
        ?.registerAudioDeviceCallback(devices, Handler(Looper.getMainLooper()))
    }
    OnDestroy {
      releaseFocus()
      SessionService.onStopRequested = null
      (appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager)?.unregisterAudioDeviceCallback(devices)
    }
    AsyncFunction("requestAudioFocus") {
      releaseFocus()
      val result = if (Build.VERSION.SDK_INT >= 26) {
        val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
          .setAudioAttributes(AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_MEDIA).setContentType(AudioAttributes.CONTENT_TYPE_MUSIC).build())
          .setWillPauseWhenDucked(true)
          .setOnAudioFocusChangeListener(focusListener, Handler(Looper.getMainLooper())).build()
        focusRequest = request; audioManager?.requestAudioFocus(request)
      } else audioManager?.requestAudioFocus(focusListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN)
      result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED
    }
    AsyncFunction("releaseAudioFocus") { releaseFocus() }
    AsyncFunction("update") { connected: Boolean, audible: Boolean ->
      val context = appContext.reactContext ?: return@AsyncFunction
      if (!connected && !audible) {
        context.stopService(Intent(context, SessionService::class.java))
      } else {
        val intent = Intent(context, SessionService::class.java)
          .putExtra("connected", connected).putExtra("audible", audible)
        if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
      }
    }
  }
}
