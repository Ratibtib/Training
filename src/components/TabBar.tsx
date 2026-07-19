export type Tab = 'programme' | 'suivi' | 'objectifs' | 'histo'

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: 'programme', icon: '🏋', label: 'Programme' },
  { id: 'suivi', icon: '📈', label: 'Suivi' },
  { id: 'objectifs', icon: '🎯', label: 'Objectifs' },
  { id: 'histo', icon: '🕑', label: 'Histo' }
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