/** Repertoire sections assigned in the admin (a performance may be in several). */
export const repertoireSections = [
  { id: 'kids', label: 'Малышам' },
  { id: 'school', label: 'Школьникам' },
  { id: 'adults', label: 'Взрослым' },
  { id: 'new_year', label: 'Новогодние спектакли' },
] as const

export type RepertoireSection = typeof repertoireSections[number]['id']

export function isRepertoireSection(value: string | null): value is RepertoireSection {
  return repertoireSections.some(section => section.id === value)
}
