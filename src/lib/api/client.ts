const BASE = (import.meta.env.VITE_API_BASE_URL ?? 'http://127.0.0.1:8080').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(
    public readonly httpStatus: number,
    public readonly code: number,
    message: string
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let _getToken: () => string | null = () => null
let _onUnauthorized: () => void = () => {}

/** 由 auth store 在初始化时调用，避免循环依赖 */
export function initApiClient(getToken: () => string | null, onUnauthorized: () => void) {
  _getToken = getToken
  _onUnauthorized = onUnauthorized
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = _getToken()
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>)
  }

  // FormData 让浏览器自动设置 multipart boundary
  if (!(init.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 0, '网络请求失败，请检查网络连接')
  }

  if (res.status === 401) {
    _onUnauthorized()
    throw new ApiError(401, 401, '登录已过期，请重新登录')
  }

  if (res.status === 204) return undefined as T

  const json = await res.json().catch(() => ({}))

  if (!res.ok || (json.code !== undefined && json.code >= 400)) {
    throw new ApiError(res.status, json.code ?? res.status, json.message ?? '请求失败')
  }

  return json.data as T
}

type Params = Record<string, string | number | boolean | undefined | null>

function buildQuery(params: Params): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

export const http = {
  get: <T>(path: string, params?: Params) => {
    const qs = params ? buildQuery(params) : ''
    return req<T>(qs ? `${path}?${qs}` : path, { method: 'GET' })
  },
  post: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: 'POST', body: body != null ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: 'PUT', body: body != null ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string, body?: unknown) =>
    req<T>(path, { method: 'DELETE', body: body != null ? JSON.stringify(body) : undefined }),
  upload: <T>(path: string, form: FormData) => req<T>(path, { method: 'POST', body: form })
}
