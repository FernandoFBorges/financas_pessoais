import { useEffect, useMemo, useState } from 'react'
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { supabase } from '../lib/supabase'
import { fetchAllRows } from '../lib/fetchAllTransactions'
import { useLookups } from '../lib/useLookups'
import { useCompetencia } from '../context/CompetenciaContext'
import { valorEfetivoRealizado, formatBRL, MESES } from '../lib/types'

interface LinhaTransacao {
  tipo: 'despesa' | 'receita'
  valor: number
  valor_efetivo: number | null
  competencia_mes: number
  competencia_ano: number
  categoria_id: string | null
  recorrente: boolean
  grupo_parcelamento_id: string | null
}

interface LinhaReserva {
  tipo: 'deposito' | 'resgate'
  valor: number
  competencia_mes: number
  competencia_ano: number
}

const CORES_CATEGORIAS = [
  '#2563EB', '#E11D48', '#16A34A', '#B45309', '#7C3AED',
  '#0891B2', '#DB2777', '#65A30D', '#EA580C', '#4F46E5',
]

function seq(ano: number, mes: number) {
  return ano * 12 + mes
}

function subtrairMeses(mes: number, ano: number, n: number) {
  const total = ano * 12 + (mes - 1) - n
  return { mes: (((total % 12) + 12) % 12) + 1, ano: Math.floor(total / 12) }
}

function competenciaLabel(mes: number, ano: number) {
  return `${MESES[mes - 1].slice(0, 3)}/${String(ano).slice(2)}`
}

