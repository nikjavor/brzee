package com.brzee.session

import org.junit.Assert.assertEquals
import org.junit.Test

class FocusInterruptionTest {
  @Test fun abandoningTransientFocusEndsTheInterruptionWithoutResumingOldIntent() {
    val events = mutableListOf<Pair<String, Boolean>>()
    val interruption = FocusInterruption { type, resume -> events.add(type to resume) }
    interruption.began()
    interruption.abandon()
    assertEquals(listOf("began" to false, "ended" to false), events)
    // An abandoned request need not receive gain; a late callback cannot revive it.
    interruption.gained()
    assertEquals(2, events.size)
  }
  @Test fun retainedFocusCanResumeAndOrdinaryAbandonEmitsNothing() {
    val events = mutableListOf<Pair<String, Boolean>>()
    val interruption = FocusInterruption { type, resume -> events.add(type to resume) }
    interruption.abandon()
    assertEquals(0, events.size)
    interruption.began()
    interruption.gained()
    assertEquals(listOf("began" to false, "ended" to true), events)
    interruption.abandon()
    assertEquals(2, events.size)
  }
}
