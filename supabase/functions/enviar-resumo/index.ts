// =====================================================================
// Edge Function: enviar-resumo
//
// Chamada pela tela "Resumo" do app (POST com o login do usuário):
//   { ano: 2026, mes: 10, acao: 'previa' }  -> devolve o HTML do e-mail
//   { ano: 2026, mes: 10, acao: 'enviar' }  -> envia o e-mail pelo Resend
//
// Como funciona:
//  1. Confere o login chamando /auth/v1/user com o token que veio na
//     requisição. Token inválido = 401. Por isso essa função NÃO depende
//     da verificação de JWT da plataforma (pode ficar desligada).
//  2. Chama a função SQL resumo_mensal COM O TOKEN DO USUÁRIO, então o RLS
//     do banco continua valendo — a função nunca usa a chave de serviço.
//  3. Monta o e-mail e, no modo 'enviar', manda SÓ para o e-mail da própria
//     conta logada (não existe campo "destinatário": ninguém consegue usar
//     essa função para escrever para terceiros).
//
// Segredos (Supabase > Edge Functions > Secrets):
//   RESEND_API_KEY   obrigatório para enviar (a prévia funciona sem ele)
//   RESEND_FROM      opcional. Padrão: "Livro Caixa <onboarding@resend.dev>"
// SUPABASE_URL e SUPABASE_ANON_KEY já existem automaticamente na função.
// =====================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

interface ItemParcela {
  descricao: string
  parcela_atual: number
  parcela_total: number
  valor: number
}

interface GrupoSaida {
  chave: 'recorrentes' | 'parceladas' | 'variaveis'
  qtd: number
  valor: number
  pct_despesas: number | null
  pct_salario: number | null
  pct_renda: number | null
  // opcionais: só existem depois de rodar a versão nova da função SQL
  qtd_pagas?: number
  valor_previsto?: number
  prev_pct_despesas?: number | null
  prev_pct_salario?: number | null
  prev_pct_renda?: number | null
}

interface Resumo {
  ano: number
  mes: number
  entradas: {
    salario: number
    outras: number
    renda: number
    emprestimo: number
    total_com_emprestimo: number
    salario_previsto?: number
    outras_previsto?: number
    renda_previsto?: number
    emprestimo_previsto?: number
  }
  saidas: { total: number; total_previsto?: number; grupos: GrupoSaida[] }
  parcelas: {
    finalizadas: ItemParcela[]
    terminam_proximo_mes: ItemParcela[]
    libera_no_mes_seguinte: number
    libera_dois_meses_depois: number
    // opcionais: só existem depois de rodar a versão nova da função SQL
    comecam_mes?: ItemParcela[]
    comecam_proximo_mes?: ItemParcela[]
    entra_no_mes?: number
    entra_no_mes_seguinte?: number
  }
  pendentes: { despesas: { qtd: number; valor: number }; receitas: { qtd: number; valor: number } }
  saldo: {
    inicial: number
    final: number
    reserva_total: number
    reserva_depositos: number
    reserva_resgates: number
    reserva_liquida_mes: number
  }
}

// ---------- formatação ----------

const brlFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const brl = (n: number) => brlFmt.format(Number(n))
const pct = (n: number | null) => (n == null ? '—' : Number(n).toFixed(1).replace('.', ',') + '%')

