import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mirror the vercel.json rewrites in dev/preview so /firma and /construccion
// work locally (Vite ignores vercel.json and falls back to index.html).
const REWRITES = [
  [/^\/construccion\/?$/, '/SitioEnConstruccion/index.html'],
  [/^\/firma\/?$/, '/Firma/firma_arlequin_svg_interactiva.html'],
]

const rewriteMiddleware = (req, _res, next) => {
  const [path, query] = req.url.split('?')
  const match = REWRITES.find(([re]) => re.test(path))
  if (match) req.url = match[1] + (query ? `?${query}` : '')
  next()
}

const vercelRewrites = {
  name: 'vercel-rewrites',
  configureServer(server) {
    server.middlewares.use(rewriteMiddleware)
  },
  configurePreviewServer(server) {
    server.middlewares.use(rewriteMiddleware)
  },
}

export default defineConfig({
  plugins: [react(), vercelRewrites],
  server: {
    host: true,
    port: 5173
  }
})
