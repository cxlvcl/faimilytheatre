import { createRoot } from 'react-dom/client'
import App from './App'
import { warmRoutes } from './lib/routePreload'
import { initThemeFavicon } from './lib/themeFavicon'
import { startCounters } from './lib/counters'
import './styles/global.css'
import './styles/pages.css'
import './styles/responsive.css'
import './styles/refresh.css'
import './styles/articles.css'
import './styles/home-2026.css'
import './styles/paper.css'
import './styles/mobile-2026.css'
import './styles/transitions.css'
import './styles/corrections-2026-10.css'

history.scrollRestoration = 'manual'
initThemeFavicon()
// Focus frames only for keyboard users: a tap must not leave a ring on a programmatically focused element.
const html = document.documentElement
window.addEventListener('pointerdown', () => { html.dataset.input = 'pointer' }, true)
window.addEventListener('keydown', event => { if (!event.metaKey && !event.ctrlKey && !event.altKey) html.dataset.input = 'keyboard' }, true)
createRoot(document.getElementById('root')!).render(<App />)
warmRoutes()
startCounters()
