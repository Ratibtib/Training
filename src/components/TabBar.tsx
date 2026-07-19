export type Tab = 'programme' | 'suivi' | 'evolution' | 'objectifs' | 'histo' | 'admin'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'programme', icon: '🏋', label: 'Prog.' },
  { id: 'suivi', icon: '📝', label: 'Suivi' },
  { id: 'evolution', icon: '📈', label: 'Évol.' },
  { id: 'objectifs', icon: '🎯', label: 'Cibles' },
  { id: 'histo', icon: '🕑', label: 'Histo' },
  { id: 'admin', icon: '⚙️', label: 'Admin' }
]

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      {TABS.map(t => (
        <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => onChange(t.id)}>
          <span className="ti">{t.icon}</span><span>{t.label}</span>
        </button>
      ))}
    </nav>
  )
}