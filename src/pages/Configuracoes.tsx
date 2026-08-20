import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useLookups } from '../lib/useLookups'
import type { Category, PaymentMethod, Tipo } from '../lib/types'

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

  const [editandoCatId, setEditandoCatId] = useState<string | null>(null)
  const [editCatNome, setEditCatNome] = useState('')
  const [editCatTipo, setEditCatTipo] = useState<Tipo>('despesa')

  const [editandoMeioId, setEditandoMeioId] = useState<string | null>(null)
  const [editMeioNome, setEditMeioNome] = useState('')

  const [catsSelecionadas, setCatsSelecionadas] = useState<Set<string>>(new Set())
  const [meiosSelecionados, setMeiosSelecionados] = useState<Set<string>>(new Set())

  const [aviso, setAviso] = useState<string | null>(null)

  // ---------- Categorias: criar ----------
  async function addCategoria(e: FormEvent) {
    e.preventDefault()
    if (!novaCatNome.trim()) return
    await supabase.from('categories').insert({ nome: novaCatNome.trim(), tipo: novaCatTipo })
    setNovaCatNome('')
    reload()
  }

  // ---------- Categorias: editar ----------
  function iniciarEdicaoCategoria(c: Category) {
    setEditandoCatId(c.id)
    setEditCatNome(c.nome)
    setEditCatTipo(c.tipo)
  }

  async function salvarEdicaoCategoria(id: string) {
    if (!editCatNome.trim()) return
    await supabase.from('categories').update({ nome: editCatNome.trim(), tipo: editCatTipo }).eq('id', id)
    setEditandoCatId(null)
    reload()
  }

  // ---------- Meios: editar ----------
  function iniciarEdicaoMeio(p: PaymentMethod) {
    setEditandoMeioId(p.id)
    setEditMeioNome(p.nome)
  }

  async function salvarEdicaoMeio(id: string) {
    if (!editMeioNome.trim()) return
    await supabase.from('payment_methods').update({ nome: editMeioNome.trim() }).eq('id', id)
    setEditandoMeioId(null)
    reload()
  }

  // ---------- Meios: criar ----------
  async function addMeio(e: FormEvent) {
    e.preventDefault()
    if (!novoMeioNome.trim()) return
    await supabase.from('payment_methods').insert({ nome: novoMeioNome.trim() })
    setNovoMeioNome('')
    reload()
  }

  // ---------- Exclusão protegida (checa uso antes) ----------
  async function idsEmUsoCategoria(ids: string[]): Promise<Set<string>> {
    const { data } = await supabase.from('transactions').select('categoria_id').in('categoria_id', ids)
    return new Set((data ?? []).map((r) => r.categoria_id as string))
  }

  async function idsEmUsoMeio(ids: string[]): Promise<Set<string>> {
    const { data } = await supabase.from('transactions').select('meio_pagamento_id').in('meio_pagamento_id', ids)
    return new Set((data ?? []).map((r) => r.meio_pagamento_id as string))
  }

  async function excluirCategorias(ids: string[]) {
    if (ids.length === 0) return
    const emUso = await idsEmUsoCategoria(ids)
    const podeExcluir = ids.filter((id) => !emUso.has(id))
    const bloqueadas = ids.filter((id) => emUso.has(id))

    if (podeExcluir.length > 0) {
      if (!confirm(`Excluir ${podeExcluir.length} categoria(s)?`)) return
      await supabase.from('categories').delete().in('id', podeExcluir)
    }

    if (bloqueadas.length > 0) {
      const nomes = categories.filter((c) => bloqueadas.includes(c.id)).map((c) => c.nome).join(', ')
      setAviso(`Não foi possível excluir: ${nomes} — em uso em algum lançamento. As demais foram excluídas.`)
    } else {
      setAviso(null)
    }

    setCatsSelecionadas(new Set())
    reload()
  }

  async function excluirMeios(ids: string[]) {
    if (ids.length === 0) return
    const emUso = await idsEmUsoMeio(ids)
    const podeExcluir = ids.filter((id) => !emUso.has(id))
    const bloqueadas = ids.filter((id) => emUso.has(id))

    if (podeExcluir.length > 0) {
      if (!confirm(`Excluir ${podeExcluir.length} meio(s) de pagamento?`)) return
      await supabase.from('payment_methods').delete().in('id', podeExcluir)
    }

    if (bloqueadas.length > 0) {
      const nomes = paymentMethods.filter((p) => bloqueadas.includes(p.id)).map((p) => p.nome).join(', ')
      setAviso(`Não foi possível excluir: ${nomes} — em uso em algum lançamento. Os demais foram excluídos.`)
    } else {
      setAviso(null)
    }

    setMeiosSelecionados(new Set())
    reload()
  }

  function toggleCatSelecionada(id: string) {
    setCatsSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleMeioSelecionado(id: string) {
    setMeiosSelecionados((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
    <div>
      {aviso && <p className="msg msg-erro" style={{ marginBottom: 16 }}>{aviso}</p>}

      <div className="config-grid">
        <div className="ledger-card">
          <div className="config-header">
            <h2 className="form-title">Categorias</h2>
            {catsSelecionadas.size > 0 && (
              <button className="btn btn-ghost" onClick={() => excluirCategorias([...catsSelecionadas])}>
                Excluir selecionadas ({catsSelecionadas.size})
              </button>
            )}
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
                  {editandoCatId === c.id ? (
                    <>
                      <input
                        className="edit-inline-input"
                        value={editCatNome}
                        onChange={(e) => setEditCatNome(e.target.value)}
                        autoFocus
                      />
                      <select value={editCatTipo} onChange={(e) => setEditCatTipo(e.target.value as Tipo)}>
                        <option value="despesa">Despesa</option>
                        <option value="receita">Receita</option>
                      </select>
                      <button className="icon-btn" onClick={() => salvarEdicaoCategoria(c.id)} title="Salvar">✓</button>
                      <button className="icon-btn" onClick={() => setEditandoCatId(null)} title="Cancelar">✕</button>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={catsSelecionadas.has(c.id)}
                        onChange={() => toggleCatSelecionada(c.id)}
                      />
                      <span>{c.nome}</span>
                      <span className={'tag ' + (c.tipo === 'despesa' ? 'tag-despesa' : 'tag-receita')}>{c.tipo}</span>
                      <button className="icon-btn" onClick={() => iniciarEdicaoCategoria(c)} title="Editar">✎</button>
                      <button className="icon-btn icon-btn-danger" onClick={() => excluirCategorias([c.id])} title="Excluir">✕</button>
                    </>
                  )}
                </li>
              ))}
              {categories.length === 0 && <p className="empty-state">Nenhuma categoria ainda.</p>}
            </ul>
          )}
        </div>

        <div className="ledger-card">
          <div className="config-header">
            <h2 className="form-title">Meios de pagamento</h2>
            {meiosSelecionados.size > 0 && (
              <button className="btn btn-ghost" onClick={() => excluirMeios([...meiosSelecionados])}>
                Excluir selecionados ({meiosSelecionados.size})
              </button>
            )}
          </div>

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
                  {editandoMeioId === p.id ? (
                    <>
                      <input
                        className="edit-inline-input"
                        value={editMeioNome}
                        onChange={(e) => setEditMeioNome(e.target.value)}
                        autoFocus
                      />
                      <button className="icon-btn" onClick={() => salvarEdicaoMeio(p.id)} title="Salvar">✓</button>
                      <button className="icon-btn" onClick={() => setEditandoMeioId(null)} title="Cancelar">✕</button>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        checked={meiosSelecionados.has(p.id)}
                        onChange={() => toggleMeioSelecionado(p.id)}
                      />
                      <span>{p.nome}</span>
                      <button className="icon-btn" onClick={() => iniciarEdicaoMeio(p)} title="Editar">✎</button>
                      <button className="icon-btn icon-btn-danger" onClick={() => excluirMeios([p.id])} title="Excluir">✕</button>
                    </>
                  )}
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
    </div>
  )
}