import { OrganizationRole } from "@/db/schema";
import withOrganizationAuthRequired from "@/lib/auth/withOrganizationAuthRequired";
import createS3UploadFields from "@/lib/s3/createS3UploadFields";
import { NextResponse } from "next/server";

interface UploadLogoRequest {
  fileName: string;
  fileType: string;
  fileSize: number;
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const POST = withOrganizationAuthRequired(async (req, context) => {
  try {
    const { session } = context;
    const currentOrganization = await session.organization;
    const { fileName, fileType, fileSize }: UploadLogoRequest =
      await req.json();

    if (
      !process.env.AWS_BUCKET_NAME ||
      !process.env.AWS_REGION ||
      !process.env.AWS_ACCESS_KEY_ID ||
      !process.env.AWS_SECRET_ACCESS_KEY
    ) {
      return NextResponse.json(
        {
          error:
            "AWS_BUCKET_NAME, AWS_REGION, AWS_ACCESS_KEY_ID, or AWS_SECRET_ACCESS_KEY is not set",
        },
        { status: 500 }
      );
    }

    // Validate input
    if (!fileName || !fileType || fileSize == null) {
      return NextResponse.json(
        { error: "Missing required fields: fileName, fileType, fileSize" },
        { status: 400 }
      );
    }

    const normalizedFileType = fileType.toLowerCase().trim();
    const fileExtension = ALLOWED_IMAGE_TYPES[normalizedFileType];
    if (!fileExtension) {
      return NextResponse.json(
        { error: "Unsupported image format" },
        { status: 400 }
      );
    }

    const parsedFileSize = Number(fileSize);
    if (!Number.isFinite(parsedFileSize) || parsedFileSize <= 0) {
      return NextResponse.json(
        { error: "Invalid file size" },
        { status: 400 }
      );
    }

    // Validate file size (max 5MB for logos)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (parsedFileSize > maxSize) {
      return NextResponse.json(
        { error: "File size too large. Maximum allowed size is 5MB" },
        { status: 400 }
      );
    }

    // Generate UUID for filename
    const fileUuid = crypto.randomUUID();

    // Construct S3 path: /public/organizations/<org-id>/logos/<filename-uuid>.format
    const s3Path = `public/organizations/${currentOrganization.id}/logos/${fileUuid}.${fileExtension}`;

    // Create presigned URL
    const presignedPost = await createS3UploadFields({
      path: s3Path,
      maxSize: maxSize,
      contentType: normalizedFileType,
    });

    return NextResponse.json({
      url: presignedPost.url,
      fields: presignedPost.fields,
    });
  } catch (error) {
    console.error("Error creating presigned URL for logo upload:", error);
    return NextResponse.json(
      { error: "Failed to create upload URL" },
      { status: 500 }
    );
  }
}, OrganizationRole.enum.user);
