package com.fellowship360.smsgateway

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.fellowship360.smsgateway.databinding.ActivityMainBinding
import com.fellowship360.smsgateway.gateway.GatewayApi
import com.fellowship360.smsgateway.gateway.GatewayStore
import com.fellowship360.smsgateway.gateway.GatewaySyncRunner
import com.fellowship360.smsgateway.gateway.GatewayWorkScheduler
import kotlin.concurrent.thread

class MainActivity : AppCompatActivity() {
    private lateinit var binding: ActivityMainBinding

    private val smsPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) {
        renderStatus()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val existing = GatewayStore.load(this)
        binding.baseUrlInput.setText(existing?.baseUrl ?: "")
        binding.deviceNameInput.setText(existing?.deviceName ?: "Fellowship 360 Gateway")

        binding.enrollButton.setOnClickListener { enrollDevice() }
        binding.syncButton.setOnClickListener { syncNow() }

        ensureSmsPermissions()
        renderStatus()
    }

    private fun ensureSmsPermissions() {
        val missing = listOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
        ).filter { permission ->
            ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED
        }

        if (missing.isNotEmpty()) {
            smsPermissionLauncher.launch(missing.toTypedArray())
        }
    }

    private fun enrollDevice() {
        val baseUrl = binding.baseUrlInput.text.toString().trim()
        val enrollmentToken = binding.enrollmentTokenInput.text.toString().trim()
        val deviceName = binding.deviceNameInput.text.toString().trim().ifBlank {
            "Fellowship 360 Gateway"
        }

        if (baseUrl.isBlank() || enrollmentToken.isBlank()) {
            Toast.makeText(this, "Base URL and enrollment token are required.", Toast.LENGTH_SHORT)
                .show()
            return
        }

        binding.statusText.text = "Enrolling device..."
        thread {
            try {
                val enrollment = GatewayApi.enroll(
                    baseUrl = baseUrl,
                    enrollmentToken = enrollmentToken,
                    deviceName = deviceName,
                )

                GatewayStore.saveEnrollment(
                    context = this,
                    baseUrl = baseUrl,
                    authToken = enrollment.authToken,
                    deviceId = enrollment.deviceId,
                    organizationId = enrollment.organizationId,
                    organizationName = enrollment.organizationName,
                    deviceName = enrollment.deviceName,
                    phoneNumber = enrollment.phoneNumber,
                )
                GatewayWorkScheduler.schedule(this)
                val initialSyncSummary = GatewaySyncRunner.runOnce(this)

                runOnUiThread {
                    binding.enrollmentTokenInput.setText("")
                    val pendingSummary = if (enrollment.pendingMessages.isEmpty()) {
                        "Server verified enrollment. No queued messages were waiting."
                    } else {
                        "Server verified enrollment. ${enrollment.pendingMessages.size} queued message(s) were waiting."
                    }
                    renderStatus("$pendingSummary\n$initialSyncSummary")
                }
            } catch (error: Exception) {
                runOnUiThread {
                    renderStatus("Enrollment failed: ${error.message ?: "Unknown error"}")
                }
            }
        }
    }

    private fun syncNow() {
        binding.statusText.text = "Syncing queued SMS..."
        thread {
            val summary = GatewaySyncRunner.runOnce(this)
            runOnUiThread {
                renderStatus(summary)
            }
        }
    }

    private fun renderStatus(extra: String? = null) {
        val config = GatewayStore.load(this)
        val permissionSummary = if (hasSmsPermissions()) {
            "SMS permissions granted"
        } else {
            "SMS permissions missing"
        }

        val base = if (config == null) {
            "Not enrolled yet. $permissionSummary."
        } else {
            buildString {
                append("Enrolled as ${config.deviceName}. ")
                append("Church: ${config.organizationName ?: config.organizationId ?: "unassigned"}. ")
                append("Phone: ${config.phoneNumber ?: "unknown"}. ")
                append(permissionSummary)
                config.lastSyncAt?.let {
                    append(" Last sync: $it.")
                }
            }
        }

        binding.statusText.text = listOfNotNull(base, extra).joinToString("\n")
    }

    private fun hasSmsPermissions(): Boolean {
        return listOf(
            Manifest.permission.SEND_SMS,
            Manifest.permission.RECEIVE_SMS,
            Manifest.permission.READ_SMS,
        ).all { permission ->
            ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED
        }
    }
}
