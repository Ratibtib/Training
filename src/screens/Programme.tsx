import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Today } from './Today'
import { Semaine } from './Semaine'
import { BlocView } from './BlocView'

type Zoom = 'jour' | 'semaine' | 'bloc'
const LABELS: Record<Zoom, string> = { jour: 'Jour', semaine: 'Semaine', bloc: 'Bloc' }

export function Programme() {
  const { signOut } = useAuth()
  const [zoom, setZoom] = useState<Zoom>('jour')

  return (
    <div className="screen">
      <div className="appbar">
        <div className="eyebrow">Programme</div>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>

      <div className="seg">
        {(['jour', 'semaine', 'bloc'] as Zoom[]).map(z => (
          <button key={z} className={'seg-btn' + (zoom === z ? ' on' : '')} onClick={() => setZoom(z)}>
            {LABELS[z]}
          </button>
        ))}
      </div>

      {zoom === 'jour' && <Today />}
      {/* En cliquant un jour dans la semaine, on bascule vers la vue Jour */}
      {zoom === 'semaine' && <Semaine onOpenDay={() => setZoom('jour')} />}
      {zoom === 'bloc' && <BlocView />}
    </div>
  )
}