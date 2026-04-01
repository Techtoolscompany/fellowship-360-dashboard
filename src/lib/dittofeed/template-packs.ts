import { z } from "zod";

const recordSchema = z.record(z.string(), z.unknown());
const APP_URL_TOKEN = "__DITTOFEED_APP_URL__";
const WORKSPACE_ID_TOKEN = "__DITTOFEED_WORKSPACE_ID__";
const SMS_WEBHOOK_SECRET_TOKEN = "__DITTOFEED_SMS_WEBHOOK_SECRET__";
const EMAIL_FROM_TOKEN = "__DITTOFEED_EMAIL_FROM__";
const EMAIL_REPLY_TO_TOKEN = "__DITTOFEED_EMAIL_REPLY_TO__";

export const dittofeedEmailProviderSchema = z.object({
  config: recordSchema,
  setDefault: z.boolean().optional().default(true),
});

export const dittofeedUserPropertySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  definition: recordSchema,
  exampleValue: z.unknown().optional(),
  updatedAt: z.number().int().optional(),
  lastRecomputed: z.number().int().optional(),
  status: z.string().optional(),
});

export const dittofeedComponentConfigurationSchema = z.object({
  name: z.string().min(1),
  definition: recordSchema,
});

export const dittofeedTemplateSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  definition: recordSchema,
  draft: recordSchema.nullish(),
  resourceType: z.string().optional(),
});

export const dittofeedSegmentSchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  definition: recordSchema,
  updatedAt: z.number().int().optional(),
  draft: z
    .object({
      nodes: z.array(recordSchema),
      edges: z.array(recordSchema).optional(),
    })
    .nullish(),
});

export const dittofeedJourneySchema = z.object({
  id: z.string().min(1).optional(),
  name: z.string().min(1),
  canRunMultiple: z.boolean().optional(),
  updatedAt: z.number().int().optional(),
  definition: recordSchema,
  status: z.string().optional(),
  draft: recordSchema.nullish(),
});

export const dittofeedTemplatePackResourcesSchema = z.object({
  emailProvider: dittofeedEmailProviderSchema.optional(),
  userProperties: z.array(dittofeedUserPropertySchema).optional(),
  componentConfigurations: z.array(dittofeedComponentConfigurationSchema).optional(),
  templates: z.array(dittofeedTemplateSchema).optional(),
  segments: z.array(dittofeedSegmentSchema).optional(),
  journeys: z.array(dittofeedJourneySchema).optional(),
});

export type DittofeedTemplatePackResources = z.infer<
  typeof dittofeedTemplatePackResourcesSchema
>;

export type DittofeedTemplatePack = {
  key: string;
  name: string;
  description: string;
  resources: DittofeedTemplatePackResources;
};

export type DittofeedTemplatePackMaterializationContext = {
  appUrl?: string | null;
  workspaceId?: string | null;
  smsWebhookSecret?: string | null;
  emailFrom?: string | null;
  emailReplyTo?: string | null;
};

function createWebhookTemplateBody(messageText: string) {
  return JSON.stringify(
    {
      config: {
        url: `${APP_URL_TOKEN}/api/integrations/dittofeed/sms/send`,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        data: {
          recipient: "{{ user.phone }}",
          messageText,
          workspaceId: WORKSPACE_ID_TOKEN,
          dittofeed: {
            workspaceId: WORKSPACE_ID_TOKEN,
            messageId: "{{ tags.messageId }}",
            journeyId: "{{ tags.journeyId }}",
            nodeId: "{{ tags.nodeId }}",
            userId: "{{ tags.userId }}",
            runId: "{{ tags.runId }}",
            templateId: "{{ tags.templateId }}",
            channel: "Webhook",
          },
        },
        responseType: "json",
      },
      secret: {
        headers: {
          Authorization: `Bearer ${SMS_WEBHOOK_SECRET_TOKEN}`,
        },
      },
    },
    null,
    2
  );
}

