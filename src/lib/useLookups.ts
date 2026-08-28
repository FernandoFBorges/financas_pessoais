import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { Category, PaymentMethod } from './types'

export function useLookups() {
  const [categories, setCategories] = useState<Category[]>([])
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const [{ data: cats }, { data: pms }] = await Promise.all([
      supabase.from('categories').select('*').order('nome'),
      supabase.from('payment_methods').select('*').order('nome'),
    ])
    setCategories((cats as Category[]) ?? [])
    setPaymentMethods((pms as PaymentMethod[]) ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    // Busca de categorias/meios ao montar — sincronização com o Supabase
    // (sistema externo), não um cálculo derivável durante o render.
    // oxlint-disable-next-line react/set-state-in-effect
    reload()
  }, [reload])

  return { categories, paymentMethods, loading, reload }
}
