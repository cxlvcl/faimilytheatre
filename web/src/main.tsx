import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/global.css'
import './styles/pages.css'
import './styles/responsive.css'
import './styles/refresh.css'

history.scrollRestoration = 'manual'
createRoot(document.getElementById('root')!).render(<App />)
