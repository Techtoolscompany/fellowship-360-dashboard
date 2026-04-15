package com.fellowship360.smsgateway.gateway

import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedReader
import java.io.InputStreamReader
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL

data class EnrollmentResponse(
    val authToken: String,
    val deviceId: String,
    val organizationId: String?,
    val organizationName: String?,
    val deviceName: String,
    val phoneNumber: String?,
    val pendingMessages: List<PendingMessage>,
)

data class PendingMessage(
    val id: String,
    val to: String,
    val body: String,
)

data class StatusResponse(
    val pendingMessages: List<PendingMessage>,
)

object GatewayApi {
    fun enroll(
        baseUrl: String,
        enrollmentToken: String,
        deviceName: String,
    ): EnrollmentResponse {
        val payload = JSONObject()
            .put("enrollmentToken", enrollmentToken)
            .put("deviceName", deviceName)

        val json = postJson(baseUrl, "/api/sms-gateway/enroll", payload)
        val device = json.getJSONObject("device")

        return EnrollmentResponse(
            authToken = json.getString("authToken"),
            deviceId = device.getString("id"),
            organizationId = device.optString("organizationId").ifBlank { null },
            organizationName = device.optString("organizationName").ifBlank { null },
            deviceName = device.optString("deviceName").ifBlank { deviceName },
            phoneNumber = device.optString("phoneNumber").ifBlank { null },
            pendingMessages = json.optJSONArray("pendingMessages").toPendingMessages(),
        )
    }

    fun syncStatus(config: GatewayConfig): StatusResponse {
        val payload = JSONObject()
            .put("deviceId", config.deviceId)
            .put("phoneNumber", config.phoneNumber)
            .put(
                "statusJson",
                JSONObject()
                    .put("gatewayEnabled", true)
                    .put("receiveSmsEnabled", true)
                    .put("transportMode", "polling_mvp")
            )
            .put("pendingLimit", 50)

        val json = postJson(
            config.baseUrl,
            "/api/sms-gateway/status",
            payload,
            config.authToken
        )

        return StatusResponse(
            pendingMessages = json.optJSONArray("pendingMessages").toPendingMessages()
        )
    }

    fun reportSendStatus(
        config: GatewayConfig,
        messageId: String,
        status: String,
        error: String? = null,
    ) {
        val payload = JSONObject()
            .put("deviceId", config.deviceId)
            .put("messageId", messageId)
            .put("status", status)

        if (!error.isNullOrBlank()) {
            payload.put("error", error)
        }

        postJson(config.baseUrl, "/api/sms-gateway/webhook", payload, config.authToken)
    }

    fun forwardInboundSms(
        config: GatewayConfig,
        fromNumber: String,
        messageBody: String,
    ) {
        val payload = JSONObject()
            .put("deviceId", config.deviceId)
            .put("fromNumber", fromNumber)
            .put("toNumber", config.phoneNumber)
            .put("body", messageBody)

        postJson(config.baseUrl, "/api/sms-gateway/inbound", payload, config.authToken)
    }

    private fun JSONArray?.toPendingMessages(): List<PendingMessage> {
        if (this == null) return emptyList()

        val messages = mutableListOf<PendingMessage>()
        for (index in 0 until length()) {
            val item = optJSONObject(index) ?: continue
            val id = item.optString("id")
            val to = item.optString("to")
            val body = item.optString("body")

            if (id.isBlank() || to.isBlank() || body.isBlank()) {
                continue
            }

            messages.add(PendingMessage(id = id, to = to, body = body))
        }
        return messages
    }

    private fun postJson(
        baseUrl: String,
        path: String,
        payload: JSONObject,
        authToken: String? = null,
    ): JSONObject {
        val normalizedBase = baseUrl.trim().removeSuffix("/")
        val connection = (URL("$normalizedBase$path").openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15000
            readTimeout = 15000
            doInput = true
            doOutput = true
            setRequestProperty("Content-Type", "application/json")
            if (!authToken.isNullOrBlank()) {
                setRequestProperty("Authorization", "Bearer $authToken")
            }
        }

        OutputStreamWriter(connection.outputStream).use { writer ->
            writer.write(payload.toString())
            writer.flush()
        }

        val responseCode = connection.responseCode
        val stream = if (responseCode in 200..299) {
            connection.inputStream
        } else {
            connection.errorStream
        }

        val responseText = BufferedReader(InputStreamReader(stream)).use { reader ->
            buildString {
                while (true) {
                    val line = reader.readLine() ?: break
                    append(line)
                }
            }
        }

        if (responseCode !in 200..299) {
            throw IllegalStateException(
                "Gateway request failed ($responseCode): ${responseText.ifBlank { "empty response" }}"
            )
        }

        return JSONObject(responseText.ifBlank { "{}" })
    }
}
