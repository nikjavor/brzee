package com.brzee.session

/** Focus callback state, separated from AudioManager so cancellation is testable on the JVM. */
internal class FocusInterruption(private val emit: (String, Boolean) -> Unit) {
  private var active = false
  fun began() { active = true; emit("began", false) }
  fun gained() {
    if (active) emit("ended", true)
    active = false
  }
  fun permanentLoss() { active = false }
  fun abandon() {
    if (!active) return
    active = false
    emit("ended", false)
  }
}
