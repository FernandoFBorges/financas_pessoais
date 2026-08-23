import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { useLookups } from '../lib/useLookups'
import { MESES, type Tipo, type Transaction } from '../lib/types'

export interface PrefillData {
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
  prefill?: PrefillData | null
  editando?: Transaction | null
  onSaved: () => void
  onCancel: () => void
}

export default function TransactionForm({ tipoInicial, prefill, editando, onSaved, onCancel }: Props) {
  const { mes, ano } = useCompetencia()
  const { categories, paymentMethods } = useLookups()

  const base = editando ?? prefill ?? null

  const [tipo, setTipo] = useState<Tipo>(base?.tipo ?? tipoInicial)
  const [descricao, setDescricao] = useState(base?.descricao ?? '')
  const [categoriaId, setCategoriaId] = useState(base?.categoria_id ?? '')
  const [meioId, setMeioId] = useState(base?.meio_pagamento_id ?? '')
  const [valor, setValor] = useState(base?.valor != null ? String(base.valor) : '')
  const [valorEfetivo, setValorEfetivo] = useState(
    editando?.valor_efetivo != null ? String(editando.valor_efetivo) : ''
  )
  const [dataLancamento, setDataLancamento] = useState(
    editando?.data_lancamento ?? new Date().toISOString().slice(0, 10)
  )
  const [competenciaMes, setCompetenciaMes] = useState(base?.competencia_mes ?? mes)
  const [competenciaAno, setCompetenciaAno] = useState(base?.competencia_ano ?? ano)
  const [pago, setPago] = useState(editando?.pago ?? false)
  const [recorrente, setRecorrente] = useState(editando?.recorrente ?? !!prefill)
  const [observacao, setObservacao] = useState(base?.observacao ?? '')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Parcelamento (só disponível ao criar, não ao editar um lançamento já existente)
  const [parcelado, setParcelado] = useState(false)
  const [parcelaInicial, setParcelaInicial] = useState(1)
  const [parcelaTotal, setParcelaTotal] = useState(2)

  const categoriasFiltradas = categories.filter((c) => c.tipo === tipo)
  const modoEdicao = !!editando

  async function salvarUnico() {
    const payload = {
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
    }

    if (modoEdicao && editando) {
      return supabase.from('transactions').update(payload).eq('id', editando.id)
    }
    return supabase.from('transactions').insert(payload)
  }

  async function salvarParcelado() {
    if (parcelaTotal < parcelaInicial) {
      return { error: { message: 'O total de parcelas precisa ser maior ou igual à parcela inicial.' } }
    }

    const grupoId = crypto.randomUUID()
    const registros = []
    let mesAtual = competenciaMes
    let anoAtual = competenciaAno

    for (let parcela = parcelaInicial; parcela <= parcelaTotal; parcela++) {
      registros.push({
        tipo,
        descricao,
        categoria_id: categoriaId || null,
        meio_pagamento_id: meioId || null,
        valor: Number(valor.replace(',', '.')),
        valor_efetivo: null,
        data_lancamento:
          parcela === parcelaInicial ? dataLancamento : `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`,
        competencia_mes: mesAtual,
        competencia_ano: anoAtual,
        pago: false,
        parcela_atual: parcela,
        parcela_total: parcelaTotal,
        grupo_parcelamento_id: grupoId,
        recorrente: false,
        observacao: observacao || null,
      })

      if (mesAtual === 12) {
        mesAtual = 1
        anoAtual += 1
      } else {
        mesAtual += 1
      }
    }

    return supabase.from('transactions').insert(registros)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)

    if (modoEdicao) {
      if (!confirm('Confirma a edição deste lançamento?')) return
    }

    setSalvando(true)
    const { error } = parcelado && !modoEdicao ? await salvarParcelado() : await salvarUnico()
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    onSaved()
  }

  return (
    <form onSubmit={handleSubmit} className="modal-form">
      {prefill && (
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

      {!modoEdicao && (
        <label className="checkbox-field parcelado-toggle">
          <input type="checkbox" checked={parcelado} onChange={(e) => setParcelado(e.target.checked)} />
          <span>Este lançamento é parcelado (cria uma parcela em cada competência)</span>
        </label>
      )}

      <div className="field-row">
        <label className="field">
          <span>{parcelado && !modoEdicao ? 'Valor de cada parcela (R$)' : 'Valor previsto (R$)'}</span>
          <input required inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0,00" />
        </label>
        {!(parcelado && !modoEdicao) && (
          <label className="field">
            <span>Valor efetivo (R$) — opcional</span>
            <input inputMode="decimal" value={valorEfetivo} onChange={(e) => setValorEfetivo(e.target.value)} placeholder="deixe em branco se não souber" />
          </label>
        )}
      </div>

      {parcelado && !modoEdicao && (
        <div className="field-row">
          <label className="field">
            <span>Parcela inicial</span>
            <input type="number" min={1} required value={parcelaInicial} onChange={(e) => setParcelaInicial(Number(e.target.value))} />
          </label>
          <label className="field">
            <span>Total de parcelas</span>
            <input type="number" min={1} required value={parcelaTotal} onChange={(e) => setParcelaTotal(Number(e.target.value))} />
          </label>
        </div>
      )}
      {parcelado && !modoEdicao && (
        <p className="field-hint">
          Ex: se a compra já nasceu em 3/12, use parcela inicial 3 e total 12 — o app cria só as
          parcelas de 3 a 12, uma por competência a partir da competência abaixo.
        </p>
      )}

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
          <span>Data do lançamento{parcelado && !modoEdicao ? ' (1ª parcela)' : ''}</span>
          <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
        </label>
        <label className="field">
          <span>Competência{parcelado && !modoEdicao ? ' inicial' : ''}</span>
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

      {!(parcelado && !modoEdicao) && (
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
      )}

      <label className="field">
        <span>Observação (opcional)</span>
        <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
      </label>

      {erro && <p className="msg msg-erro">{erro}</p>}

      <div className="form-actions">
        <button className="btn btn-primary" type="submit" disabled={salvando}>
          {salvando ? 'Salvando…' : modoEdicao ? 'Salvar edição' : parcelado ? 'Criar parcelas' : 'Salvar lançamento'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
      </div>
    </form>
  )
}
