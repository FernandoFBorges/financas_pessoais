import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompetencia } from '../context/CompetenciaContext'
import { useTheme } from '../context/ThemeContext'
import { MESES } from '../lib/types'

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const { mes, ano, setMes, setAno, proximoMes, mesAnterior } = useCompetencia()
  const { theme, toggleTheme } = useTheme()

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name">Livro Caixa</span>
        </div>

        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Lançamentos
          </NavLink>
          <NavLink to="/config" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Categorias &amp; meios
          </NavLink>
          <NavLink to="/parametros" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            Parâmetros
          </NavLink>
        </nav>

        <div className="theme-toggle">
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Tema claro' : '🌙 Tema escuro'}
          </button>
          <button className="link-btn sair-btn" onClick={signOut}>Sair</button>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="competencia-tab">
            <button className="tab-arrow" onClick={mesAnterior} aria-label="Mês anterior">‹</button>
            <select
              className="tab-select"
              value={mes}
              onChange={(e) => setMes(Number(e.target.value))}
            >
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input
              className="tab-year"
              type="number"
              value={ano}
              onChange={(e) => setAno(Number(e.target.value))}
            />
            <button className="tab-arrow" onClick={proximoMes} aria-label="Próximo mês">›</button>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  )
}
