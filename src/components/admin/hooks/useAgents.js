import { useCallback, useEffect, useState } from 'react'
import { API_BASE_URL, AUTH_HEADERS } from '../../../config/api'

const API_BASE = API_BASE_URL

function normalizeAgents(payload) {
  if (!Array.isArray(payload)) return []
  return payload.map((agent, index) => ({
    ...agent,
    id: agent.id ?? agent.agent_id ?? agent.user_id ?? agent.email ?? `agent-${index}`,
    name: agent.name || agent.full_name || agent.username || agent.email || 'Unnamed agent',
    email: agent.email || '',
  }))
}

export default function useAgents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchAgents = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/getAgent.php`, {
        method: 'GET',
        credentials: 'include',
        headers: AUTH_HEADERS,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to load agents')
      }
      const mapped = normalizeAgents(data.agents || data.data || [])
      setAgents(mapped)
    } catch (err) {
      setError(err?.message || 'Failed to load agents')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  return { agents, loading, error, refresh: fetchAgents }
}

