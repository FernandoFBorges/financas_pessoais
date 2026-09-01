import { useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useCompetencia } from '../context/CompetenciaContext'
import { useTheme } from '../context/ThemeContext'
import { MESES } from '../lib/types'

export default function Layout({ children }: { children: ReactNode }) {
  const { signOut } = useAuth()
  const { mes, ano, setMes, setAno, proximoMes, mesAnterior } = useCompetencia()
  const { theme, toggleTheme } = useTheme()

  const [colapsada, setColapsada] = useState(() => localStorage.getItem('sidebarColapsada') === '1')

  useEffect(() => {
    localStorage.setItem('sidebarColapsada', colapsada ? '1' : '0')
  }, [colapsada])

  return (
    <div className={'app-shell' + (colapsada ? ' app-shell-collapsed' : '')}>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" />
          <span className="brand-name nav-label">Livro Caixa</span>
        </div>

        <button
          className="sidebar-collapse-btn"
          onClick={() => setColapsada((c) => !c)}
          title={colapsada ? 'Expandir menu' : 'Recolher menu'}
        >
          <span className="nav-icon">{colapsada ? '»' : '«'}</span>
          <span className="nav-label">Recolher</span>
        </button>

        <nav className="nav">
          <NavLink to="/" end className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Lançamentos">
            <span className="nav-icon">🧾</span>
            <span className="nav-label">Lançamentos</span>
          </NavLink>
          <NavLink to="/config" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Categorias & meios">
            <span className="nav-icon">🏷️</span>
            <span className="nav-label">Categorias &amp; meios</span>
          </NavLink>
          <NavLink to="/parametros" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')} title="Parâmetros">
            <span className="nav-icon">⚙️</span>
            <span className="nav-label">Parâmetros</span>
          </NavLink>
        </nav>

        <div className="theme-toggle">
          <button className="theme-toggle-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}>
            <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            <span className="nav-label">{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>
          </button>
          <button className="link-btn sair-btn" onClick={signOut} title="Sair">
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Sair</span>
          </button>
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
