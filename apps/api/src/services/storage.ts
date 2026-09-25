import 'dotenv/config';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import fs from 'fs';
import path from 'path';

let s3: S3Client | null = null;
let bucketChecked = false;

function getS3(): S3Client | null {
  const endpoint = process.env.S3_ENDPOINT;
  const accessKey = process.env.S3_ACCESS_KEY;
  const secretKey = process.env.S3_SECRET_KEY;
  const region = process.env.S3_REGION ?? 'ap-south-1';
  if (!endpoint || !accessKey || !secretKey) return null;
  if (s3) return s3;
  s3 = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true, // Supabase S3 requires path-style
  });
  return s3;
}

export function isS3Enabled(): boolean {
  return !!process.env.S3_ENDPOINT && !!process.env.S3_ACCESS_KEY && !!process.env.S3_SECRET_KEY && !!process.env.S3_BUCKET;
}

export async function ensureBucket(): Promise<boolean> {
  if (!isS3Enabled() || bucketChecked) return isS3Enabled();
  const client = getS3()!;
  const bucket = process.env.S3_BUCKET!;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    bucketChecked = true;
    return true;
  } catch (e: any) {
    console.warn('[Storage] Bucket check failed:', e.message, '— will attempt upload anyway (bucket may exist)');
    bucketChecked = true;
    return true;
  }
}

export async function uploadToStorage(key: string, body: Buffer, contentType: string): Promise<{ key: string; s3: boolean }> {
  if (isS3Enabled()) {
    await ensureBucket();
    const client = getS3()!;
    const bucket = process.env.S3_BUCKET!;
    try {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
      return { key, s3: true };
    } catch (e: any) {
      console.warn('[Storage] S3 upload failed, falling back to local:', e.message);
    }
  }
  // Fallback: local filesystem
  const localPath = path.join(process.cwd(), key);
  fs.mkdirSync(path.dirname(localPath), { recursive: true });
  fs.writeFileSync(localPath, body);
  return { key, s3: false };
}

export async function downloadFromStorage(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  // Try S3 first
  if (isS3Enabled()) {
    const client = getS3()!;
    const bucket = process.env.S3_BUCKET!;
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const body = await res.Body?.transformToByteArray();
      if (body) return { body: Buffer.from(body), contentType: (res.ContentType as string) ?? 'application/octet-stream' };
    } catch (e: any) {
      // fall through to local
    }
  }
  const localPath = path.join(process.cwd(), key);
  if (fs.existsSync(localPath)) {
    const body = fs.readFileSync(localPath);
    const isPdf = key.endsWith('.pdf');
    return { body, contentType: isPdf ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }
  return null;
}
