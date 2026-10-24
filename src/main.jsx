import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initViewportFit } from './layout/viewportFit'

// /login → admin panel, loaded as a separate chunk so the public site never
// downloads it (nor the Supabase client).
const isAdmin = /^\/login(\/|$)/.test(window.location.pathname)
const AdminApp = lazy(() => import('./admin/AdminApp.jsx'))

// Publish screen-derived CSS vars before the first paint.
if (!isAdmin) initViewportFit()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
