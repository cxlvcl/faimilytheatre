import { useCallback, useEffect, useState } from 'react'
import { ApiError, cachedPublic, publicRequest } from '../lib/api'
export function usePublicResource<T>(path: string) {
  const [attempt, setAttempt] = useState(0)
  const [data, setData] = useState<T | undefined>(() => cachedPublic<T>(path))
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'not-found'>(() => cachedPublic(path) === undefined ? 'loading' : 'ready')
  useEffect(() => {
    let active = true
    publicRequest<T>(path, attempt > 0).then(value => {
      if (active) { setData(value); setStatus('ready') }
    }).catch(error => {
      if (active) setStatus(error instanceof ApiError && error.code === 'not_found' ? 'not-found' : 'error')
    })
    return () => { active = false }
  }, [path, attempt])
  const retry = useCallback(() => { setStatus('loading'); setAttempt(value => value + 1) }, [])
  return { data, status, retry }
}
