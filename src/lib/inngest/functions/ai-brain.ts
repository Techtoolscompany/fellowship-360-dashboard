import { inngest } from "../client";
import { NonRetriableError } from "inngest";
import { db } from "@/db";
import { 
  aiConfig, 
  aiUsageLogs,
  churchContacts,
  conversations,
  messages,
  pipelineStages,
  pipelineItems
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getGeminiClient } from "@/lib/ai/gemini-client";
import { INNGEST_EVENTS } from "../events";
import { INNGEST_RETRY_PROFILES } from "../policy";

/**
 * AI Brain Routing Function
 * This function serves as the central intelligent router for all incoming events.
 * Since it runs in the background via Inngest, it bypasses HTTP request timeouts.
 */
export const aiBrain = inngest.createFunction(
  {
    id: "ai-brain-router",
    retries: INNGEST_RETRY_PROFILES.CORE_AUTOMATION,
    idempotency: "event.data.idempotencyKey",
  },
  { event: INNGEST_EVENTS.GRACE_LEAD_RECEIVED },
  async ({ event, step }) => {
    const { organizationId, contactName, contactEmail, message } = event.data;

    // 1. Fetch Tenant Context
    const config = await step.run("fetch-tenant-config", async () => {
      const [orgConfig] = await db
        .select()
        .from(aiConfig)
        .where(eq(aiConfig.organizationId, organizationId))
        .limit(1);

      if (!orgConfig || !orgConfig.graceEnabled) {
        throw new NonRetriableError(`AI disabled or config not found for organization: ${organizationId}`);
      }
      return orgConfig;
    });

    // 2. Parse Intent with LLM
    const intentAnalysis = await step.run("analyze-intent", async () => {
      const gemini = getGeminiClient();
      
      const systemPrompt = `You are the triage AI for ${config.churchName || 'a church'}.
Your job is to analyze incoming website messages and categorize them.
You must return ONLY a raw JSON object with the exact following schema:
{
  "suggestedPipelineStage": string (e.g. "New Lead", "Prayer Request", "Event Question", "Care"),
  "category": string (e.g. "Prayer", "General", "Event", "Giving")
}`;

      const userMessage = `Message from: ${contactName} (${contactEmail})\n\nMessage body: ${message}`;
      
      const textResponse = await gemini.chat(userMessage, [], undefined, systemPrompt);
      
      try {
        const cleanJson = textResponse.replace(/^```json\s*/, '').replace(/```\s*$/, '').trim();
        return JSON.parse(cleanJson);
      } catch (e) {
        console.error("Failed to parse Gemini intent analysis JSON:", textResponse);
        return {
          suggestedPipelineStage: "New Lead",
          category: "Uncategorized",
        };
      }
    });

    // 3. Update CRM (Insert Contact, Conversation, Messages, and Pipeline Item)
    const crmContext = await step.run("update-crm", async () => {
      // 3.1 Find or Create Contact
      let [contact] = await db.select()
        .from(churchContacts)
        .where(
          and(
            eq(churchContacts.organizationId, organizationId),
            eq(churchContacts.email, contactEmail)
          )
        ).limit(1);

      if (!contact) {
        const result = await db.insert(churchContacts).values({
          organizationId,
          firstName: contactName.split(' ')[0] || 'Unknown',
          lastName: contactName.split(' ').slice(1).join(' ') || '',
          email: contactEmail,
          source: 'website',
          memberStatus: 'visitor'
        }).returning();
        contact = result[0];
      }

      // 3.2 Create Conversation
      const [conversation] = await db.insert(conversations).values({
        organizationId,
        contactId: contact.id,
        channel: 'web',
        subject: `New ${intentAnalysis.category || 'Inquiry'} Request`,
        status: 'open',
      }).returning();

      // 3.3 Log Inbound Message
      await db.insert(messages).values({
        conversationId: conversation.id,
        content: message,
        direction: 'inbound',
        senderType: 'human',
        senderId: contact.id
      });

      // 3.4 Categorize in Pipeline
      const [stage] = await db.select()
        .from(pipelineStages)
        .where(
          and(
            eq(pipelineStages.organizationId, organizationId),
            eq(pipelineStages.name, intentAnalysis.suggestedPipelineStage || 'New Visitor')
          )
        ).limit(1);

      let actualStageId = stage?.id;
      if (!actualStageId) {
        // Fallback to the first stage in the org if the AI guessed a name that doesn't exist
        const [fallbackStage] = await db.select()
          .from(pipelineStages)
          .where(eq(pipelineStages.organizationId, organizationId))
          .limit(1);
        actualStageId = fallbackStage?.id;
      }

      if (actualStageId && contact) {
        await db.insert(pipelineItems).values({
          organizationId,
          contactId: contact.id,
          stageId: actualStageId,
          notes: `Auto-categorized by AI as: ${intentAnalysis.category}`
        });
      }

      return { conversationId: conversation.id, contactId: contact.id };
    });

    // 4. Generate Draft Reply
    const draftReply = await step.run("generate-draft", async () => {
      const gemini = getGeminiClient();
      
      const systemPrompt = `You are a pastoral assistant for ${config.churchName || 'a church'}.
Your job is to draft a warm, pastoral, and concise reply to an incoming message based on its category: ${intentAnalysis.category}.
Return ONLY the text of the message draft without quotes or formatting.`;

      const userMessage = `Message from: ${contactName} (${contactEmail})\n\nMessage body: ${message}`;
      
      const textResponse = await gemini.chat(userMessage, [], undefined, systemPrompt);
      return textResponse;
    });

    // 5. Save Draft Reply
    await step.run("save-draft", async () => {
      await db.insert(messages).values({
        conversationId: crmContext.conversationId,
        content: draftReply,
        direction: 'draft', // Save as draft for review
        senderType: 'ai',
      });
      
      console.log(`[AI Brain] Processed lead for ${config.churchName || 'Organization'}. Draft saved for review.`);
    });

    return { 
      message: `Successfully processed website lead for ${contactEmail}`,
      analysis: intentAnalysis 
    };
  }
);
