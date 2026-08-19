import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useLookups } from '../lib/useLookups'
import type { Tipo } from '../lib/types'

const CATEGORIAS_SEED: { nome: string; tipo: Tipo }[] = [
  { nome: 'Moradia', tipo: 'despesa' },
  { nome: 'Imposto', tipo: 'despesa' },
  { nome: 'Transporte', tipo: 'despesa' },
  { nome: 'Internet', tipo: 'despesa' },
  { nome: 'Casa', tipo: 'despesa' },
  { nome: 'Vestuário', tipo: 'despesa' },
  { nome: 'Presente', tipo: 'despesa' },
  { nome: 'Alimentação', tipo: 'despesa' },
  { nome: 'Saúde', tipo: 'despesa' },
  { nome: 'Educação', tipo: 'despesa' },
  { nome: 'Trabalho', tipo: 'despesa' },
  { nome: 'Salário', tipo: 'receita' },
  { nome: 'PJ', tipo: 'receita' },
  { nome: 'Rendimento', tipo: 'receita' },
]

const MEIOS_SEED = ['Pix', 'Boleto', 'Depósito Caixa', 'Nubank', 'Nubank MEI', 'Nubank Thais', 'Mercado Pago', 'Dinheiro']

export default function Configuracoes() {
  const { categories, paymentMethods, reload, loading } = useLookups()
  const [novaCatNome, setNovaCatNome] = useState('')
  const [novaCatTipo, setNovaCatTipo] = useState<Tipo>('despesa')
  const [novoMeioNome, setNovoMeioNome] = useState('')
  const [semeando, setSemeando] = useState(false)

  async function addCategoria(e: FormEvent) {
    e.preventDefault()
    if (!novaCatNome.trim()) return
    await supabase.from('categories').insert({ nome: novaCatNome.trim(), tipo: novaCatTipo })
    setNovaCatNome('')
    reload()
  }

  async function addMeio(e: FormEvent) {
    e.preventDefault()
    if (!novoMeioNome.trim()) return
    await supabase.from('payment_methods').insert({ nome: novoMeioNome.trim() })
    setNovoMeioNome('')
    reload()
  }

  async function excluirCategoria(id: string) {
    if (!confirm('Excluir esta categoria? Lançamentos que usam ela ficam sem categoria.')) return
    await supabase.from('categories').delete().eq('id', id)
    reload()
  }

  async function excluirMeio(id: string) {
    if (!confirm('Excluir este meio de pagamento?')) return
    await supabase.from('payment_methods').delete().eq('id', id)
    reload()
  }

  async function semearPadroes() {
    setSemeando(true)
    const catsFaltando = CATEGORIAS_SEED.filter(
      (s) => !categories.some((c) => c.nome === s.nome && c.tipo === s.tipo)
    )
    const meiosFaltando = MEIOS_SEED.filter((m) => !paymentMethods.some((p) => p.nome === m))

    if (catsFaltando.length) await supabase.from('categories').insert(catsFaltando)
    if (meiosFaltando.length) await supabase.from('payment_methods').insert(meiosFaltando.map((nome) => ({ nome })))

    await reload()
    setSemeando(false)
  }

  return (
    <div className="config-grid">
      <div className="ledger-card">
        <div className="config-header">
          <h2 className="form-title">Categorias</h2>
        </div>

        <form className="inline-form" onSubmit={addCategoria}>
          <input
            placeholder="Nome da categoria"
            value={novaCatNome}
            onChange={(e) => setNovaCatNome(e.target.value)}
          />
          <select value={novaCatTipo} onChange={(e) => setNovaCatTipo(e.target.value as Tipo)}>
            <option value="despesa">Despesa</option>
            <option value="receita">Receita</option>
          </select>
          <button className="btn btn-primary" type="submit">Adicionar</button>
        </form>

        {loading ? (
          <p className="empty-state">Carregando…</p>
        ) : (
          <ul className="simple-list">
            {categories.map((c) => (
              <li key={c.id}>
                <span>{c.nome}</span>
                <span className={'tag ' + (c.tipo === 'despesa' ? 'tag-despesa' : 'tag-receita')}>{c.tipo}</span>
                <button className="icon-btn icon-btn-danger" onClick={() => excluirCategoria(c.id)}>✕</button>
              </li>
            ))}
            {categories.length === 0 && <p className="empty-state">Nenhuma categoria ainda.</p>}
          </ul>
        )}
      </div>

      <div className="ledger-card">
        <h2 className="form-title">Meios de pagamento</h2>

        <form className="inline-form" onSubmit={addMeio}>
          <input
            placeholder="Ex: Nubank, Pix..."
            value={novoMeioNome}
            onChange={(e) => setNovoMeioNome(e.target.value)}
          />
          <button className="btn btn-primary" type="submit">Adicionar</button>
        </form>

        {loading ? (
          <p className="empty-state">Carregando…</p>
        ) : (
          <ul className="simple-list">
            {paymentMethods.map((p) => (
              <li key={p.id}>
                <span>{p.nome}</span>
                <button className="icon-btn icon-btn-danger" onClick={() => excluirMeio(p.id)}>✕</button>
              </li>
            ))}
            {paymentMethods.length === 0 && <p className="empty-state">Nenhum meio de pagamento ainda.</p>}
          </ul>
        )}

        <button className="btn btn-ghost seed-btn" onClick={semearPadroes} disabled={semeando}>
          {semeando ? 'Adicionando…' : 'Preencher com categorias/meios padrão das suas planilhas'}
        </button>
      </div>
    </div>
  )
}
