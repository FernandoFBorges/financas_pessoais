import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompetenciaProvider } from './context/CompetenciaContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NovaTransacao from './pages/NovaTransacao'
import Parcelamento from './pages/Parcelamento'
import Configuracoes from './pages/Configuracoes'

function PrivateArea() {
  const { session, loading } = useAuth()

  if (loading) {
    return <div className="ledger-page"><p className="loading-msg">Carregando…</p></div>
  }

  if (!session) {
    return <Login />
  }

  return (
    <CompetenciaProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/nova" element={<NovaTransacao />} />
          <Route path="/parcelamento" element={<Parcelamento />} />
          <Route path="/config" element={<Configuracoes />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </CompetenciaProvider>
  )
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <PrivateArea />
      </AuthProvider>
    </BrowserRouter>
  )
}
