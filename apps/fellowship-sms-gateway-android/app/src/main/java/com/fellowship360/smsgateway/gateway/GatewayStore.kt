package com.fellowship360.smsgateway.gateway

import android.content.Context

data class GatewayConfig(
    val baseUrl: String,
    val authToken: String,
    val deviceId: String,
    val organizationId: String?,
    val organizationName: String?,
    val deviceName: String,
    val phoneNumber: String?,
    val lastSyncAt: String?,
)

object GatewayStore {
    private const val PREFS = "fellowship_sms_gateway"
    private const val KEY_BASE_URL = "base_url"
    private const val KEY_AUTH_TOKEN = "auth_token"
    private const val KEY_DEVICE_ID = "device_id"
    private const val KEY_ORGANIZATION_ID = "organization_id"
    private const val KEY_ORGANIZATION_NAME = "organization_name"
    private const val KEY_DEVICE_NAME = "device_name"
    private const val KEY_PHONE_NUMBER = "phone_number"
    private const val KEY_LAST_SYNC_AT = "last_sync_at"

    fun load(context: Context): GatewayConfig? {
        val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val baseUrl = prefs.getString(KEY_BASE_URL, null) ?: return null
        val authToken = prefs.getString(KEY_AUTH_TOKEN, null) ?: return null
        val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: return null
        val deviceName = prefs.getString(KEY_DEVICE_NAME, null) ?: "Fellowship 360 Gateway"

        return GatewayConfig(
            baseUrl = baseUrl,
            authToken = authToken,
            deviceId = deviceId,
            organizationId = prefs.getString(KEY_ORGANIZATION_ID, null),
            organizationName = prefs.getString(KEY_ORGANIZATION_NAME, null),
            deviceName = deviceName,
            phoneNumber = prefs.getString(KEY_PHONE_NUMBER, null),
            lastSyncAt = prefs.getString(KEY_LAST_SYNC_AT, null),
        )
    }

    fun saveEnrollment(
        context: Context,
        baseUrl: String,
        authToken: String,
        deviceId: String,
        organizationId: String?,
        organizationName: String?,
        deviceName: String,
        phoneNumber: String?,
    ) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_BASE_URL, baseUrl)
            .putString(KEY_AUTH_TOKEN, authToken)
            .putString(KEY_DEVICE_ID, deviceId)
            .putString(KEY_ORGANIZATION_ID, organizationId)
            .putString(KEY_ORGANIZATION_NAME, organizationName)
            .putString(KEY_DEVICE_NAME, deviceName)
            .putString(KEY_PHONE_NUMBER, phoneNumber)
            .apply()
    }

    fun saveLastSync(context: Context, lastSyncAt: String) {
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit()
            .putString(KEY_LAST_SYNC_AT, lastSyncAt)
            .apply()
    }
}
