import { publicApi } from '../lib/api'
import { trackBuy } from '../lib/counters'

interface Props {
  event: { id: number; event_date: string; event_time: string | null; ticket_url: string; is_cancelled?: boolean }
  title: string
  className?: string
}

/** «Купить билет»: own statistics plus the Metrika/VK goal; a cancelled date shows a note instead. */
export function BuyLink({ event, title, className }: Props) {
  if (event.is_cancelled) return <p className={`${className ?? ''} buy-cancelled`.trim()}>Показ отменён</p>
  return <a className={className} href={event.ticket_url} target="_blank" rel="noopener noreferrer" onClick={() => {
    publicApi.ticketClick(event.id)
    trackBuy(title, event.event_date + (event.event_time ? ` ${event.event_time}` : ''))
  }}>Купить билет</a>
}
