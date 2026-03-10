#!/bin/bash

# Simple script to mock an inbound webhook lead to our local Next.js server

echo "Sending mock webhook to http://localhost:3005/api/webhooks/inbound-lead..."

curl -X POST http://localhost:3005/api/webhooks/inbound-lead \
  -H "Content-Type: application/json" \
  -d '{
    "contactName": "Sarah Jenkins",
    "contactEmail": "sarah.jenkins.tests@example.com",
    "message": "My mother is in the hospital and I would really appreciate it if the church could pray for her recovery. Also, what time is the Sunday service?"
  }'

echo ""
echo "Done!"
