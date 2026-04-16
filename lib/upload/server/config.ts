export interface S3UploadConfig {
  endpoint?: string
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  forcePathStyle: boolean
}

let cachedConfig: S3UploadConfig | null = null

function readRequiredEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

export function getS3UploadConfig(): S3UploadConfig {
  if (cachedConfig) {
    return cachedConfig
  }

  const endpoint = process.env.S3_ENDPOINT?.trim() || undefined
  const region = process.env.S3_REGION?.trim() || 'us-east-1'
  const accessKeyId = readRequiredEnv('S3_ACCESS_KEY_ID')
  const secretAccessKey = readRequiredEnv('S3_SECRET_ACCESS_KEY')
  const bucket = readRequiredEnv('S3_BUCKET')
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? 'true').toLowerCase() === 'true'

  cachedConfig = {
    endpoint,
    region,
    accessKeyId,
    secretAccessKey,
    bucket,
    forcePathStyle
  }

  return cachedConfig
}
