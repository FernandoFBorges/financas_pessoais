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
    reload()
  }, [reload])

  return { categories, paymentMethods, loading, reload }
}
