import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import { MESES, type Tipo } from '../lib/types'

export interface DuplicadoPrefill {
  tipo: Tipo
  descricao: string
  categoria_id: string | null
  meio_pagamento_id: string | null
  valor: number
  competencia_mes: number
  competencia_ano: number
  observacao: string | null
}

interface Props {
  tipoInicial: Tipo
  duplicado?: DuplicadoPrefill | null
  onSaved: () => void
  onCancel: () => void
}

export default function TransactionForm({ tipoInicial, duplicado, onSaved, onCancel }: Props) {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()

  const [tipo, setTipo] = useState<Tipo>(duplicado?.tipo ?? tipoInicial)
  const [descricao, setDescricao] = useState(duplicado?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(duplicado?.categoria_id ?? '')
  const [meioId, setMeioId] = useState(duplicado?.meio_pagamento_id ?? '')
  const [valor, setValor] = useState(duplicado?.valor != null ? String(duplicado.valor) : '')
  const [valorEfetivo, setValorEfetivo] = useState('')
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10))
  const [competenciaMes, setCompetenciaMes] = useState(duplicado?.competencia_mes ?? mes)
  const [competenciaAno, setCompetenciaAno] = useState(duplicado?.competencia_ano ?? ano)
  const [pago, setPago] = useState(false)
  const [recorrente, setRecorrente] = useState(!!duplicado)
  const [observacao, setObservacao] = useState(duplicado?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const categoriasFiltradas = categories.filter((c) => c.tipo === tipo)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSalvando(true)

    const { error } = await supabase.from('transactions').insert({
      tipo,
      descricao,
      categoria_id: categoriaId || null,
      meio_pagamento_id: meioId || null,
      valor: Number(valor.replace(',', '.')),
      valor_efetivo: valorEfetivo ? Number(valorEfetivo.replace(',', '.')) : null,
      data_lancamento: dataLancamento,
      competencia_mes: competenciaMes,
      competencia_ano: competenciaAno,
      pago,
      recorrente,
      observacao: observacao || null,
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
      {duplicado && (
        <p className="msg msg-aviso">
          Lançamento duplicado a partir de outro — confira os dados abaixo (competência já
          avançada pro mês seguinte) e ajuste o que precisar antes de salvar.
        </p>
      )}

      <div className="tipo-toggle">
        <button
          type="button"
          className={'chip' + (tipo === 'despesa' ? ' active chip-despesa' : '')}
          onClick={() => { setTipo('despesa'); setCategoriaId('') }}
        >
          Despesa
        </button>
        <button
          type="button"
          className={'chip' + (tipo === 'receita' ? ' active chip-receita' : '')}
          onClick={() => { setTipo('receita'); setCategoriaId('') }}
        >
          Receita
        </button>
      </div>

      <label className="field">
        <span>Descrição</span>
        <input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Sacolão, Salário Qualitti..." autoFocus />
      </label>

      <div className="field-row">
        <label className="field">
          <span>Valor previsto (R$)</span>
          <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </label>
        <label className="field">
          <span>Valor efetivo (R$) — opcional</span>
          <input inputMode="decimal" value={valorEfetivo} onChange={(e) => setValorEfetivo(e.target.value)} placeholder="deixe em branco se não souber" />
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Categoria</span>
          <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
            <option value="">— selecione —</option>
            {categoriasFiltradas.map((c) => (
              <option key={c.id} value={c.id}>{c.nome}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Meio de pagamento</span>
          <select value={meioId} onChange={(e) => setMeioId(e.target.value)}>
            <option value="">— selecione —</option>
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="field-row">
        <label className="field">
          <span>Data do lançamento</span>
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

      <div className="field-row checkboxes">
        <label className="checkbox-field">
          <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
          <span>Já pago / recebido</span>
        </label>
        <label className="checkbox-field">
          <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
          <span>Marcar como recorrente</span>
        </label>
      </div>

      <label className="field">
        <span>Observação (opcional)</span>
        <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </label>

      {erro && <p className="msg msg-erro">{erro}</p>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : 'Salvar lançamento'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
