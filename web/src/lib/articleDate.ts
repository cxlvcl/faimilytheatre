const months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря']
export function articleDate(value: string): string {
  const [year, month, day] = value.split('-').map(Number)
  return `${day} ${months[month - 1]} ${year}`
}
