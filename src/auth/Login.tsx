import { useState } from 'react'
import { useAuth } from './AuthProvider'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true); setErr(null)
    const e = await signIn(email.trim(), password)
    if (e) setErr(e)
    setBusy(false)
  }

  return (
    <div className="login">
      <div className="login-card">
        <div className="eyebrow">Athlète — suivi</div>
        <h1>Connexion</h1>
        <p className="hint">Une seule fois. La session reste active ensuite.</p>
        <input
          type="email" placeholder="Email" value={email}
          autoComplete="email"
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        <input
          type="password" placeholder="Mot de passe" value={password}
          autoComplete="current-password"
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
        />
        {err && <div className="err">{err}</div>}
        <button className="primary" disabled={busy} onClick={submit}>
          {busy ? '...' : 'Se connecter'}
        </button>
      </div>
    </div>
  )
}
