import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { NavigationProvider } from './components/NavigationContext'
import { SiteHeader } from './components/SiteHeader'
import HomePage from './pages/HomePage'
import FranchisePage from './pages/FranchisePage'
export function render(path: '/' | '/franchise') {
  return renderToStaticMarkup(<MemoryRouter initialEntries={[path]}><NavigationProvider><SiteHeader isHome={path === '/'} menuOpen={false} openMenu={() => {}} /><main id="main-content">{path === '/' ? <HomePage /> : <FranchisePage />}</main></NavigationProvider></MemoryRouter>)
}
