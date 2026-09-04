import { supabase } from './supabase'

/**
 * O Supabase limita a 1000 linhas por consulta por padrão. Qualquer tela que
 * precise somar/agrupar o histórico inteiro (não só a competência atual)
 * precisa paginar, senão os números ficam incompletos silenciosamente
 * assim que o histórico passa de 1000 linhas.
 */
export async function fetchAllRows(
  tabela: 'transactions' | 'reserva_movimentos',
  colunas: string
): Promise<Record<string, unknown>[]> {
  const TAMANHO_PAGINA = 1000
  let inicio = 0
  let todasLinhas: Record<string, unknown>[] = []

  while (true) {
    const { data, error } = await supabase
      .from(tabela)
      .select(colunas)
      .range(inicio, inicio + TAMANHO_PAGINA - 1)

    if (error || !data || data.length === 0) break
    todasLinhas = todasLinhas.concat(data as unknown as Record<string, unknown>[])
    if (data.length < TAMANHO_PAGINA) break
    inicio += TAMANHO_PAGINA
  }

  return todasLinhas
}
