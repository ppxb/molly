import { createAPIRequestError } from '@/lib/drive/api/errors'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8080'

function resolveAPIBaseURL() {
  const envValue = import.meta.env.VITE_API_BASE_URL
  if (typeof envValue === 'string' && envValue.trim().length > 0) {
    return envValue.trim().replace(/\/+$/, '')
  }

  return DEFAULT_API_BASE_URL
}

const API_BASE_URL = resolveAPIBaseURL()

export async function requestJSON<TResponse>(path: string, body: unknown = {}) {
  let response: Response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  } catch (error) {
    throw createAPIRequestError({
      status: 0,
      path,
      payload: error,
      fallbackMessage: 'Network request failed'
    })
  }

  const raw = await response.text()
  let payload: unknown = null
  if (raw) {
    try {
      payload = JSON.parse(raw)
    } catch {
      payload = raw
    }
  }

  if (!response.ok) {
    throw createAPIRequestError({
      status: response.status,
      path,
      payload,
      fallbackMessage: `Request failed with status ${response.status}`
    })
  }

  return payload as TResponse
}