function buildChurchMessagingBaselineResources(): DittofeedTemplatePackResources {
  return {
    userProperties: [
      {
        id: "organizationExternalId",
        name: "organizationExternalId",
        definition: {
          type: "Trait",
          path: "organizationExternalId",
        },
        exampleValue: "org_demo",
      },
      {
        id: "timezone",
        name: "timezone",
        definition: {
          type: "Trait",
          path: "timezone",
        },
        exampleValue: "America/New_York",
      },
      {
        id: "memberStatus",
        name: "memberStatus",
        definition: {
          type: "Trait",
          path: "memberStatus",
        },
        exampleValue: "visitor",
      },
    ],
    componentConfigurations: [
      {
        name: "Broadcast",
        definition: {
          type: "Broadcast",
          stepsAllowList: [
            "RECIPIENTS",
            "CONTENT",
            "CONFIGURATION",
            "DELIVERIES",
            "EVENTS",
          ],
          emailProviderOverrideAllowList: ["Resend"],
          hideOverrideSelect: true,
          hideRateLimit: true,
        },
      },
      {
        name: "MessageTemplate",
        definition: {
          type: "MessageTemplate",
          allowedEmailContentsTypes: ["Code", "LowCode"],
          lowCodeEmailDefaultType: "Informative",
        },
      },
      {
        name: "DeliveriesTable",
        definition: {
          type: "DeliveriesTable",
          allowedChannels: ["Email", "Webhook"],
          allowedFilters: [
            "journeyIds",
            "broadcastIds",
            "channels",
            "messageStates",
            "templateIds",
            "userIds",
          ],
          allowedGroupBy: ["journey", "broadcast", "messageTemplate", "provider"],
          columnAllowList: [
            "preview",
            "from",
            "to",
            "userId",
            "snippet",
            "channel",
            "status",
            "origin",
            "sentAt",
            "template",
            "updatedAt",
          ],
        },
      },
    ],
    templates: [
      {
        id: "church_email_visitor_welcome_v1",
        name: "Church Visitor Welcome Email",
        definition: {
          type: "Email",
          from: EMAIL_FROM_TOKEN,
          subject: "We are glad you visited",
          replyTo: EMAIL_REPLY_TO_TOKEN,
          identifierKey: "email",
          emailContentsType: "Code",
          body: [
            "<mjml>",
            "  <mj-body background-color=\"#f8fafc\">",
            "    <mj-section background-color=\"#ffffff\" padding=\"32px 24px\">",
            "      <mj-column>",
            "        <mj-text font-size=\"24px\" font-weight=\"700\" color=\"#0f172a\">Hi {{ user.firstName | default: \"there\" }},</mj-text>",
            "        <mj-text font-size=\"16px\" line-height=\"24px\" color=\"#334155\">Thank you for joining us. We wanted to reach out, say welcome, and make sure you know you already have a place here.</mj-text>",
            "        <mj-text font-size=\"16px\" line-height=\"24px\" color=\"#334155\">If you would like prayer, next-step help, or a direct connection to someone on the team, just reply to this message and we will follow up.</mj-text>",
            "        <mj-text font-size=\"14px\" color=\"#64748b\">Grace and peace,<br />Fellowship 360 Care Team</mj-text>",
            "      </mj-column>",
            "    </mj-section>",
            "  </mj-body>",
            "</mjml>",
          ].join("\n"),
        },
        draft: null,
        resourceType: "Declarative",
      },
      {
        id: "church_email_member_onboarding_v1",
        name: "Church Member Onboarding Email",
        definition: {
          type: "Email",
          from: EMAIL_FROM_TOKEN,
          subject: "Welcome to the next step",
          replyTo: EMAIL_REPLY_TO_TOKEN,
          identifierKey: "email",
          emailContentsType: "Code",
          body: [
            "<mjml>",
            "  <mj-body background-color=\"#f8fafc\">",
            "    <mj-section background-color=\"#ffffff\" padding=\"32px 24px\">",
            "      <mj-column>",
            "        <mj-text font-size=\"24px\" font-weight=\"700\" color=\"#0f172a\">Hi {{ user.firstName | default: \"there\" }},</mj-text>",
            "        <mj-text font-size=\"16px\" line-height=\"24px\" color=\"#334155\">We are excited to walk with you. This is your quick reminder that you can reply if you need help finding a ministry, understanding your next step, or getting connected to a leader.</mj-text>",
            "        <mj-text font-size=\"16px\" line-height=\"24px\" color=\"#334155\">We want follow-up to feel personal, not automated, so a real team member can jump in whenever you respond.</mj-text>",
            "        <mj-text font-size=\"14px\" color=\"#64748b\">With you,<br />Fellowship 360 Care Team</mj-text>",
            "      </mj-column>",
            "    </mj-section>",
            "  </mj-body>",
            "</mjml>",
          ].join("\n"),
        },
        draft: null,
        resourceType: "Declarative",
      },
      {
        id: "church_email_announcement_v1",
        name: "Church Broadcast Email",
        definition: {
          type: "Email",
          from: EMAIL_FROM_TOKEN,
          subject: "Church Update",
          replyTo: EMAIL_REPLY_TO_TOKEN,
          identifierKey: "email",
          emailContentsType: "Code",
          body: [
            "<mjml>",
            "  <mj-body background-color=\"#f8fafc\">",
            "    <mj-section background-color=\"#ffffff\" padding=\"32px 24px\">",
            "      <mj-column>",
            "        <mj-text font-size=\"24px\" font-weight=\"700\" color=\"#0f172a\">Hi {{ user.firstName | default: \"there\" }},</mj-text>",
            "        <mj-text font-size=\"16px\" line-height=\"24px\" color=\"#334155\">This is a church update from your ministry team. Replace this copy with the announcement, event reminder, or next-step message you want to send.</mj-text>",
            "        <mj-text font-size=\"14px\" color=\"#64748b\">Sent with Fellowship 360</mj-text>",
            "      </mj-column>",
            "    </mj-section>",
            "  </mj-body>",
            "</mjml>",
          ].join("\n"),
        },
        draft: null,
        resourceType: "Declarative",
      },
      {
        id: "church_webhook_sms_visitor_followup_v1",
        name: "Church Visitor Follow-Up SMS",
        definition: {
          type: "Webhook",
          identifierKey: "phone",
          body: createWebhookTemplateBody(
            "Hi {{ user.firstName | default: \"there\" }}, thanks again for visiting. If we can pray for you or help you get connected, just reply to this text."
          ),
        },
        draft: null,
        resourceType: "Declarative",
      },
      {
        id: "church_webhook_sms_member_followup_v1",
        name: "Church Member Follow-Up SMS",
        definition: {
          type: "Webhook",
          identifierKey: "phone",
          body: createWebhookTemplateBody(
            "Hi {{ user.firstName | default: \"there\" }}, this is a quick check-in from the church team. Reply here if you need help, prayer, or a next step."
          ),
        },
        draft: null,
        resourceType: "Declarative",
      },
      {
        id: "church_webhook_sms_broadcast_v1",
        name: "Church Broadcast SMS",
        definition: {
          type: "Webhook",
          identifierKey: "phone",
          body: createWebhookTemplateBody(
            "Hi {{ user.firstName | default: \"there\" }}, this is a church update from your ministry team."
          ),
        },
        draft: null,
        resourceType: "Declarative",
      },
    ],
    segments: [
      {
        id: "church_segment_visitors_v1",
        name: "Church Visitors",
        definition: {
          entryNode: {
            type: "Or",
            id: "church_segment_visitors_root_v1",
            children: ["church_segment_visitors_status_v1", "church_segment_prospects_status_v1"],
          },
          nodes: [
            {
              type: "Trait",
              id: "church_segment_visitors_status_v1",
              path: "memberStatus",
              operator: {
                type: "Equals",
                value: "visitor",
              },
            },
            {
              type: "Trait",
              id: "church_segment_prospects_status_v1",
              path: "memberStatus",
              operator: {
                type: "Equals",
                value: "prospect",
              },
            },
          ],
        },
      },
      {
        id: "church_segment_members_v1",
        name: "Church Members And Regulars",
        definition: {
          entryNode: {
            type: "Or",
            id: "church_segment_members_root_v1",
            children: [
              "church_segment_regular_attendee_status_v1",
              "church_segment_member_status_v1",
              "church_segment_leader_status_v1",
            ],
          },
          nodes: [
            {
              type: "Trait",
              id: "church_segment_regular_attendee_status_v1",
              path: "memberStatus",
              operator: {
                type: "Equals",
                value: "regular_attendee",
              },
            },
            {
              type: "Trait",
              id: "church_segment_member_status_v1",
              path: "memberStatus",
              operator: {
                type: "Equals",
                value: "member",
              },
            },
            {
              type: "Trait",
              id: "church_segment_leader_status_v1",
              path: "memberStatus",
              operator: {
                type: "Equals",
                value: "leader",
              },
            },
          ],
        },
      },
    ],
  };
}

