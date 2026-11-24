import { useState, useEffect, useCallback, useRef } from 'react'
import toast from 'react-hot-toast'
import { taxService } from '../services/taxService'
import { storageService } from '../services/storageService'
import { friendlyError } from '../utils/errors'
import { progress } from '../demo/progress'

// Wrap every taxService call so that:
//  a) thrown validation errors (assertUUID, enum checks) are caught, not swallowed
//  b) raw DB/network error messages are never shown to the user
async function safe(fn) {
  try {
    const result = await fn()
    // Supabase returns { data, error } — surface the error the same way
    if (result?.error) return { error: result.error }
    return result
  } catch (err) {
    return { error: err }
  }
}

export function useTaxItems(filters = {}) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState(null)
  const [count,   setCount]   = useState(0)
  const filtersKey = JSON.stringify(filters)

  const fetch = useCallback(async () => {
    setLoading(true)
    const { data, error, count } = await safe(() => taxService.getTaxItems(filters))
    if (error) {
      const msg = friendlyError(error)
      setError(msg)
      toast.error(msg)
    } else {
      setItems(data ?? [])
      setCount(count ?? 0)
      setError(null)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey])

  useEffect(() => { fetch() }, [fetch])

  const createItem = async (payload) => {
    const tid = toast.loading('Adding item…')
    const { data, error } = await safe(() => taxService.createTaxItem(payload))
    if (error) {
      const msg = friendlyError(error)
      toast.error(msg, { id: tid })
      return { error }
    }
    setItems(prev => [data, ...prev])
    setCount(prev => prev + 1)
    progress.mark('add')
    toast.success('Entry added', { id: tid })
    return { data }
  }

  const updateItem = async (id, patch) => {
    const tid = toast.loading('Saving…')
    const { data, error } = await safe(() => taxService.updateTaxItem(id, patch))
    if (error) {
      const msg = friendlyError(error)
      toast.error(msg, { id: tid })
      return { error }
    }
    setItems(prev => {
      const before = prev.find(i => i.id === id)
      if (before && before.status !== 'verified' && data?.status === 'verified') progress.mark('verify')
      return prev.map(i => i.id === id ? data : i)
    })
    toast.success('Changes saved', { id: tid })
    return { data }
  }

  const deleteItem = async (item, { quiet = false } = {}) => {
    const id = typeof item === 'string' ? item : item?.id
    const receiptPath = typeof item === 'object' ? item?.receipt_url : null
    const tid = quiet ? undefined : toast.loading('Deleting…')
    const { error } = await safe(() => taxService.deleteTaxItem(id))
    if (error) {
      const msg = friendlyError(error)
      toast.error(msg, { id: tid })
      return { error }
    }
    // Remove the attached receipt file too (best effort).
    if (receiptPath) storageService.remove(receiptPath)
    setItems(prev => prev.filter(i => i.id !== id))
    setCount(prev => prev - 1)
    if (!quiet) toast.success('Deleted', { id: tid })
    return {}
  }

  return { items, loading, error, count, createItem, updateItem, deleteItem, refetch: fetch }
}

export function useCategories() {
  const [categories, setCategories] = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    safe(() => taxService.getCategories()).then(({ data }) => {
      setCategories(data ?? [])
      setLoading(false)
    })
  }, [])

  return { categories, loading }
}

/**
 * @param refreshKey  any value that changes when the underlying entries do
 *                    (the dashboard passes a fingerprint of its list), so the
 *                    totals follow an add or edit without a page change.
 */
export function useTaxSummary(taxYear, refreshKey) {
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const loaded = useRef(false)

  useEffect(() => {
    if (!taxYear) return
    if (!loaded.current) setLoading(true) // later refreshes update in place, no skeleton flash
    safe(() => taxService.getSummary(taxYear)).then(({ data }) => {
      setSummary(data ?? null)
      setLoading(false)
      loaded.current = true
    })
  }, [taxYear, refreshKey])

  return { summary, loading }
}
