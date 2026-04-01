import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { churchContacts } from "@/db/schema";
import { eq } from "drizzle-orm";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";
import {
  syncContactToDittofeedBestEffort,
  syncContactUpdatedToDittofeed,
} from "@/lib/dittofeed/contacts";

export const processContactCreated = inngest.createFunction(
  {
    id: "process-contact-created",
    retries: INNGEST_RETRY_PROFILES.STANDARD,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.CONTACT_CREATED },
  async ({ event, step }) => {
    const { contactId, organizationId } = event.data;

    // 1. Fetch Contact
    const contact = await step.run("fetch-contact", async () => {
      const [record] = await db
        .select()
        .from(churchContacts)
        .where(eq(churchContacts.id, contactId))
        .limit(1);

      if (!record) {
        throw new NonRetriableError(`Contact not found: ${contactId}`);
      }
      return record;
    });

    // 2. Normalize Data
    const normalizedData = await step.run("normalize-data", async () => {
      let updated = false;
      const updates: any = {};

      // Capitalize first name and last name
      if (contact.firstName) {
        const normalizedFirstName = contact.firstName.charAt(0).toUpperCase() + contact.firstName.slice(1).toLowerCase();
        if (contact.firstName !== normalizedFirstName) {
          updates.firstName = normalizedFirstName;
          updated = true;
        }
      }

      if (contact.lastName) {
        const normalizedLastName = contact.lastName.charAt(0).toUpperCase() + contact.lastName.slice(1).toLowerCase();
        if (contact.lastName !== normalizedLastName) {
          updates.lastName = normalizedLastName;
          updated = true;
        }
      }
      
      // Clean up phone number (remove non-digits, etc) if exists
      if (contact.phone) {
         const cleaned = contact.phone.replace(/\D/g, '');
         if (cleaned !== contact.phone) {
             updates.phone = cleaned;
             updated = true;
         }
      }

      if (updated) {
        updates.updatedAt = new Date();
        await db
          .update(churchContacts)
          .set(updates)
          .where(eq(churchContacts.id, contactId));

        await syncContactToDittofeedBestEffort("process-contact.normalize", () =>
          syncContactUpdatedToDittofeed({
            organizationId,
            contact: {
              ...contact,
              ...updates,
            },
            previousContact: contact,
            extraProperties: {
              normalizationApplied: true,
            },
          })
        );
      }
      
      return { updated, updates };
    });

    // 3. AI Enrichment (Optional/Future: Using Gemini to parse notes or assign tags)
    await step.run("enrich-profile", async () => {
        // Here we could pass the contact data to Gemini to assign a `memberStatus` 
        // or extract specific prayer requests if it was created from a long text message.
        console.log(`[Contact Processor] Contact ${contactId} enriched. Normalization applied: ${normalizedData.updated}`);
    });

    // 4. Trigger Welcome Sequence (Placeholder for future hook)
    await step.run("welcome-sequence", async () => {
       // e.g. send an email or SMS via broadcast table if source is 'website'
       if (contact.source === 'website') {
           console.log(`[Contact Processor] Would trigger welcome sequence for website lead: ${contactId}`);
       }
    });

    return { 
      message: `Successfully processed new contact ${contactId}`,
      normalized: normalizedData.updated
    };
  }
);
