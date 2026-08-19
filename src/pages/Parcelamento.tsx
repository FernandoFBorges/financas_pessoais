import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useLookups } from '../lib/useLookups'
import { MESES } from '../lib/types'

export default function Parcelamento() {
  const navigate = useNavigate()
  const { categories, paymentMethods } = useLookups()
  const hoje = new Date()

  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState('')
  const [meioId, setMeioId] = useState('')
  const [valorParcela, setValorParcela] = useState('')
  const [parcelaInicial, setParcelaInicial] = useState(1)
  const [parcelaTotal, setParcelaTotal] = useState(2)
  const [competenciaMesInicial, setCompetenciaMesInicial] = useState(hoje.getMonth() + 1)
  const [competenciaAnoInicial, setCompetenciaAnoInicial] = useState(hoje.getFullYear())
  const [dataLancamento, setDataLancamento] = useState(hoje.toISOString().slice(0, 10))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<string | null>(null)

  const categoriasDespesa = categories.filter((c) => c.tipo === 'despesa')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (parcelaTotal < parcelaInicial) {
      setErro('O total de parcelas precisa ser maior ou igual à parcela inicial.')
      return
    }

    setSalvando(true)

    const grupoId = crypto.randomUUID()
    const registros = []
    let mesAtual = competenciaMesInicial
    let anoAtual = competenciaAnoInicial

    for (let parcela = parcelaInicial; parcela <= parcelaTotal; parcela++) {
      registros.push({
        tipo: 'despesa' as const,
        descricao,
        categoria_id: categoriaId || null,
        meio_pagamento_id: meioId || null,
        valor: Number(valorParcela.replace(',', '.')),
        data_lancamento: parcela === parcelaInicial ? dataLancamento : `${anoAtual}-${String(mesAtual).padStart(2, '0')}-01`,
        competencia_mes: mesAtual,
        competencia_ano: anoAtual,
        pago: false,
        parcela_atual: parcela,
        parcela_total: parcelaTotal,
        grupo_parcelamento_id: grupoId,
        recorrente: false,
      })

      if (mesAtual === 12) {
        mesAtual = 1
        anoAtual += 1
      } else {
        mesAtual += 1
      }
    }

    const { error } = await supabase.from('transactions').insert(registros)
    setSalvando(false)

    if (error) {
      setErro(error.message)
      return
    }

    setSucesso(`${registros.length} parcela(s) criada(s), de ${parcelaInicial}/${parcelaTotal} até ${parcelaTotal}/${parcelaTotal}.`)
    setDescricao('')
    setValorParcela('')
  }

  return (
    <div className="ledger-card form-card">
      <h2 className="form-title">Nova despesa parcelada</h2>
      <p className="field-hint">
        Cria de uma vez todos os registros das parcelas restantes, um por competência, já ligados entre si.
      </p>

      <form onSubmit={handleSubmit}>
        <label className="field">
          <span>Descrição</span>
          <input required value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Financiamento carro" />
        </label>

        <div className="field-row">
          <label className="field">
            <span>Valor de cada parcela (R$)</span>
            <input required inputMode="decimal" value={valorParcela} onChange={(e) => setValorParcela(e.target.value)} placeholder="0,00" />
          </label>

          <label className="field">
            <span>Categoria</span>
            <select value={categoriaId} onChange={(e) => setCategoriaId(e.target.value)}>
              <option value="">— selecione —</option>
              {categoriasDespesa.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span>Meio de pagamento</span>
          <select value={meioId} onChange={(e) => setMeioId(e.target.value)}>
            <option value="">— selecione —</option>
            {paymentMethods.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
        </label>

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

        <p className="field-hint">
          Ex: se a compra já nasceu em 3/12 (parcela 3 de 12), use parcela inicial 3 e total 12 —
          o app cria só as parcelas de 3 a 12, uma por competência a partir da data abaixo.
        </p>

        <div className="field-row">
          <label className="field">
            <span>Data do lançamento (1ª parcela criada)</span>
            <input type="date" required value={dataLancamento} onChange={(e) => setDataLancamento(e.target.value)} />
          </label>
        </div>

        <div className="field-row">
          <label className="field">
            <span>Competência inicial — mês</span>
            <select value={competenciaMesInicial} onChange={(e) => setCompetenciaMesInicial(Number(e.target.value))}>
              {MESES.map((m, i) => (
                <option key={m} value={i + 1}>{m}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Competência inicial — ano</span>
            <input type="number" value={competenciaAnoInicial} onChange={(e) => setCompetenciaAnoInicial(Number(e.target.value))} />
          </label>
        </div>

        {erro && <p className="msg msg-erro">{erro}</p>}
        {sucesso && <p className="msg msg-sucesso">{sucesso}</p>}

        <div className="form-actions">
          <button className="btn btn-primary" type="submit" disabled={salvando}>
            {salvando ? 'Criando parcelas…' : 'Criar parcelas'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/')}>
            Ver lançamentos
          </button>
        </div>
      </form>
    </div>
  )
}