function esc(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function mesSeguinte(ano: number, mes: number) {
  return mes === 12 ? { ano: ano + 1, mes: 1 } : { ano, mes: mes + 1 }
}

const rotuloMes = (ano: number, mes: number) => `${MESES[mes - 1]}/${ano}`

const NOME_GRUPO: Record<GrupoSaida['chave'], string> = {
  recorrentes: 'Recorrentes',
  parceladas: 'Parceladas',
  variaveis: 'Variáveis',
}

// ---------- e-mail (HTML) ----------

const COR = {
  primaria: '#2563EB',
  marinho: '#1E3A8A',
  receita: '#16A34A',
  despesa: '#E11D48',
  tinta: '#0F172A',
  suave: '#64748B',
  borda: '#E2E8F0',
  fundo: '#F3F6FB',
  faixa: '#F8FAFC',
}

function secao(titulo: string, corpo: string) {
  return `
    <tr><td style="padding:22px 24px 6px 24px;">
      <div style="font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${COR.primaria};">${esc(titulo)}</div>
    </td></tr>
    <tr><td style="padding:0 24px 8px 24px;">${corpo}</td></tr>`
}

function linha(rotulo: string, valor: string, opts: { forte?: boolean; suave?: boolean; cor?: string } = {}) {
  const peso = opts.forte ? '700' : '400'
  const cor = opts.cor ?? (opts.suave ? COR.suave : COR.tinta)
  const topo = opts.forte ? `border-top:1px solid ${COR.borda};` : ''
  return `
    <tr>
      <td style="padding:7px 12px 7px 0;font-size:14px;color:${opts.suave ? COR.suave : COR.tinta};font-weight:${peso};${topo}">${esc(rotulo)}</td>
      <td align="right" style="padding:7px 0;font-size:14px;color:${cor};font-weight:${peso};${topo}">${valor}</td>
    </tr>`
}

const tabela = (linhas: string) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${linhas}</table>`

function listaParcelas(itens: ItemParcela[]) {
  if (itens.length === 0) {
    return `<div style="font-size:13px;color:${COR.suave};padding:4px 0 8px 0;">Nenhuma.</div>`
  }
  const rows = itens
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 0;font-size:13px;color:${COR.tinta};border-bottom:1px solid ${COR.borda};">${esc(p.descricao)}</td>
        <td align="center" width="64" style="width:64px;padding:6px 4px;font-size:13px;color:${COR.suave};border-bottom:1px solid ${COR.borda};white-space:nowrap;">${p.parcela_atual}/${p.parcela_total}</td>
        <td align="right" width="96" style="width:96px;padding:6px 0;font-size:13px;color:${COR.tinta};border-bottom:1px solid ${COR.borda};white-space:nowrap;">${brl(p.valor)}</td>
      </tr>`,
    )
    .join('')
  return tabela(rows)
}

