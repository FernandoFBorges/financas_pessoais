import { createContext, useContext, useState, type ReactNode } from 'react'

interface CompetenciaValue {
  mes: number
  ano: number
  setMes: (mes: number) => void
  setAno: (ano: number) => void
  proximoMes: () => void
  mesAnterior: () => void
}

const CompetenciaContext = createContext<CompetenciaValue | undefined>(undefined)

export function CompetenciaProvider({ children }: { children: ReactNode }) {
  const hoje = new Date()
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [ano, setAno] = useState(hoje.getFullYear())

  function proximoMes() {
    if (mes === 12) {
      setMes(1)
      setAno((a) => a + 1)
    } else {
      setMes((m) => m + 1)
    }
  }

  function mesAnterior() {
    if (mes === 1) {
      setMes(12)
      setAno((a) => a - 1)
    } else {
      setMes((m) => m - 1)
    }
  }

  return (
    <CompetenciaContext.Provider value={{ mes, ano, setMes, setAno, proximoMes, mesAnterior }}>
      {children}
    </CompetenciaContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components -- hook e Provider vivem juntos de propósito, arquivo pequeno o suficiente
export function useCompetencia() {
  const ctx = useContext(CompetenciaContext)
  if (!ctx) throw new Error('useCompetencia precisa estar dentro de CompetenciaProvider')
  return ctx
}
