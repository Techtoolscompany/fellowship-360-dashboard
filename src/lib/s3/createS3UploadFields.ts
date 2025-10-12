import {
  createPresignedPost,
  PresignedPost,
  PresignedPostOptions,
} from "@aws-sdk/s3-presigned-post";
import s3 from "./client";

const createS3UploadFields = async ({
  path,
  maxSize,
  contentType,
}: {
  path: string;
  maxSize?: number;
  contentType?: string;
}): Promise<PresignedPost> => {
  if (!process.env.AWS_BUCKET_NAME) {
    throw new Error("AWS_BUCKET_NAME is not set");
  }
  const params: PresignedPostOptions = {
    Bucket: process.env.AWS_BUCKET_NAME,
    Key: path,
    Conditions: [],
    Fields: {},
    Expires: 3600,
  };

  if (maxSize) {
    params.Conditions?.push(["content-length-range", 0, maxSize]);
  }

  if (contentType) {
    params.Conditions?.push(["starts-with", "$Content-Type", contentType]);
    params.Fields = {
      "Content-Type": contentType,
    };
  }

  const result = await createPresignedPost(s3, params);

  return result;
};

export default createS3UploadFields;
