# Fellowship 360 SMS Gateway Android

First-party Android companion app for the Fellowship 360 SMS gateway.

What this app does:
- enrolls a device against Fellowship 360 `/api/sms-gateway/enroll`
- polls `/api/sms-gateway/status` for queued outbound SMS
- sends queued SMS using the Android device SIM
- posts send/failure acknowledgements to `/api/sms-gateway/webhook`
- forwards inbound SMS to `/api/sms-gateway/inbound`

What this app does not do yet:
- FCM push wakeup path
- delivery receipts beyond local `sent` acknowledgement
- boot-time worker re-registration
- hardened background execution for OEM-specific battery policies

## Quick start

1. Open this folder in Android Studio.
2. Let Gradle sync.
3. Install on an Android phone with a real SIM card.
4. In Fellowship 360 super-admin, create or select an SMS device and issue an enrollment token.
5. Paste:
   - server base URL
   - enrollment token
   - device name
6. Grant `SEND_SMS` and `RECEIVE_SMS`.
7. Tap `Enroll`.
8. Tap `Sync Now` to prove outbound polling + send.
9. Text the SIM number from another phone to verify inbound forwarding.

## MVP launch note

This app uses polling through `/api/sms-gateway/status` so it can operate immediately with the backend already in this repo. FCM push can be layered in after launch for faster outbound wakeups.
