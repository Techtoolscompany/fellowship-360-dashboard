package com.fellowship360.smsgateway.gateway

import android.content.Context
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

object GatewayWorkScheduler {
    private const val UNIQUE_WORK_NAME = "fellowship_sms_gateway_sync"

    fun schedule(context: Context) {
        val workRequest = PeriodicWorkRequestBuilder<GatewaySyncWorker>(15, TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(context).enqueueUniquePeriodicWork(
            UNIQUE_WORK_NAME,
            ExistingPeriodicWorkPolicy.UPDATE,
            workRequest,
        )
    }
}
