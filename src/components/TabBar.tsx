export type Tab = 'programme' | 'suivi'

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar">
      <button className={'tab' + (tab === 'programme' ? ' on' : '')} onClick={() => onChange('programme')}>
        <span className="ti">🏋</span><span>Programme</span>
      </button>
      <button className={'tab' + (tab === 'suivi' ? ' on' : '')} onClick={() => onChange('suivi')}>
        <span className="ti">📈</span><span>Suivi</span>
      </button>
    </nav>
  )
}