import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/config/env";

const PRESIGN_EXPIRY_SECONDS = 300;

const client = new S3Client({
  region: "auto",
  endpoint: `https://${env.R2.ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.R2.ACCESS_KEY_ID,
    secretAccessKey: env.R2.SECRET_ACCESS_KEY,
  },
});

export type PresignedUpload = {
  uploadUrl: string;
  expiresAt: Date;
};

export async function createPresignedPutUrl(
  key: string,
  contentType: string,
): Promise<PresignedUpload> {
  const command = new PutObjectCommand({
    Bucket: env.R2.BUCKET_NAME,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn: PRESIGN_EXPIRY_SECONDS,
  });

  return {
    uploadUrl,
    expiresAt: new Date(Date.now() + PRESIGN_EXPIRY_SECONDS * 1000),
  };
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: env.R2.BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  });

  await client.send(command);
}
