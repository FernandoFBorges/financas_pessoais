import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import { MESES, type Tipo } from '../lib/types'

interface DuplicadoState {
  duplicado?: boolean
  tipo?: Tipo
  descricao?: string
  categoria_id?: string | null
  meio_pagamento_id?: string | null
  valor?: number
  competencia_mes?: number
  competencia_ano?: number
  observacao?: string | null
}

export default function NovaTransacao() {
  const navigate = useNavigate()
  const location = useLocation()
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()

  const preenchido = (location.state as DuplicadoState | null) ?? null
  const veioDuplicado = preenchido?.duplicado === true

  const [tipo, setTipo] = useState<Tipo>(preenchido?.tipo ?? 'despesa')
  const [descricao, setDescricao] = useState(preenchido?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(preenchido?.categoria_id ?? '')
  const [meioId, setMeioId] = useState(preenchido?.meio_pagamento_id ?? '')
  const [valor, setValor] = useState(preenchido?.valor != null ? String(preenchido.valor) : '')
  const [valorEfetivo, setValorEfetivo] = useState('')
  const [dataLancamento, setDataLancamento] = useState(new Date().toISOString().slice(0, 10))
  const [competenciaMes, setCompetenciaMes] = useState(preenchido?.competencia_mes ?? mes)
  const [competenciaAno, setCompetenciaAno] = useState(preenchido?.competencia_ano ?? ano)
  const [pago, setPago] = useState(false)
  const [recorrente, setRecorrente] = useState(veioDuplicado)
  const [observacao, setObservacao] = useState(preenchido?.observacao ?? '')
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

    setSucesso(true)
    setDescricao('')
    setValor('')
    setValorEfetivo('')
    setObservacao('')
    // Limpa o estado de duplicação depois de salvar, pra próximo lançamento começar do zero
    navigate('.', { replace: true, state: null })
  }

  return (
    <div className="ledger-card form-card">
      <h2 className="form-title">Novo lançamento</h2>

      {veioDuplicado && (
        <p className="msg msg-aviso">
          Lançamento duplicado a partir de outro — confira os dados abaixo (a competência já foi
          avançada pro mês seguinte) e ajuste o que precisar antes de salvar.
        </p>
      )}

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
            <span>Valor previsto (R$)</span>
            <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
          </label>

          <label className="field">
            <span>Valor efetivo (R$) — opcional</span>
            <input inputMode="decimal" value={valorEfetivo} onChange={(e) => setValorEfetivo(e.target.value)} placeholder="deixe em branco se ainda não souber" />
          </label>
        </div>
        <p className="field-hint">
          Previsto é o que você planeja/espera. Efetivo é o que realmente foi pago ou recebido —
          preencha quando souber, ou deixe em branco e ajuste depois na lista de lançamentos.
        </p>

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

        <label className="field">
          <span>Data do lançamento</span>
          <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
        </label>

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
