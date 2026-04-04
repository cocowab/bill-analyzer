let cache: Record<string, string> | null = null
let fetchPromise: Promise<Record<string, string>> | null = null

export function prefetchSettings(): void {
  if (cache || fetchPromise) return
  fetchPromise = fetch('/api/settings')
    .then((r) => r.json())
    .then((data) => {
      cache = data
      fetchPromise = null
      return data
    })
    .catch(() => {
      fetchPromise = null
      return {}
    })
}

export async function getSettings(): Promise<Record<string, string>> {
  if (cache) return cache
  if (fetchPromise) return fetchPromise
  prefetchSettings()
  return fetchPromise!
}

export function updateCache(data: Record<string, string>): void {
  cache = { ...cache, ...data }
}

export function clearCache(): void {
  cache = null
  fetchPromise = null
}
