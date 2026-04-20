const DEFAULT_API_BASE_URL = 'http://localhost:8080'

function resolveAPIBaseURL() {
  const env = import.meta.env.VITE_API_BASE_URL
  if (typeof env === 'string' && env.trim().length > 0) {
    return env.trim().replace(/\/+$/, '')
  }
  return DEFAULT_API_BASE_URL
}

const API_BASE_URL = resolveAPIBaseURL()

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly requestId?: string
  ) {
    super(requestId ? `${message} (requestId: ${requestId})` : message)
    this.name = 'ApiError'
  }
}

function parseErrorBody(body: unknown) {
  if (!body || typeof body !== 'object') return {}
  const b = body as Record<string, unknown>

  const getStr = (key: string) => {
    const val = b[key]
    return typeof val === 'string' ? val.trim() || undefined : undefined
  }

  const message = getStr('message')
  const code = getStr('code')
  const requestId = getStr('request_id') || getStr('requestId')

  if (!message && !code) {
    const nested = b.body ?? b.error ?? b.data
    if (nested && typeof nested === 'object') {
      return parseErrorBody(nested)
    }
  }

  return { message, code, requestId }
}

export function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError) return error.message
  if (error instanceof Error) return error.message.trim() || fallback
  if (typeof error === 'string') return error.trim() || fallback
  return fallback
}

export async function request<T>(path: string, body?: unknown): Promise<T> {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
  } catch {
    throw new ApiError(0, '网络请求失败，请检查网络连接')
  }

  const raw = await response.text().catch(() => '')
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    const { message, code, requestId } = parseErrorBody(payload)
    throw new ApiError(response.status, message ?? `请求失败 (${response.status})`, code, requestId)
  }

  return payload as T
}

import type { BatchResponseItem } from '@/types/drive'

export function createBatchItemError(item: BatchResponseItem | undefined, fallback: string) {
  if (!item) return new ApiError(500, fallback)
  const { message, code, requestId } = parseErrorBody(item.body)
  return new ApiError(item.status, message ?? fallback, code, requestId)
}
