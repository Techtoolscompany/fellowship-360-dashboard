import { DittofeedMessagingWorkspace } from "@/components/dittofeed/DittofeedMessagingWorkspace";

export default function BroadcastsPage() {
  return (
    <DittofeedMessagingWorkspace
      initialTab="broadcasts"
      eyebrow="Messaging Hub"
      title="Broadcasts"
      description="Launch and manage journeys, templates, broadcasts, and deliveries from the shared Dittofeed workspace."
    />
  );
}

