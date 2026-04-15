import { DittofeedMessagingWorkspace } from "@/components/dittofeed/DittofeedMessagingWorkspace";

export default function BroadcastsPage() {
  return (
    <DittofeedMessagingWorkspace
      initialTab="broadcasts"
      eyebrow="Messaging Hub"
      title="Broadcasts"
      description="Launch and manage SMS-first broadcasts, journeys, templates, and deliveries from the shared messaging workspace. Email and voice broadcasts remain out of beta scope."
    />
  );
}
