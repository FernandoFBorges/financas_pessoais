import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { CompetenciaProvider } from './context/CompetenciaContext'
import { ThemeProvider } from './context/ThemeContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Configuracoes from './pages/Configuracoes'
import Parametros from './pages/Parametros'

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
          <Route path="/config" element={<Configuracoes />} />
          <Route path="/parametros" element={<Parametros />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </CompetenciaProvider>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <AuthProvider>
          <PrivateArea />
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}
