import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { MESES } from '../lib/types'

interface Props {
  onSaved: () => void
  onCancel: () => void
}

export default function ReservaForm({ onSaved, onCancel }: Props) {
  const { mes, ano } = useCompetencia()

  const [tipo, setTipo] = useState<'deposito' | 'resgate'>('deposito')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10))
  const [competenciaMes, setCompetenciaMes] = useState(mes)
  const [competenciaAno, setCompetenciaAno] = useState(ano)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)

    const { error } = await supabase.from('reserva_movimentos').insert({
      tipo,
      valor: Number(valor.replace(',', '.')),
      descricao: descricao || null,
      data_lancamento: dataLancamento,
      competencia_mes: competenciaMes,
      competencia_ano: competenciaAno,
    })

    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      <p className="field-hint" style={{ marginTop: -4 }}>
        Não conta como despesa ou receita — é dinheiro seu mudando de lugar. Um depósito tira do
        saldo principal e soma na reserva; um resgate faz o caminho inverso.
      </p>

      <div className="tipo-toggle">
        <button
          type="button"
          className={'chip' + (tipo === 'deposito' ? ' active chip-despesa' : '')}
          onClick={() => setTipo('deposito')}
        >
          Depósito na reserva
        </button>
        <button
          type="button"
          className={'chip' + (tipo === 'resgate' ? ' active chip-receita' : '')}
          onClick={() => setTipo('resgate')}
        >
          Resgate da reserva
        </button>
      </div>

      <label className="field">
        <span>Descrição (opcional)</span>
        <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Reserva de emergência" autoFocus />
      </label>

      <label className="field">
        <span>Valor (R$)</span>
        <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Data</span>
          <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
        </label>
        <label className="field">
          <span>Competência</span>
          <span className="competencia-inline">
            <select value={competenciaMes} onChange={(e) => setCompetenciaMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
            <input type="number" value={competenciaAno} onChange={(e) => setCompetenciaAno(Number(e.target.value))} />
          </span>
        </label>
      </div>

      {erro && <p className="msg msg-erro">{erro}</p>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
