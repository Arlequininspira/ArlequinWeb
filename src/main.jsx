import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initViewportFit } from './layout/viewportFit'

// /login → admin panel, loaded as a separate chunk so the public site never
// downloads it (nor the Supabase client).
const isAdmin = /^\/login(\/|$)/.test(window.location.pathname)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

// /lab/flip → banco de pruebas del giro de carta. Solo en `npm run dev`:
// en el build de producción `import.meta.env.DEV` es false y Vite lo elimina.
const isLab = import.meta.env.DEV && /^\/lab\/flip(\/|$)/.test(window.location.pathname)
const FlipLab = import.meta.env.DEV ? lazy(() => import('./lab/FlipLab.jsx')) : null

// Publish screen-derived CSS vars before the first paint.
if (!isAdmin && !isLab) initViewportFit()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isLab ? (
      <Suspense fallback={null}>
        <FlipLab />
      </Suspense>
    ) : isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
