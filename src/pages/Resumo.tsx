import { useCallback, useEffect, useRef, useState, type SyntheticEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useCompetencia } from '../context/CompetenciaContext'
import { MESES } from '../lib/types'

interface Previa {
  assunto: string
  para: string
  html: string
}

interface RespostaEnvio {
  ok: boolean
  para: string
}

// Quando a função responde com erro (4xx/5xx), o supabase-js devolve um erro cujo
// "context" é a resposta HTTP — dali sai a mensagem em português que a própria
// função escreveu (ex.: "RESEND_API_KEY não está configurada…").
async function mensagemDeErro(erro: unknown): Promise<string> {
  const contexto = (erro as { context?: Response }).context
  if (contexto && typeof contexto.json === 'function') {
    try {
      const corpo = await contexto.json()
      if (typeof corpo?.erro === 'string') return corpo.erro
      if (typeof corpo?.message === 'string' && /not.?found/i.test(corpo.message)) {
        return 'A função "enviar-resumo" ainda não foi publicada no Supabase.'
      }
    } catch {
      // resposta sem JSON — cai na mensagem genérica abaixo
    }
  }
  const mensagem = (erro as { message?: string }).message
  return mensagem ? `Não foi possível falar com a função: ${mensagem}` : 'Erro desconhecido.'
}

export default function Resumo() {
  const { mes, ano } = useCompetencia()

  const [previa, setPrevia] = useState<Previa | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [altura, setAltura] = useState(900)
  // Só a chamada mais recente pode aplicar o resultado — evita que uma resposta
  // lenta de outro mês sobrescreva a prévia do mês que está na tela.
  const pedidoAtualRef = useRef(0)

  const carregarPrevia = useCallback(async () => {
    const meuPedido = ++pedidoAtualRef.current
    setCarregando(true)
    setErro(null)
    setResultado(null)
    setPrevia(null)

    const { data, error } = await supabase.functions.invoke<Previa>('enviar-resumo', {
      body: { ano, mes, acao: 'previa' },
    })
    if (meuPedido !== pedidoAtualRef.current) return

    if (error || !data) {
      setErro(error ? await mensagemDeErro(error) : 'A função não devolveu nada.')
      setCarregando(false)
      return
    }
    setPrevia(data)
    setCarregando(false)
  }, [ano, mes])

  useEffect(() => {
    // Busca ao trocar de competência (ou abrir a tela) — sincronização com o
    // Supabase, não um cálculo derivável durante o render.
    // oxlint-disable-next-line react/set-state-in-effect
    carregarPrevia()
  }, [carregarPrevia])

  async function enviar() {
    setEnviando(true)
    setErro(null)
    setResultado(null)
    const { data, error } = await supabase.functions.invoke<RespostaEnvio>('enviar-resumo', {
      body: { ano, mes, acao: 'enviar' },
    })
    if (error || !data?.ok) {
      setErro(error ? await mensagemDeErro(error) : 'O envio não foi confirmado.')
    } else {
      setResultado(`Resumo de ${MESES[mes - 1]}/${ano} enviado para ${data.para}.`)
    }
    setEnviando(false)
  }

  function ajustarAltura(e: SyntheticEvent<HTMLIFrameElement>) {
    const doc = e.currentTarget.contentDocument
    if (doc) setAltura(doc.documentElement.scrollHeight + 8)
  }

  return (
    <div className="resumo-page">
      <div className="ledger-card resumo-card">
        <div className="resumo-header">
          <div>
            <h2 className="form-title">Resumo mensal por e-mail</h2>
            <p className="resumo-sub">
              Competência {MESES[mes - 1]}/{ano}. Para outro mês, troque no seletor no topo da tela.
            </p>
          </div>
          <div className="resumo-actions">
            <button className="btn btn-ghost" onClick={carregarPrevia} disabled={carregando || enviando}>
              ↻ Atualizar prévia
            </button>
            <button className="btn btn-primary" onClick={enviar} disabled={!previa || carregando || enviando}>
              {enviando ? 'Enviando…' : previa ? `✉ Enviar para ${previa.para}` : '✉ Enviar'}
            </button>
          </div>
        </div>

        {resultado && <p className="msg msg-sucesso">{resultado}</p>}
        {erro && <p className="msg msg-erro">{erro}</p>}
      </div>

      {carregando && <p className="empty-state">Montando o resumo…</p>}

      {previa && !carregando && (
        <div className="resumo-frame-wrap">
          <iframe
            title={`Prévia do e-mail: ${previa.assunto}`}
            className="resumo-frame"
            srcDoc={previa.html}
            // sem scripts: o conteúdo é só HTML estático gerado pela função
            sandbox="allow-same-origin"
            style={{ height: altura }}
            onLoad={ajustarAltura}
          />
        </div>
      )}
    </div>
  )
}
