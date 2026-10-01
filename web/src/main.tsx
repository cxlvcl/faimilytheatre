import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/pages.css'
import './styles/responsive.css'
import './styles/refresh.css'
import './styles/articles.css'
import './styles/home-2026.css'

history.scrollRestoration = 'manual'
createRoot(document.getElementById('root')!).render(<App />)
