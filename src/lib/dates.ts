// Utilitaires de dates en heure LOCALE (évite le décalage UTC près de minuit)

export function isoDate(d: Date): string {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().slice(0, 10)
}

export function todayISO(): string {
  return isoDate(new Date())
}

// Parse 'YYYY-MM-DD' en Date locale (midi, pour éviter tout effet de bord de fuseau)
export function parseISO(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function addDays(iso: string, n: number): string {
  const d = parseISO(iso); d.setDate(d.getDate() + n); return isoDate(d)
}

export function addWeeks(iso: string, n: number): string {
  return addDays(iso, n * 7)
}

// Lundi (midi local) de la semaine contenant `iso`
export function mondayOfISO(iso: string): Date {
  const d = parseISO(iso)
  const day = (d.getDay() + 6) % 7 // 0 = lundi
  d.setDate(d.getDate() - day)
  return d
}

export function mondayOf(ref?: Date): Date {
  return mondayOfISO(ref ? isoDate(ref) : todayISO())
}

export function weekBoundsISO(iso: string): { monday: string; sunday: string } {
  const m = mondayOfISO(iso)
  const s = new Date(m); s.setDate(m.getDate() + 6)
  return { monday: isoDate(m), sunday: isoDate(s) }
}

// Libellés FR
const MOIS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc']
const JOURS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam']

export function labelJour(iso: string): string {
  const d = parseISO(iso)
  return `${JOURS[d.getDay()]}. ${d.getDate()} ${MOIS[d.getMonth()]}`
}

export function labelSemaine(iso: string): string {
  const { monday, sunday } = weekBoundsISO(iso)
  const m = parseISO(monday), s = parseISO(sunday)
  return `${m.getDate()} ${MOIS[m.getMonth()]} → ${s.getDate()} ${MOIS[s.getMonth()]}`
}