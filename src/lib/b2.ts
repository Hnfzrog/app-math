import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

// Backblaze B2 (S3-compatible). Credentials dibaca dari .env.local (server-side only).
const endpoint = process.env.BACKBLAZE_ENDPOINT || '';
const region = endpoint.match(/s3\.([^.]+)\.backblazeb2/)?.[1] || 'us-east-005';

const s3 = new S3Client({
  endpoint,
  region,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID || '',
    secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY || ''
  }
});

export const B2_BUCKET = process.env.BACKBLAZE_BUCKET || '';

export async function uploadToB2(key: string, body: Buffer, contentType: string): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType
    })
  );
  return key;
}

export async function getFromB2(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3.send(new GetObjectCommand({ Bucket: B2_BUCKET, Key: key }));
  const bytes = await res.Body!.transformToByteArray();
  return { body: Buffer.from(bytes), contentType: res.ContentType || 'application/octet-stream' };
}
