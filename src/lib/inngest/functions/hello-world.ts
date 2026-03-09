import { inngest } from "../client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

export const helloWorld = inngest.createFunction(
  { id: "hello-world", retries: INNGEST_RETRY_PROFILES.LOW_RISK },
  { event: INNGEST_EVENTS.TEST_HELLO_WORLD_REQUESTED },
  async ({ event, step }) => {
    await step.sleep("wait-a-moment", "1s");
    return { message: `Hello ${event.data.email}!` };
  }
);
