import { Fragment } from 'react'
import { SmoothLink } from './SmoothLink'
export function Breadcrumbs({ items }: { items: { name: string; path?: string }[] }) {
  return <nav className="breadcrumbs" aria-label="Хлебные крошки">{items.map((item, index) => <Fragment key={item.name}>{index > 0 && <span aria-hidden="true">/</span>}{item.path ? <SmoothLink to={item.path}>{item.name}</SmoothLink> : <span aria-current="page">{item.name}</span>}</Fragment>)}</nav>
}
