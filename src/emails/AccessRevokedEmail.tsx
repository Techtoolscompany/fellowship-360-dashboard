import * as React from "react";
import { Html } from "@react-email/html";
import { Text } from "@react-email/text";
import Layout from "./components/Layout";
import { appConfig } from "@/lib/config";

interface AccessRevokedEmailProps {
  workspaceName: string;
  revokedByName: string;
}

export default function AccessRevokedEmail({
  workspaceName,
  revokedByName,
}: AccessRevokedEmailProps) {
  return (
    <Html>
      <Layout previewText={`Your access to ${workspaceName} has been revoked 🔒`}>
        <Text>Hello,</Text>

        <Text>
          {revokedByName} has removed your access to <strong>{workspaceName}</strong>{" "}
          on {appConfig.projectName}.
        </Text>

        <Text>
          You will no longer be able to access this workspace or its resources.
          Any pending invitations or active sessions will be terminated.
        </Text>

        <Text>
          If you believe this was done in error, please contact your workspace
          administrator directly.
        </Text>

        <Text className="text-muted text-[14px] mt-4">
          Thank you for being part of {workspaceName}. We wish you all the best in
          your future endeavors.
        </Text>
      </Layout>
    </Html>
  );
} 