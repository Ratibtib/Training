import { useAuth } from './auth/AuthProvider'
import { Login } from './auth/Login'
import { Today } from './screens/Today'

export default function App() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="boot">Chargement…</div>
  }
  if (!session) {
    return <Login />
  }
  return <Today />
}
