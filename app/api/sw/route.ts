import { readFileSync } from 'fs'
import { join } from 'path'

export async function GET() {
  try {
    const swPath = join(process.cwd(), 'public', 'sw.js')
    const swContent = readFileSync(swPath, 'utf-8')

    return new Response(swContent, {
      headers: {
        'Content-Type': 'application/javascript',
        'Cache-Control': 'public, max-age=0, must-revalidate',
        'Service-Worker-Allowed': '/',
      },
    })
  } catch (error) {
    console.error('[v0] Failed to serve SW:', error)
    return new Response('Service Worker not found', { status: 404 })
  }
}
