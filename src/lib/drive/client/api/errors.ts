import type { UploadBatchResponseItem } from '@/lib/drive/shared'

interface APIErrorBody {
  code?: unknown
  message?: unknown
  request_id?: unknown
  requestId?: unknown
  body?: unknown
  error?: unknown
  data?: unknown
}

interface ParsedAPIError {
  code?: string
  message?: string
  requestId?: string
}

interface CreateAPIRequestErrorInput {
  status: number
  path: string
  payload: unknown
  fallbackMessage: string
}

function asRecord(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') {
    return null
  }

  return input as Record<string, unknown>
}

function readStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

function parseErrorRecord(record: Record<string, unknown> | null): ParsedAPIError {
  if (!record) {
    return {}
  }

  const body = record as APIErrorBody
  return {
    code: readStringValue(body.code),
    message: readStringValue(body.message),
    requestId: readStringValue(body.request_id) ?? readStringValue(body.requestId)
  }
}

function parseAPIErrorPayload(payload: unknown): ParsedAPIError {
  if (typeof payload === 'string') {
    return {
      message: readStringValue(payload)
    }
  }

  const root = asRecord(payload)
  if (!root) {
    return {}
  }

  const rootParsed = parseErrorRecord(root)
  if (rootParsed.code || rootParsed.message || rootParsed.requestId) {
    return rootParsed
  }

  const wrappers: unknown[] = [root.body, root.error, root.data]
  for (const wrapper of wrappers) {
    const parsed = parseErrorRecord(asRecord(wrapper))
    if (parsed.code || parsed.message || parsed.requestId) {
      return parsed
    }
  }

  return {}
}

export class APIRequestError extends Error {
  readonly status: number
  readonly code?: string
  readonly requestId?: string
  readonly path: string
  readonly details: unknown

  constructor(input: {
    status: number
    message: string
    path: string
    details: unknown
    code?: string
    requestId?: string
  }) {
    const renderedMessage = input.requestId ? `${input.message} (request_id: ${input.requestId})` : input.message
    super(renderedMessage)
    this.name = 'APIRequestError'
    this.status = input.status
    this.code = input.code
    this.requestId = input.requestId
    this.path = input.path
    this.details = input.details
  }
}

export function createAPIRequestError(input: CreateAPIRequestErrorInput): APIRequestError {
  const parsed = parseAPIErrorPayload(input.payload)
  const message = parsed.message ?? input.fallbackMessage

  return new APIRequestError({
    status: input.status,
    path: input.path,
    details: input.payload,
    message,
    code: parsed.code,
    requestId: parsed.requestId
  })
}

export function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof APIRequestError) {
    return error.message
  }

  if (error instanceof Error) {
    const normalized = error.message.trim()
    return normalized.length > 0 ? normalized : fallback
  }

  if (typeof error === 'string') {
    const normalized = error.trim()
    return normalized.length > 0 ? normalized : fallback
  }

  return fallback
}

export function createBatchItemError(item: UploadBatchResponseItem | undefined, fallbackMessage: string) {
  if (!item) {
    return createAPIRequestError({
      status: 500,
      path: '/v1/batch',
      payload: null,
      fallbackMessage
    })
  }

  return createAPIRequestError({
    status: item.status,
    path: '/v1/batch',
    payload: item.body,
    fallbackMessage
  })
}