const CHURCH_MESSAGING_BASELINE_PACK: DittofeedTemplatePack = {
  key: "church_messaging_baseline",
  name: "Church Messaging Baseline",
  description:
    "Starter embedded Dittofeed configuration for church messaging with email and custom SMS.",
  resources: buildChurchMessagingBaselineResources(),
};

const TEMPLATE_PACKS = [CHURCH_MESSAGING_BASELINE_PACK] as const;

export function getDittofeedTemplatePackCatalog() {
  return TEMPLATE_PACKS.map((pack) => ({
    key: pack.key,
    name: pack.name,
    description: pack.description,
    resourceCounts: {
      userProperties: pack.resources.userProperties?.length ?? 0,
      componentConfigurations: pack.resources.componentConfigurations?.length ?? 0,
      templates: pack.resources.templates?.length ?? 0,
      segments: pack.resources.segments?.length ?? 0,
      journeys: pack.resources.journeys?.length ?? 0,
    },
  }));
}

export function getDittofeedTemplatePackByKey(key: string) {
  return TEMPLATE_PACKS.find((pack) => pack.key === key) ?? null;
}

function cloneArray<T>(items: T[] | undefined): T[] | undefined {
  return items ? JSON.parse(JSON.stringify(items)) : undefined;
}

export function mergeDittofeedTemplatePackResources(
  base: DittofeedTemplatePackResources | undefined,
  override: DittofeedTemplatePackResources | undefined
): DittofeedTemplatePackResources {
  return {
    emailProvider: override?.emailProvider ?? base?.emailProvider,
    userProperties: [
      ...(cloneArray(base?.userProperties) ?? []),
      ...(cloneArray(override?.userProperties) ?? []),
    ],
    componentConfigurations: [
      ...(cloneArray(base?.componentConfigurations) ?? []),
      ...(cloneArray(override?.componentConfigurations) ?? []),
    ],
    templates: [
      ...(cloneArray(base?.templates) ?? []),
      ...(cloneArray(override?.templates) ?? []),
    ],
    segments: [
      ...(cloneArray(base?.segments) ?? []),
      ...(cloneArray(override?.segments) ?? []),
    ],
    journeys: [
      ...(cloneArray(base?.journeys) ?? []),
      ...(cloneArray(override?.journeys) ?? []),
    ],
  };
}

