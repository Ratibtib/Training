import { useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { Evolution } from './Evolution'
import { Objectifs } from './Objectifs'

type Volet = 'progression' | 'objectifs'

// Conteneur à deux volets : Progression (Évolution) + Objectifs
export function Progression() {
  const { signOut } = useAuth()
  const [volet, setVolet] = useState<Volet>('progression')

  return (
    <div className="screen">
      <div className="appbar">
        <div className="eyebrow">Évolution</div>
        <button className="link" onClick={signOut}>Déconnexion</button>
      </div>

      <div className="seg">
        <button className={'seg-btn' + (volet === 'progression' ? ' on' : '')}
          onClick={() => setVolet('progression')}>Progression</button>
        <button className={'seg-btn' + (volet === 'objectifs' ? ' on' : '')}
          onClick={() => setVolet('objectifs')}>Objectifs</button>
      </div>

      {volet === 'progression' ? <Evolution /> : <Objectifs />}
    </div>
  )
}