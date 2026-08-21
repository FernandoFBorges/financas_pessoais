import { useMemo, useState } from 'react'
import { formatBRL, type Category, type PaymentMethod, type Tipo, type Transaction } from '../lib/types'

type Agrupamento = 'nenhum' | 'categoria' | 'meio' | 'pago'
type FiltroPago = 'todos' | 'pago' | 'pendente'

interface Props {
  tipo: Tipo
  titulo: string
  items: Transaction[]
  categories: Category[]
  paymentMethods: PaymentMethod[]
  onNovo: () => void
  onDuplicar: (t: Transaction) => void
  onTogglePago: (t: Transaction) => void
  onSalvarEfetivo: (t: Transaction, valor: number | null) => void
  onExcluir: (t: Transaction) => void
}

function valorEfetivoRealizado(t: Transaction) {
  if (t.valor_efetivo != null) return Number(t.valor_efetivo)
  if (t.pago) return Number(t.valor)
  return 0
}

export default function TransactionColumn({
  tipo, titulo, items, categories, paymentMethods,
  onNovo, onDuplicar, onTogglePago, onSalvarEfetivo, onExcluir,
}: Props) {
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroMeio, setFiltroMeio] = useState('')
  const [filtroPago, setFiltroPago] = useState<FiltroPago>('todos')
  const [agrupamento, setAgrupamento] = useState<Agrupamento>('nenhum')
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [efetivoInput, setEfetivoInput] = useState('')

  const categoriasDoTipo = categories.filter((c) => c.tipo === tipo)
  const nomeCategoria = (id: string | null) => categories.find((c) => c.id === id)?.nome ?? '—'
  const nomeMeio = (id: string | null) => paymentMethods.find((p) => p.id === id)?.nome ?? '—'

  const filtrados = items.filter((t) => {
    if (filtroCategoria && t.categoria_id !== filtroCategoria) return false
    if (filtroMeio && t.meio_pagamento_id !== filtroMeio) return false
    if (filtroPago === 'pago' && !t.pago) return false
    if (filtroPago === 'pendente' && t.pago) return false
    return true
  })

  const totalPrevisto = filtrados.reduce((s, t) => s + Number(t.valor), 0)
  const totalEfetivo = filtrados.reduce((s, t) => s + valorEfetivoRealizado(t), 0)

  const grupos = useMemo(() => {
    if (agrupamento === 'nenhum') {
      return [{ chave: 'flat', label: '', itens: filtrados }]
    }
    const map = new Map<string, Transaction[]>()
    for (const t of filtrados) {
      let chave: string
      if (agrupamento === 'categoria') chave = t.categoria_id ?? '__sem__'
      else if (agrupamento === 'meio') chave = t.meio_pagamento_id ?? '__sem__'
      else chave = t.pago ? 'pago' : 'pendente'

      if (!map.has(chave)) map.set(chave, [])
      map.get(chave)!.push(t)
    }

    function labelDe(chave: string) {
      if (agrupamento === 'categoria') return chave === '__sem__' ? 'Sem categoria' : nomeCategoria(chave)
      if (agrupamento === 'meio') return chave === '__sem__' ? 'Sem meio definido' : nomeMeio(chave)
      return chave === 'pago' ? 'Pago' : 'Pendente'
    }

    return [...map.entries()]
      .map(([chave, itens]) => ({ chave, label: labelDe(chave), itens }))
      .sort((a, b) => {
        const totalA = a.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
        const totalB = b.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0)
        return totalB - totalA
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtrados, agrupamento])

  function iniciarEdicao(t: Transaction) {
    setEditandoId(t.id)
    setEfetivoInput(t.valor_efetivo != null ? String(t.valor_efetivo) : '')
  }

  function confirmarEdicao(t: Transaction) {
    const valor = efetivoInput.trim() === '' ? null : Number(efetivoInput.replace(',', '.'))
    onSalvarEfetivo(t, valor)
    setEditandoId(null)
  }

  return (
    <div className={'ledger-card column-card column-' + tipo}>
      <div className="column-header">
        <div>
          <h2 className="form-title">{titulo}</h2>
          <p className="column-summary">
            <span className="column-summary-efetivo">{formatBRL(totalEfetivo)}</span>
            <span className="column-summary-previsto">previsto {formatBRL(totalPrevisto)}</span>
          </p>
        </div>
        <button className="btn btn-primary" onClick={onNovo}>
          + Nova {tipo === 'despesa' ? 'despesa' : 'receita'}
        </button>
      </div>

      <div className="column-filters">
        <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas categorias</option>
          {categoriasDoTipo.map((c) => (
            <option key={c.id} value={c.id}>{c.nome}</option>
          ))}
        </select>
        <select value={filtroMeio} onChange={(e) => setFiltroMeio(e.target.value)}>
          <option value="">Todos meios</option>
          {paymentMethods.map((p) => (
            <option key={p.id} value={p.id}>{p.nome}</option>
          ))}
        </select>
        <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value as FiltroPago)}>
          <option value="todos">Pago e pendente</option>
          <option value="pago">Só pagos</option>
          <option value="pendente">Só pendentes</option>
        </select>
        <select value={agrupamento} onChange={(e) => setAgrupamento(e.target.value as Agrupamento)}>
          <option value="nenhum">Sem agrupamento</option>
          <option value="categoria">Agrupar por categoria</option>
          <option value="meio">Agrupar por meio</option>
          <option value="pago">Agrupar por status</option>
        </select>
      </div>

      {filtrados.length === 0 ? (
        <p className="empty-state">Nada por aqui com esse filtro.</p>
      ) : (
        <div className="column-groups">
          {grupos.map((g) => (
            <div key={g.chave} className="column-group">
              {agrupamento !== 'nenhum' && (
                <div className="group-header">
                  <span>{g.label}</span>
                  <span className="group-header-totais">
                    <span className="mono">{formatBRL(g.itens.reduce((s, t) => s + valorEfetivoRealizado(t), 0))}</span>
                    <span className="mono group-previsto">
                      prev. {formatBRL(g.itens.reduce((s, t) => s + Number(t.valor), 0))}
                    </span>
                  </span>
                </div>
              )}

              {g.itens.map((t) => (
                <div key={t.id} className="tx-row">
                  <div className="tx-row-main">
                    <span className="tx-descricao">
                      {t.descricao}
                      {t.parcela_atual && t.parcela_total && (
                        <span className="badge-parcela">{t.parcela_atual}/{t.parcela_total}</span>
                      )}
                      {t.recorrente && <span className="badge-recorrente">recorrente</span>}
                    </span>

                    {editandoId === t.id ? (
                      <span className="efetivo-edit">
                        <input
                          className="efetivo-input"
                          inputMode="decimal"
                          value={efetivoInput}
                          onChange={(e) => setEfetivoInput(e.target.value)}
                          placeholder="0,00"
                          autoFocus
                        />
                        <button className="icon-btn" onClick={() => confirmarEdicao(t)} title="Salvar">✓</button>
                        <button className="icon-btn" onClick={() => setEditandoId(null)} title="Cancelar">✕</button>
                      </span>
                    ) : (
                      <button
                        className="tx-valor-efetivo"
                        onClick={() => iniciarEdicao(t)}
                        title="Clique para editar o valor efetivo"
                      >
                        {t.valor_efetivo != null ? formatBRL(Number(t.valor_efetivo)) : '— definir'}
                      </button>
                    )}
                  </div>

                  <div className="tx-row-meta">
                    <span className="tx-meta-texto">
                      {nomeCategoria(t.categoria_id)} · {nomeMeio(t.meio_pagamento_id)} ·{' '}
                      {new Date(t.data_lancamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </span>
                    <span className="tx-meta-acoes">
                      <span className="tx-previsto mono">prev. {formatBRL(Number(t.valor))}</span>
                      <button
                        className={'pago-toggle' + (t.pago ? ' pago' : '')}
                        onClick={() => onTogglePago(t)}
                        title={t.pago ? 'Marcar como pendente' : 'Marcar como pago'}
                      >
                        {t.pago ? '✓' : '·'}
                      </button>
                      <button className="icon-btn" onClick={() => onDuplicar(t)} title="Duplicar para o próximo mês">⧉</button>
                      <button className="icon-btn icon-btn-danger" onClick={() => onExcluir(t)} title="Excluir">✕</button>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
