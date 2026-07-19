import { createContext, useContext, useState, type ReactNode } from 'react'
import { todayISO } from '../lib/dates'

// Date de référence PARTAGÉE par toutes les vues (Jour / Semaine / Bloc).
// Faire défiler le temps dans une vue déplace toutes les autres.
interface DateCtx {
  refDate: string                 // 'YYYY-MM-DD'
  setRefDate: (d: string) => void
  goToday: () => void
}

const Ctx = createContext<DateCtx>({
  refDate: todayISO(), setRefDate: () => {}, goToday: () => {}
})

export function DateProvider({ children }: { children: ReactNode }) {
  const [refDate, setRefDate] = useState(todayISO())
  return (
    <Ctx.Provider value={{ refDate, setRefDate, goToday: () => setRefDate(todayISO()) }}>
      {children}
    </Ctx.Provider>
  )
}

export const useRefDate = () => useContext(Ctx)