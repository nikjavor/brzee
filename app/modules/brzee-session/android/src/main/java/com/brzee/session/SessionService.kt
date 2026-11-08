package com.brzee.session

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

class SessionService : Service() {
  companion object { var onStopRequested: (() -> Unit)? = null }
  override fun onBind(intent: Intent?): IBinder? = null
  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val connected = intent?.getBooleanExtra("connected", false) ?: false
    val audible = intent?.getBooleanExtra("audible", false) ?: false
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("brzee_session", "BRZEE drive", NotificationManager.IMPORTANCE_LOW))
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let { PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE) }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, "brzee_session") else Notification.Builder(this)
    val notification = builder.setSmallIcon(android.R.drawable.ic_media_play).setContentTitle("BRZEE")
      .setContentText(if (!connected) "Demo · sound enabled" else if (audible) "BRZEE session · sound enabled" else "BRZEE session · sound muted")
      .setOngoing(true).setContentIntent(pending).build()
    if (Build.VERSION.SDK_INT >= 29) {
      var types = 0
      if (connected) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE
      if (audible) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK
      startForeground(911, notification, types)
    } else startForeground(911, notification)
    return START_NOT_STICKY
  }
  override fun onTaskRemoved(rootIntent: Intent?) {
    onStopRequested?.invoke()
    stopForeground(STOP_FOREGROUND_REMOVE)
    stopSelf()
    super.onTaskRemoved(rootIntent)
  }
}
