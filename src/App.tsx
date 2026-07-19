import { useState } from 'react'
import { useAuth } from './auth/AuthProvider'
import { Login } from './auth/Login'
import { Programme } from './screens/Programme'
import { Suivi } from './screens/Suivi'
import { Evolution } from './screens/Evolution'
import { Objectifs } from './screens/Objectifs'
import { Historique } from './screens/Historique'
import { Admin } from './screens/Admin'
import { TabBar, type Tab } from './components/TabBar'

export default function App() {
  const { session, loading } = useAuth()
  const [tab, setTab] = useState<Tab>('programme')

  if (loading) return <div className="boot">Chargement…</div>
  if (!session) return <Login />

  return (
    <div className="app">
      <div className="app-body">
        {tab === 'programme' && <Programme />}
        {tab === 'suivi' && <Suivi />}
        {tab === 'evolution' && <Evolution />}
        {tab === 'objectifs' && <Objectifs />}
        {tab === 'histo' && <Historique />}
        {tab === 'admin' && <Admin />}
      </div>
      <TabBar tab={tab} onChange={setTab} />
    </div>
  )
}