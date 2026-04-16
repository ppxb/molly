import { handle } from 'hono/vercel'

import { uploadApi } from '@/lib/upload/server/router'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export const GET = handle(uploadApi)
export const POST = handle(uploadApi)
export const PUT = handle(uploadApi)
export const PATCH = handle(uploadApi)
export const DELETE = handle(uploadApi)
export const OPTIONS = handle(uploadApi)
