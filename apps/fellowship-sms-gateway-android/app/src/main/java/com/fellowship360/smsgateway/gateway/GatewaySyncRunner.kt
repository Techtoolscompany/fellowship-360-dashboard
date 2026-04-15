package com.fellowship360.smsgateway.gateway

import android.content.Context
import android.telephony.SmsManager
import java.time.Instant

object GatewaySyncRunner {
    fun runOnce(context: Context): String {
        val config = GatewayStore.load(context)
            ?: return "Device is not enrolled yet."

        return try {
            val status = GatewayApi.syncStatus(config)
            val smsManager = SmsManager.getDefault()

            var sentCount = 0
            var failedCount = 0

            for (message in status.pendingMessages) {
                try {
                    smsManager.sendTextMessage(message.to, null, message.body, null, null)
                    GatewayApi.reportSendStatus(config, message.id, "sent")
                    sentCount += 1
                } catch (error: Exception) {
                    GatewayApi.reportSendStatus(
                        config,
                        message.id,
                        "failed",
                        error.message ?: "SMS send failed"
                    )
                    failedCount += 1
                }
            }

            GatewayStore.saveLastSync(context, Instant.now().toString())
            if (status.pendingMessages.isEmpty()) {
                "Sync complete. No queued messages were waiting."
            } else {
                "Sync complete. Pulled ${status.pendingMessages.size} queued message(s), sent $sentCount, failed $failedCount."
            }
        } catch (error: Exception) {
            "Sync failed: ${error.message ?: "Unknown error"}"
        }
    }
}
