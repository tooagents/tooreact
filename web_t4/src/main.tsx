import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import Spinner from './views/spinner/Spinner.tsx'
import './assets/css/globals.css'

createRoot(document.getElementById('root')!).render(
    <Suspense fallback={<Spinner />}>
        <App />
    </Suspense>
)
