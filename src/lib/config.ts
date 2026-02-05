import { AppConfigPublic } from "./types";

export const appConfig: AppConfigPublic = {
  projectName: "Fellowship 360",
  projectSlug: "fellowship-360",
  keywords: [
    "Fellowship 360",
    "Church CRM",
    "Church Management",
    "Ministry Dashboard",
    "Grace AI",
    "Church Software",
  ],
  description:
    "Fellowship 360 is an AI-powered church CRM for managing your ministry with precision.",
  legal: {
    address: {
      street: "",
      city: "",
      state: "",
      postalCode: "",
      country: "USA",
    },
    email: "support@fellowship360.com",
    phone: "",
  },
  social: {
    twitter: "",
    instagram: "",
    linkedin: "",
    facebook: "",
    youtube: "",
  },
  email: {
    senderName: "Fellowship 360",
    senderEmail: "noreply@fellowship360.com",
  },
  auth: {
    enablePasswordAuth: true, // Password authentication enabled
  },
};

