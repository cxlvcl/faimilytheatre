const formatter = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Moscow',
})

export function EventDate({ date, time }: { date: string; time: string | null }) {
  return <time dateTime={time ? `${date}T${time}` : date}>
    {formatter.format(new Date(`${date}T12:00:00+03:00`))}
    {time && <><span className="event-date__separator"> · </span><span className="event-scene__time">Начало в {time}</span></>}
  </time>
}
