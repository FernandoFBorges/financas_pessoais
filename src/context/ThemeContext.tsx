import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type Theme = 'light' | 'dark'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined)

function temaInicial(): Theme {
  const salvo = localStorage.getItem('theme')
  if (salvo === 'light' || salvo === 'dark') return salvo
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(temaInicial)
  // PWA instalado e aba comum do navegador às vezes não compartilham o mesmo
  // localStorage no celular — por isso o tema também é salvo no usuário, no
  // banco, que é a mesma fonte não importa por onde você abrir o app.
  const userIdRef = useRef<string | null>(null)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    let ignore = false

    async function sincronizarComBanco() {
      const { data: sessionData } = await supabase.auth.getSession()
      userIdRef.current = sessionData.session?.user.id ?? null
      if (!userIdRef.current) return

      const { data } = await supabase.from('user_settings').select('tema').maybeSingle()
      if (ignore) return
      if (data?.tema === 'light' || data?.tema === 'dark') {
        setTheme(data.tema)
      }
    }

    sincronizarComBanco()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      userIdRef.current = session?.user.id ?? null
      if (event === 'SIGNED_IN') sincronizarComBanco()
    })

    return () => {
      ignore = true
      listener.subscription.unsubscribe()
    }
  }, [])

  function toggleTheme() {
    setTheme((t) => {
      const novo: Theme = t === 'light' ? 'dark' : 'light'
      if (userIdRef.current) {
        supabase
          .from('user_settings')
          .upsert({ user_id: userIdRef.current, tema: novo }, { onConflict: 'user_id' })
          .then(() => {})
      }
      return novo
    })
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}

// oxlint-disable-next-line react/only-export-components -- hook e Provider vivem juntos de propósito, arquivo pequeno o suficiente
export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme precisa estar dentro de ThemeProvider')
  return ctx
}