function montarHtml(r: Resumo): { assunto: string; html: string } {
  const prox = mesSeguinte(r.ano, r.mes)
  const titulo = rotuloMes(r.ano, r.mes)
  const assunto = `Resumo financeiro — ${titulo}`
  const gerado = new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

  // ----- Entradas (Previsto x Real quando a função SQL nova está no banco)
  const cab = (t: string, alinhar: 'left' | 'right' = 'right') =>
    `<td align="${alinhar}" style="padding:6px 0 6px 6px;font-size:11px;font-weight:700;color:${COR.suave};text-transform:uppercase;border-bottom:1px solid ${COR.borda};">${t}</td>`
  const temPrevisto = r.entradas.renda_previsto !== undefined && r.saidas.total_previsto !== undefined

  const linhaDupla = (rotulo: string, previsto: number, real: number, opts: { forte?: boolean; suave?: boolean; corReal?: string } = {}) => {
    const peso = opts.forte ? '700' : '400'
    const cor = opts.suave ? COR.suave : COR.tinta
    const topo = opts.forte ? `border-top:1px solid ${COR.borda};` : ''
    const celula = (v: number, c: string) =>
      `<td align="right" width="92" style="width:92px;padding:7px 0 7px 6px;font-size:13px;color:${c};font-weight:${peso};white-space:nowrap;${topo}">${brl(v)}</td>`
    return `
    <tr>
      <td style="padding:7px 8px 7px 0;font-size:14px;color:${cor};font-weight:${peso};${topo}">${esc(rotulo)}</td>
      ${celula(previsto, cor)}${celula(real, opts.corReal ?? cor)}
    </tr>`
  }

  const entradas = temPrevisto
    ? tabela(
        `<tr><td style="border-bottom:1px solid ${COR.borda};"></td>${cab('Previsto')}${cab('Real')}</tr>` +
          linhaDupla('Salário', r.entradas.salario_previsto ?? 0, r.entradas.salario) +
          linhaDupla('Outras', r.entradas.outras_previsto ?? 0, r.entradas.outras) +
          linhaDupla('Total entradas', r.entradas.renda_previsto ?? 0, r.entradas.renda, { forte: true, corReal: COR.receita }) +
          ((r.entradas.emprestimo > 0 || (r.entradas.emprestimo_previsto ?? 0) > 0)
            ? linhaDupla('Empréstimo (fora da renda)', r.entradas.emprestimo_previsto ?? 0, r.entradas.emprestimo, { suave: true })
            : ''),
      )
    : tabela(
        linha('Salário', brl(r.entradas.salario)) +
          linha('Outras', brl(r.entradas.outras)) +
          linha('Total de entradas', brl(r.entradas.renda), { forte: true, cor: COR.receita }) +
          (r.entradas.emprestimo > 0
            ? linha('Empréstimo (não conta como renda)', brl(r.entradas.emprestimo), { suave: true })
            : ''),
      )

  // ----- Saídas (uma tabela de Previsto e outra de Real, cada uma com a própria base de %)
  const tabelaGrupos = (modo: 'previsto' | 'real') => {
    const linhasGrupos = r.saidas.grupos
      .map((g) => {
        const valor = modo === 'previsto' ? (g.valor_previsto ?? 0) : g.valor
        const pcts = modo === 'previsto'
          ? [g.prev_pct_despesas ?? null, g.prev_pct_salario ?? null, g.prev_pct_renda ?? null]
          : [g.pct_despesas, g.pct_salario, g.pct_renda]
        const detalhe = modo === 'previsto' ? `${g.qtd} lanç.` : `${g.qtd_pagas ?? 0}/${g.qtd} pagos`
        const td = (v: number | null) =>
          `<td align="right" style="padding:8px 0 8px 6px;font-size:13px;color:${COR.tinta};border-bottom:1px solid ${COR.borda};">${pct(v)}</td>`
        return `
      <tr>
        <td style="padding:8px 0;font-size:14px;color:${COR.tinta};border-bottom:1px solid ${COR.borda};">
          ${NOME_GRUPO[g.chave]}<span style="font-size:11px;color:${COR.suave};"> · ${detalhe}</span>
        </td>
        <td align="right" style="padding:8px 0 8px 6px;font-size:14px;color:${COR.tinta};font-weight:700;border-bottom:1px solid ${COR.borda};white-space:nowrap;">${brl(valor)}</td>
        ${td(pcts[0])}${td(pcts[1])}${td(pcts[2])}
      </tr>`
      })
      .join('')
    return tabela(
      `<tr>${cab('Grupo', 'left')}${cab('Valor')}${cab('% desp.')}${cab('% sal.')}${cab('% entr.')}</tr>` + linhasGrupos,
    )
  }
  const rotuloTabela = (texto: string) =>
    `<div style="font-size:12px;font-weight:700;color:${COR.primaria};padding:14px 0 2px 0;">${texto}</div>`

  const totalPrev = r.saidas.total_previsto ?? 0
  const pagoDoPrevisto = totalPrev > 0 ? Math.round((r.saidas.total / totalPrev) * 100) : null
  const topoSaidas = temPrevisto
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td width="50%" valign="top" style="padding:4px 0 6px 0;">
          <div style="font-size:11px;font-weight:700;color:${COR.suave};text-transform:uppercase;">Previsto</div>
          <div style="font-size:21px;font-weight:700;color:${COR.tinta};">${brl(totalPrev)}</div>
        </td>
        <td width="50%" valign="top" style="padding:4px 0 6px 0;">
          <div style="font-size:11px;font-weight:700;color:${COR.suave};text-transform:uppercase;">Real (já pago)</div>
          <div style="font-size:21px;font-weight:700;color:${COR.despesa};">${brl(r.saidas.total)}</div>
        </td>
      </tr></table>` +
      (pagoDoPrevisto != null
        ? `<div style="font-size:12px;color:${COR.suave};padding-bottom:2px;">${pagoDoPrevisto}% do previsto já foi pago.</div>`
        : '')
    : `<div style="font-size:24px;font-weight:700;color:${COR.despesa};padding:4px 0 10px 0;">${brl(r.saidas.total)}</div>`

  const saidas =
    topoSaidas +
    (temPrevisto
      ? rotuloTabela('Previsto — o que está programado para o mês') + tabelaGrupos('previsto') +
        rotuloTabela('Real — o que já foi pago') + tabelaGrupos('real')
      : tabelaGrupos('real')) +
    `<div style="font-size:11px;color:${COR.suave};padding-top:8px;">% desp. = sobre o total de saídas · % sal. = sobre o salário · % entr. = sobre Salário + Outras (sem empréstimo). ${temPrevisto ? 'Cada tabela usa a própria base: previsto ÷ previsto e real ÷ real.' : ''}</div>`

  // ----- Parcelas
  const comecam = r.parcelas.comecam_mes ?? []
  const comecamProx = r.parcelas.comecam_proximo_mes ?? []
  const subtitulo = (texto: string, topo = 14) =>
    `<div style="font-size:13px;font-weight:700;color:${COR.tinta};padding:${topo}px 0 4px 0;">${texto}</div>`
  // soma mensal das parcelas da lista, em vermelho, no fim do título
  const porMes = (valor: number | undefined) =>
    valor && valor > 0 ? ` · <span style="color:${COR.despesa};">${brl(valor)} por mês</span>` : ''
  const parcelas =
    subtitulo(`Terminaram em ${MESES[r.mes - 1]} (${r.parcelas.finalizadas.length})${porMes(r.parcelas.libera_no_mes_seguinte)}`, 2) +
    listaParcelas(r.parcelas.finalizadas) +
    subtitulo(`Terminam em ${MESES[prox.mes - 1]} (${r.parcelas.terminam_proximo_mes.length})${porMes(r.parcelas.libera_dois_meses_depois)}`) +
    listaParcelas(r.parcelas.terminam_proximo_mes) +
    subtitulo(`Começam em ${MESES[r.mes - 1]} (${comecam.length})${porMes(r.parcelas.entra_no_mes)}`) +
    listaParcelas(comecam) +
    subtitulo(`Começam em ${MESES[prox.mes - 1]} (${comecamProx.length})${porMes(r.parcelas.entra_no_mes_seguinte)}`) +
    listaParcelas(comecamProx) +
    `<div style="font-size:11px;color:${COR.suave};padding-top:4px;">Considera só o que já está lançado em ${MESES[prox.mes - 1]}.</div>`

  // ----- Pendentes
  const p = r.pendentes
  const pendentes =
    p.despesas.qtd === 0 && p.receitas.qtd === 0
      ? `<div style="font-size:14px;color:${COR.receita};padding:4px 0 8px 0;">Nenhum lançamento pendente.</div>`
      : tabela(
          (p.despesas.qtd > 0
            ? linha(`Despesas sem pagamento registrado (${p.despesas.qtd})`, `${brl(p.despesas.valor)} <span style="font-size:11px;color:${COR.suave};font-weight:400;">previsto</span>`)
            : '') +
            (p.receitas.qtd > 0
              ? linha(`Receitas sem recebimento registrado (${p.receitas.qtd})`, `${brl(p.receitas.valor)} <span style="font-size:11px;color:${COR.suave};font-weight:400;">previsto</span>`)
              : ''),
        )

  // ----- Saldo e reserva
  const s = r.saldo
  const sinal = (n: number) => (n > 0 ? '+' : '')
  const saldo = tabela(
    linha('Saldo inicial do mês', brl(s.inicial)) +
      linha('Saldo final do mês', brl(s.final), { forte: true, cor: s.final >= 0 ? COR.receita : COR.despesa }) +
      linha('Reserva (total acumulado)', brl(s.reserva_total), { forte: true, cor: COR.primaria }) +
      linha('Depósitos na reserva no mês', brl(s.reserva_depositos), { suave: true }) +
      linha('Resgates da reserva no mês', brl(s.reserva_resgates), { suave: true }) +
      linha('Movimento líquido da reserva', `${sinal(s.reserva_liquida_mes)}${brl(s.reserva_liquida_mes)}`, { suave: true }),
  )

  const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(assunto)}</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COR.fundo};">
<tr><td align="center" style="padding:24px 8px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;color:${COR.tinta};">
    <tr><td style="background:${COR.marinho};padding:26px 24px;">
      <div style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#BFD3FF;">Livro Caixa · Resumo financeiro</div>
      <div style="font-size:28px;font-weight:700;color:#ffffff;padding-top:6px;">${esc(titulo)}</div>
    </td></tr>
    ${secao('Entradas', entradas)}
    ${secao('Saídas', saidas)}
    ${secao('Parcelas', parcelas)}
    ${secao('Pendentes do mês', pendentes)}
    ${secao('Saldo e reserva', saldo)}
    <tr><td style="padding:22px 24px 26px 24px;">
      <div style="font-size:11px;line-height:1.5;color:${COR.suave};border-top:1px solid ${COR.borda};padding-top:14px;">
        Valores efetivos (o que foi pago ou recebido), exceto pendentes e valores de parcela, que usam o previsto.
        O empréstimo não conta como renda. Grupos de saída: recorrente = marcado como recorrente; parcelada = tem número de parcela; variável = o resto.
        Parcelas consideradas: apenas despesas.<br>Gerado em ${esc(gerado)}.
      </div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`

  return { assunto, html }
}

