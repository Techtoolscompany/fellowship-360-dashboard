package com.fellowship360.smsgateway.gateway

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Telephony
import kotlin.concurrent.thread

class InboundSmsReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val config = GatewayStore.load(context) ?: return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isEmpty()) return

        val fromNumber = messages.firstOrNull()?.displayOriginatingAddress?.trim().orEmpty()
        val messageBody = messages.joinToString(separator = "") { sms -> sms.messageBody.orEmpty() }.trim()

        if (fromNumber.isBlank() || messageBody.isBlank()) {
            return
        }

        thread {
            try {
                GatewayApi.forwardInboundSms(
                    config = config,
                    fromNumber = fromNumber,
                    messageBody = messageBody,
                )
                GatewaySyncRunner.runOnce(context)
            } catch (_: Exception) {
                // Keep receiver resilient; retry/backoff can be layered later.
            }
        }
    }
}
