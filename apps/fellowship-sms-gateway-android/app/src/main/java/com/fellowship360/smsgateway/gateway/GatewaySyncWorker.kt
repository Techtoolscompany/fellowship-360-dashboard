package com.fellowship360.smsgateway.gateway

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters

class GatewaySyncWorker(
    appContext: Context,
    workerParams: WorkerParameters,
) : Worker(appContext, workerParams) {
    override fun doWork(): Result {
        val summary = GatewaySyncRunner.runOnce(applicationContext)
        return if (summary.startsWith("Sync failed:")) {
            Result.retry()
        } else {
            Result.success()
        }
    }
}
