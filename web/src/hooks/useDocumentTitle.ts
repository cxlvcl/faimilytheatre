import { useEffect } from 'react'

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} — Театр Музыки и Песка` : 'Театр Музыки и Песка'
  }, [title])
}