// ---------- e-mail (texto puro, para clientes sem HTML) ----------

function montarTexto(r: Resumo): string {
  const prox = mesSeguinte(r.ano, r.mes)
  const L: string[] = []
  const temPrevisto = r.entradas.renda_previsto !== undefined && r.saidas.total_previsto !== undefined
  L.push(`RESUMO FINANCEIRO — ${rotuloMes(r.ano, r.mes)}`, '')

  L.push('ENTRADAS' + (temPrevisto ? ' (previsto | real)' : ''))
  const par = (rotulo: string, previsto: number | undefined, real: number) =>
    temPrevisto ? `  ${rotulo}: ${brl(previsto ?? 0)} | ${brl(real)}` : `  ${rotulo}: ${brl(real)}`
  L.push(par('Salário', r.entradas.salario_previsto, r.entradas.salario))
  L.push(par('Outras', r.entradas.outras_previsto, r.entradas.outras))
  L.push(par('Total de entradas', r.entradas.renda_previsto, r.entradas.renda))
  if (r.entradas.emprestimo > 0 || (r.entradas.emprestimo_previsto ?? 0) > 0) {
    L.push(par('Empréstimo (não conta como renda)', r.entradas.emprestimo_previsto, r.entradas.emprestimo))
  }

  if (temPrevisto) {
    L.push('', `SAÍDAS — previsto ${brl(r.saidas.total_previsto ?? 0)} · real (já pago) ${brl(r.saidas.total)}`)
    L.push('  PREVISTO (o que está programado para o mês)')
    for (const g of r.saidas.grupos) {
      L.push(`    ${NOME_GRUPO[g.chave]} (${g.qtd}): ${brl(g.valor_previsto ?? 0)} · ${pct(g.prev_pct_despesas ?? null)} das saídas · ${pct(g.prev_pct_salario ?? null)} do salário · ${pct(g.prev_pct_renda ?? null)} das entradas`)
    }
    L.push('  REAL (o que já foi pago)')
    for (const g of r.saidas.grupos) {
      L.push(`    ${NOME_GRUPO[g.chave]} (${g.qtd_pagas ?? 0}/${g.qtd} pagos): ${brl(g.valor)} · ${pct(g.pct_despesas)} das saídas · ${pct(g.pct_salario)} do salário · ${pct(g.pct_renda)} das entradas`)
    }
  } else {
    L.push('', `SAÍDAS — total ${brl(r.saidas.total)}`)
    for (const g of r.saidas.grupos) {
      L.push(`  ${NOME_GRUPO[g.chave]} (${g.qtd}): ${brl(g.valor)} · ${pct(g.pct_despesas)} das saídas · ${pct(g.pct_salario)} do salário · ${pct(g.pct_renda)} das entradas`)
    }
  }

  const itens = (xs: ItemParcela[]) =>
    xs.length ? xs.map((p) => `  - ${p.descricao} ${p.parcela_atual}/${p.parcela_total} (${brl(p.valor)})`) : ['  Nenhuma.']
  const porMes = (valor: number | undefined) => (valor && valor > 0 ? ` (${brl(valor)} por mês)` : '')
  L.push('', `PARCELAS QUE TERMINARAM EM ${MESES[r.mes - 1].toUpperCase()}${porMes(r.parcelas.libera_no_mes_seguinte)}`, ...itens(r.parcelas.finalizadas))
  L.push('', `PARCELAS QUE TERMINAM EM ${MESES[prox.mes - 1].toUpperCase()}${porMes(r.parcelas.libera_dois_meses_depois)}`, ...itens(r.parcelas.terminam_proximo_mes))
  L.push('', `PARCELAS QUE COMEÇAM EM ${MESES[r.mes - 1].toUpperCase()}${porMes(r.parcelas.entra_no_mes)}`, ...itens(r.parcelas.comecam_mes ?? []))
  L.push('', `PARCELAS QUE COMEÇAM EM ${MESES[prox.mes - 1].toUpperCase()}${porMes(r.parcelas.entra_no_mes_seguinte)}`, ...itens(r.parcelas.comecam_proximo_mes ?? []))
  L.push(`  (considera só o que já está lançado em ${MESES[prox.mes - 1]})`)
  L.push('', 'PENDENTES DO MÊS')
  const p = r.pendentes
  if (p.despesas.qtd === 0 && p.receitas.qtd === 0) L.push('  Nenhum lançamento pendente.')
  if (p.despesas.qtd > 0) L.push(`  Despesas sem pagamento: ${p.despesas.qtd} (${brl(p.despesas.valor)} previsto)`)
  if (p.receitas.qtd > 0) L.push(`  Receitas sem recebimento: ${p.receitas.qtd} (${brl(p.receitas.valor)} previsto)`)
  L.push('', 'SALDO E RESERVA')
  L.push(`  Saldo inicial do mês: ${brl(r.saldo.inicial)}`)
  L.push(`  Saldo final do mês: ${brl(r.saldo.final)}`)
  L.push(`  Reserva (total acumulado): ${brl(r.saldo.reserva_total)}`)
  L.push(`  Depósitos: ${brl(r.saldo.reserva_depositos)} · Resgates: ${brl(r.saldo.reserva_resgates)} · Líquido: ${brl(r.saldo.reserva_liquida_mes)}`)
  return L.join('\n')
}