function replaceTokensInValue(
  value: unknown,
  replacements: Array<[token: string, replacement: string]>
): unknown {
  if (typeof value === "string") {
    let next = value;
    for (const [token, replacement] of replacements) {
      next = next.split(token).join(replacement);
    }
    return next;
  }

  if (Array.isArray(value)) {
    return value.map((item) => replaceTokensInValue(item, replacements));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        replaceTokensInValue(nestedValue, replacements),
      ])
    );
  }

  return value;
}

export function materializeDittofeedTemplatePackResources(
  resources: DittofeedTemplatePackResources,
  context: DittofeedTemplatePackMaterializationContext
): DittofeedTemplatePackResources {
  const replacements = [
    [APP_URL_TOKEN, context.appUrl?.trim() ?? ""],
    [WORKSPACE_ID_TOKEN, context.workspaceId?.trim() ?? ""],
    [SMS_WEBHOOK_SECRET_TOKEN, context.smsWebhookSecret?.trim() ?? ""],
    [EMAIL_FROM_TOKEN, context.emailFrom?.trim() ?? ""],
    [EMAIL_REPLY_TO_TOKEN, context.emailReplyTo?.trim() ?? ""],
  ] satisfies Array<[string, string]>;

  return replaceTokensInValue(
    JSON.parse(JSON.stringify(resources)),
    replacements
  ) as DittofeedTemplatePackResources;
}
