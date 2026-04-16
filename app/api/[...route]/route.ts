import { Hono } from 'hono'
import { handle } from 'hono/vercel'

const app = new Hono().basePath('/api')

app.get('/hello', c => {
  return c.json({
    message: 'All changes, fixes, and updates'
  })
})

export const GET = handle(app)