export default function Gerencial() {
  const { mes: mesAtual, ano: anoAtual } = useCompetencia()
  const { categories } = useLookups()

  const padrao = subtrairMeses(mesAtual, anoAtual, 5)
  const [mesInicio, setMesInicio] = useState(padrao.mes)
  const [anoInicio, setAnoInicio] = useState(padrao.ano)
  const [mesFim, setMesFim] = useState(mesAtual)
  const [anoFim, setAnoFim] = useState(anoAtual)

  const [transacoes, setTransacoes] = useState<LinhaTransacao[]>([])
  const [reserva, setReserva] = useState<LinhaReserva[]>([])
  const [saldoInicialGeral, setSaldoInicialGeral] = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    async function carregar() {
      setCarregando(true)
      const [dadosTransacoes, dadosReserva, dadosSettings] = await Promise.all([
        fetchAllRows(
          'transactions',
          'tipo, valor, valor_efetivo, competencia_mes, competencia_ano, categoria_id, recorrente, grupo_parcelamento_id'
        ),
        fetchAllRows('reserva_movimentos', 'tipo, valor, competencia_mes, competencia_ano'),
        supabase.from('user_settings').select('saldo_inicial').maybeSingle(),
      ])
      setTransacoes(dadosTransacoes as unknown as LinhaTransacao[])
      setReserva(dadosReserva as unknown as LinhaReserva[])
      setSaldoInicialGeral(
        dadosSettings.data?.saldo_inicial != null ? Number(dadosSettings.data.saldo_inicial) : 0
      )
      setCarregando(false)
    }
    carregar()
  }, [])

  const nomeCategoria = (id: string | null) => categories.find((c) => c.id === id)?.nome ?? 'Sem categoria'

  const inicioSeq = seq(anoInicio, mesInicio)
  const fimSeq = seq(anoFim, mesFim)
  const intervaloValido = inicioSeq <= fimSeq

  const meses = useMemo(() => {
    if (!intervaloValido) return []
    const lista: { mes: number; ano: number }[] = []
    let atual = { mes: mesInicio, ano: anoInicio }
    while (seq(atual.ano, atual.mes) <= fimSeq) {
      lista.push(atual)
      atual = atual.mes === 12 ? { mes: 1, ano: atual.ano + 1 } : { mes: atual.mes + 1, ano: atual.ano }
    }
    return lista
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mesInicio, anoInicio, mesFim, anoFim, intervaloValido])

  // ---------- Gráfico 1: Receita x Despesa (efetivo) por competência ----------
  // ---------- Gráfico 3: Fixas x Variáveis ----------
  // ---------- Gráfico novo: % da renda comprometida com despesas ----------
  const dadosMensais = useMemo(() => {
    return meses.map(({ mes, ano }) => {
      const doMes = transacoes.filter((t) => t.competencia_mes === mes && t.competencia_ano === ano)
      const receitas = doMes.filter((t) => t.tipo === 'receita')
      const despesas = doMes.filter((t) => t.tipo === 'despesa')

      const receitaEfetivo = receitas.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const despesaEfetivo = despesas.reduce((s, t) => s + valorEfetivoRealizado(t), 0)

      const fixas = despesas.filter((t) => t.recorrente || t.grupo_parcelamento_id != null)
      const variaveis = despesas.filter((t) => !t.recorrente && !t.grupo_parcelamento_id)
      const despesaFixaEfetivo = fixas.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const despesaVariavelEfetivo = variaveis.reduce((s, t) => s + valorEfetivoRealizado(t), 0)

      const comprometimento = receitaEfetivo > 0 ? (despesaEfetivo / receitaEfetivo) * 100 : null

      // Salário x PJ x Outras, em proporção da receita do mês
      const salarioEfetivo = receitas
        .filter((t) => nomeCategoria(t.categoria_id) === 'Salário')
        .reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const pjEfetivo = receitas
        .filter((t) => nomeCategoria(t.categoria_id) === 'PJ')
        .reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const outrasEfetivo = receitaEfetivo - salarioEfetivo - pjEfetivo

      return {
        competencia: competenciaLabel(mes, ano),
        receita: receitaEfetivo,
        despesa: despesaEfetivo,
        fixas: despesaFixaEfetivo,
        variaveis: despesaVariavelEfetivo,
        comprometimento,
        salarioPct: receitaEfetivo > 0 ? (salarioEfetivo / receitaEfetivo) * 100 : 0,
        pjPct: receitaEfetivo > 0 ? (pjEfetivo / receitaEfetivo) * 100 : 0,
        outrasPct: receitaEfetivo > 0 ? (outrasEfetivo / receitaEfetivo) * 100 : 0,
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meses, transacoes, categories])

  // ---------- Gráfico 2: Saldo acumulado — Geral e Reserva juntos ----------
  const dadosSaldo = useMemo(() => {
    if (meses.length === 0) return []

    const netAntes = transacoes
      .filter((t) => seq(t.competencia_ano, t.competencia_mes) < inicioSeq)
      .reduce((acc, t) => {
        const ef = valorEfetivoRealizado(t)
        return acc + (t.tipo === 'receita' ? ef : -ef)
      }, 0)

    const netReservaAntes = reserva
      .filter((r) => seq(r.competencia_ano, r.competencia_mes) < inicioSeq)
      .reduce((acc, r) => acc + (r.tipo === 'deposito' ? Number(r.valor) : -Number(r.valor)), 0)

    let saldoCorrente = saldoInicialGeral + netAntes - netReservaAntes
    let saldoReservaCorrente = netReservaAntes

    return meses.map(({ mes, ano }) => {
      const doMes = transacoes.filter((t) => t.competencia_mes === mes && t.competencia_ano === ano)
      const receitaEfetivo = doMes.filter((t) => t.tipo === 'receita').reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const despesaEfetivo = doMes.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + valorEfetivoRealizado(t), 0)
      const reservaDoMes = reserva.filter((r) => r.competencia_mes === mes && r.competencia_ano === ano)
      const netReservaMes = reservaDoMes.reduce(
        (acc, r) => acc + (r.tipo === 'deposito' ? Number(r.valor) : -Number(r.valor)),
        0
      )
      saldoCorrente = saldoCorrente + receitaEfetivo - despesaEfetivo - netReservaMes
      saldoReservaCorrente += netReservaMes
      return {
        competencia: competenciaLabel(mes, ano),
        saldoGeral: saldoCorrente,
        saldoReserva: saldoReservaCorrente,
      }
    })
  }, [meses, transacoes, reserva, saldoInicialGeral, inicioSeq])

  // ---------- Gráfico 4: Despesas por categoria no período (donut) ----------
  const dadosCategorias = useMemo(() => {
    const despesasNoPeriodo = transacoes.filter(
      (t) =>
        t.tipo === 'despesa' &&
        seq(t.competencia_ano, t.competencia_mes) >= inicioSeq &&
        seq(t.competencia_ano, t.competencia_mes) <= fimSeq
    )
    const porCategoria = new Map<string, number>()
    for (const t of despesasNoPeriodo) {
      const nome = nomeCategoria(t.categoria_id)
      porCategoria.set(nome, (porCategoria.get(nome) ?? 0) + valorEfetivoRealizado(t))
    }
    const lista = [...porCategoria.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    const TOP = 8
    if (lista.length <= TOP) return lista
    const principais = lista.slice(0, TOP)
    const outros = lista.slice(TOP).reduce((s, c) => s + c.valor, 0)
    return [...principais, { nome: 'Outros', valor: outros }]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transacoes, inicioSeq, fimSeq, categories])

  const totalCategorias = dadosCategorias.reduce((s, c) => s + c.valor, 0)

  return (
    <div>
      <div className="ledger-card periodo-card">
        <h2 className="form-title">Período</h2>
        <div className="periodo-selects">
          <label className="field">
            <span>De</span>
            <span className="competencia-inline">
              <select value={mesInicio} onChange={(e) => setMesInicio(Number(e.target.value))}>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <input type="number" value={anoInicio} onChange={(e) => setAnoInicio(Number(e.target.value))} />
            </span>
          </label>
          <label className="field">
            <span>Até</span>
            <span className="competencia-inline">
              <select value={mesFim} onChange={(e) => setMesFim(Number(e.target.value))}>
                {MESES.map((m, i) => (
                  <option key={m} value={i + 1}>{m}</option>
                ))}
              </select>
              <input type="number" value={anoFim} onChange={(e) => setAnoFim(Number(e.target.value))} />
            </span>
          </label>
        </div>
        {!intervaloValido && <p className="msg msg-erro">A competência "De" precisa ser antes ou igual a "Até".</p>}
      </div>

      {carregando ? (
        <p className="empty-state">Carregando…</p>
      ) : !intervaloValido ? null : (
        <div className="gerencial-grid">
          <div className="ledger-card chart-card">
            <h3 className="chart-title">Receita x Despesa por competência</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="var(--color-receita)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="var(--color-despesa)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ledger-card chart-card">
            <h3 className="chart-title">Saldo acumulado — Geral x Reserva</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dadosSaldo}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Line type="monotone" dataKey="saldoGeral" name="Saldo geral" stroke="var(--color-primary)" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="saldoReserva" name="Reserva" stroke="var(--color-gold)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="ledger-card chart-card">
            <h3 className="chart-title">Despesas: Fixas x Variáveis</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatBRL(v)} width={80} />
                <Tooltip formatter={(v) => formatBRL(Number(v))} />
                <Legend />
                <Bar dataKey="fixas" name="Fixas" stackId="d" fill="var(--color-primary)" />
                <Bar dataKey="variaveis" name="Variáveis" stackId="d" fill="var(--color-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ledger-card chart-card">
            <h3 className="chart-title">% da renda comprometida com despesas</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={50} />
                <Tooltip formatter={(v) => (v == null ? 'sem receita' : `${Number(v).toFixed(0)}%`)} />
                <Line
                  type="monotone"
                  dataKey="comprometimento"
                  name="% comprometido"
                  stroke="var(--color-despesa)"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="ledger-card chart-card">
            <h3 className="chart-title">Receitas: Salário x PJ (% do mês)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={dadosMensais}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="competencia" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} width={50} domain={[0, 100]} />
                <Tooltip formatter={(v) => `${Number(v).toFixed(0)}%`} />
                <Legend />
                <Bar dataKey="salarioPct" name="Salário" stackId="r" fill="var(--color-primary)" />
                <Bar dataKey="pjPct" name="PJ" stackId="r" fill="var(--color-receita)" />
                <Bar dataKey="outrasPct" name="Outras" stackId="r" fill="var(--color-gold)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="ledger-card chart-card">
            <h3 className="chart-title">Despesas por categoria no período</h3>
            {dadosCategorias.length === 0 ? (
              <p className="empty-state">Nada lançado nesse período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={dadosCategorias}
                    dataKey="valor"
                    nameKey="nome"
                    innerRadius={60}
                    outerRadius={95}
                    paddingAngle={2}
                  >
                    {dadosCategorias.map((_, i) => (
                      <Cell key={i} fill={CORES_CATEGORIAS[i % CORES_CATEGORIAS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v, nome) => [
                      formatBRL(Number(v)) + ` (${totalCategorias > 0 ? ((Number(v) / totalCategorias) * 100).toFixed(0) : 0}%)`,
                      String(nome),
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