// ---------- servidor ----------

function json(status: number, corpo: unknown) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS })
  if (req.method !== 'POST') return json(405, { erro: 'Use POST.' })

  const authorization = req.headers.get('Authorization')
  if (!authorization) return json(401, { erro: 'Faça login para usar o resumo.' })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const apikey = Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? ''
  if (!supabaseUrl) return json(500, { erro: 'SUPABASE_URL não está definido na função.' })

  // 1) Quem está chamando? (valida o token e descobre o e-mail da conta)
  const quem = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { Authorization: authorization, apikey } })
  if (!quem.ok) return json(401, { erro: 'Sessão inválida ou expirada. Entre no app de novo.' })
  const usuario = await quem.json().catch(() => null)
  const email: string | undefined = usuario?.email
  if (!email) return json(401, { erro: 'Não achei o e-mail da sua conta.' })

  // 2) Parâmetros
  let corpo: { ano?: unknown; mes?: unknown; acao?: unknown } = {}
  try {
    corpo = await req.json()
  } catch {
    return json(400, { erro: 'Corpo da requisição inválido.' })
  }
  const ano = Number(corpo.ano)
  const mes = Number(corpo.mes)
  const acao = corpo.acao === 'enviar' ? 'enviar' : 'previa'
  if (!Number.isInteger(ano) || ano < 2000 || ano > 2100 || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    return json(400, { erro: 'Informe ano (2000 a 2100) e mês (1 a 12).' })
  }

  // 3) Números — pela função SQL, com o token do usuário (RLS vale)
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/resumo_mensal`, {
    method: 'POST',
    headers: { Authorization: authorization, apikey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_ano: ano, p_mes: mes }),
  })
  if (!rpc.ok) {
    const detalhe = await rpc.text()
    const dica = rpc.status === 404
      ? ' A função resumo_mensal não existe no banco: rode a migração do resumo no SQL Editor do Supabase.'
      : ''
    return json(502, { erro: `Não consegui calcular o resumo.${dica}`, detalhe })
  }
  const resumo = (await rpc.json()) as Resumo

  const { assunto, html } = montarHtml(resumo)
  if (acao === 'previa') return json(200, { assunto, para: email, html })

  // 4) Envio (Resend), só para o e-mail da própria conta
  const chave = Deno.env.get('RESEND_API_KEY')
  if (!chave) return json(500, { erro: 'RESEND_API_KEY não está configurada nos segredos da função.' })
  const de = Deno.env.get('RESEND_FROM') ?? 'Livro Caixa <onboarding@resend.dev>'
  const urlResend = Deno.env.get('RESEND_API_URL') ?? 'https://api.resend.com/emails'

  const envio = await fetch(urlResend, {
    method: 'POST',
    headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: de, to: [email], subject: assunto, html, text: montarTexto(resumo) }),
  })
  const resposta = await envio.json().catch(() => ({}))
  if (!envio.ok) {
    return json(502, { erro: resposta?.message ?? `O Resend respondeu ${envio.status}.`, detalhe: resposta })
  }
  return json(200, { ok: true, id: resposta?.id ?? null, para: email, assunto })
})
