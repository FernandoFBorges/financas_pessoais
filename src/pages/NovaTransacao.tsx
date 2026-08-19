import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import { MESES, type Tipo } from '../lib/types'

export default function NovaTransacao() {
  const navigate = useNavigate()
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()

  const [tipo, setTipo] = useState<Tipo>('despesa')
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [meioId, setMeioId] = useState('')
  const [valor, setValor] = useState('')
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10))
  const [competenciaMes, setCompetenciaMes] = useState(mes)
  const [competenciaAno, setCompetenciaAno] = useState(ano)
  const [pago, setPago] = useState(false)
  const [recorrente, setRecorrente] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)

  const categoriasFiltradas = categories.filter((c) => c.tipo === tipo)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(false)
    setSalvando(true)

    const { error } = await supabase.from('transactions').insert({
      tipo,
      descricao,
      categoria_id: categoriaId || null,
      meio_pagamento_id: meioId || null,
      valor: Number(valor.replace(',', '.')),
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

    setSucesso(true)
    setDescricao('')
    setValor('')
    setObservacao('')
  }

  return (
    <div className="ledger-card form-card">
      <h2 className="form-title">Novo lançamento</h2>

      <form onSubmit={handleSubmit}>
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
          <input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Sacolão, Salário Qualitti..." />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Valor (R$)</span>
            <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </label>

          <label className="field">
            <span>Categoria</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">— selecione —</option>
              {categoriasFiltradas.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Meio de pagamento</span>
            <select value={meioId} onChange={(e) => setMeioId(e.target.value)}>
              <option value="">— selecione —</option>
              {paymentMethods.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Data do lançamento</span>
            <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
          </label>
        </div>

        <p className="field-hint">
          A competência é o mês/ano a que esse lançamento pertence de fato — pode ser diferente da data acima.
        </p>

        <div className="field-row">
          <label className="field">
            <span>Competência — mês</span>
            <select value={competenciaMes} onChange={(e) => setCompetenciaMes(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>Competência — ano</span>
            <input type="number" value={competenciaAno} onChange={(e) => setCompetenciaAno(Number(e.target.value))} />
          </label>
        </div>

        <div className="field-row checkboxes">
          <label className="checkbox-field">
            <input type="checkbox" checked={pago} onChange={(e) => setPago(e.target.checked)} />
            <span>Já pago / recebido</span>
          </label>
          <label className="checkbox-field">
            <input type="checkbox" checked={recorrente} onChange={(e) => setRecorrente(e.target.checked)} />
            <span>Marcar como recorrente (só um marcador — use "duplicar" no mês seguinte)</span>
          </label>
        </div>

        <label className="field">
          <span>Observação (opcional)</span>
          <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
        </label>

        {erro && <p className="msg msg-erro">{erro}</p>}
        {sucesso && <p className="msg msg-sucesso">Lançamento salvo. Pode cadastrar o próximo.</p>}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar lançamento'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
            Ver lançamentos
          </button>
        </div>
      </form>
    </div>
  )
}
