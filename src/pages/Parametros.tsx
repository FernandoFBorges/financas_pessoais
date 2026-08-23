import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Parametros() {
  const { session } = useAuth()
  const [saldoInicial, setSaldoInicial] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [sucesso, setSucesso] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    async function carregar() {
      const { data } = await supabase.from('user_settings').select('*').maybeSingle()
      if (data) setSaldoInicial(String(data.saldo_inicial))
      setCarregando(false)
    }
    carregar()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(false)
    setSalvando(true)

    const valor = Number(saldoInicial.replace(',', '.')) || 0

    const { error } = await supabase
      .from('user_settings')
      .upsert(
        { user_id: session?.user.id, saldo_inicial: valor, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setSucesso(true)
  }

  return (
    <div className="ledger-card form-card">
      <h2 className="form-title">Parâmetros</h2>
      <p className="field-hint">
        Saldo que você já tinha (em contas, dinheiro, etc.) no momento em que começou a usar este
        controle — ponto de partida pra qualquer cálculo de saldo acumulado no futuro.
      </p>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : (
        <form onSubmit={handleSubmit}>
          <label className="field">
            <span>Saldo inicial (R$)</span>
            <input
              inputMode="decimal"
              value={saldoInicial}
              onChange={(e) => setSaldoInicial(e.target.value)}
              placeholder="0,00"
            />
          </label>

          {erro && <p className="msg msg-erro">{erro}</p>}
          {sucesso && <p className="msg msg-sucesso">Salvo.</p>}

          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={salvando}>
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
