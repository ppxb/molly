import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import { PRESIGNED_URL_EXPIRES_IN_SECONDS } from '@/lib/upload/shared'
import { getS3UploadConfig } from '@/lib/upload/server/config'

let client: S3Client | null = null

function getClient() {
  if (client) {
    return client
  }

  const config = getS3UploadConfig()
  client = new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey
    }
  })

  return client
}

function getBucketName() {
  return getS3UploadConfig().bucket
}

export function getUploadBucket() {
  return getBucketName()
}

export async function createSingleUploadPresignedUrl(input: { objectKey: string; contentType: string }) {
  const signedUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      ContentType: input.contentType
    }),
    {
      expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS
    }
  )

  return signedUrl
}

export async function assertObjectExists(objectKey: string) {
  await getClient().send(
    new HeadObjectCommand({
      Bucket: getBucketName(),
      Key: objectKey
    })
  )
}

export async function createMultipartUpload(input: { objectKey: string; contentType: string }) {
  const result = await getClient().send(
    new CreateMultipartUploadCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      ContentType: input.contentType
    })
  )

  if (!result.UploadId) {
    throw new Error('Failed to initialize multipart upload: missing upload id')
  }

  return result.UploadId
}

export async function createMultipartPartPresignedUrl(input: {
  objectKey: string
  uploadId: string
  partNumber: number
}) {
  return getSignedUrl(
    getClient(),
    new UploadPartCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      UploadId: input.uploadId,
      PartNumber: input.partNumber
    }),
    {
      expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS
    }
  )
}

export async function listMultipartUploadedParts(input: { objectKey: string; uploadId: string }) {
  const parts: Array<{ partNumber: number; eTag: string; size: number }> = []
  let marker: string | undefined

  while (true) {
    const result = await getClient().send(
      new ListPartsCommand({
        Bucket: getBucketName(),
        Key: input.objectKey,
        UploadId: input.uploadId,
        PartNumberMarker: marker
      })
    )

    for (const part of result.Parts ?? []) {
      if (typeof part.PartNumber !== 'number' || !part.ETag) {
        continue
      }

      parts.push({
        partNumber: part.PartNumber,
        eTag: part.ETag.replaceAll('"', ''),
        size: part.Size ?? 0
      })
    }

    if (!result.IsTruncated || !result.NextPartNumberMarker) {
      break
    }

    marker = result.NextPartNumberMarker
  }

  return parts
}

export async function completeMultipartUpload(input: {
  objectKey: string
  uploadId: string
  parts: Array<{ partNumber: number; eTag: string }>
}) {
  if (input.parts.length === 0) {
    throw new Error('Cannot complete multipart upload without parts')
  }

  await getClient().send(
    new CompleteMultipartUploadCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      UploadId: input.uploadId,
      MultipartUpload: {
        Parts: input.parts
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(part => ({
            PartNumber: part.partNumber,
            ETag: part.eTag
          }))
      }
    })
  )
}

export async function abortMultipartUpload(input: { objectKey: string; uploadId: string }) {
  await getClient().send(
    new AbortMultipartUploadCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      UploadId: input.uploadId
    })
  )
}

export async function createFileAccessUrl(input: { objectKey: string; fileName: string; inline: boolean }) {
  return getSignedUrl(
    getClient(),
    new GetObjectCommand({
      Bucket: getBucketName(),
      Key: input.objectKey,
      ResponseContentDisposition: `${input.inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(input.fileName)}"`
    }),
    {
      expiresIn: PRESIGNED_URL_EXPIRES_IN_SECONDS
    }
  )
}
