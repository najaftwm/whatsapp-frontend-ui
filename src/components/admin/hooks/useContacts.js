import { useCallback, useEffect, useState } from 'react'

const API_BASE = 'https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api'
const AUTH_HEADERS = {
  Authorization: 'Bearer q6ktqrPs3wZ4kvZAzNdi7',
  'Content-Type': 'application/json',
}

function normalizeContacts(payload) {
  if (!Array.isArray(payload)) return []
  return payload.map((item) => {
    const name = item.name || item.full_name || item.phone_number || 'Unknown'
    const phone =
      item.phone ||
      item.phone_number ||
      item.msisdn ||
      item.contact_phone ||
      ''
    const lastActive =
      item.last_seen ||
      item.last_seen_at ||
      item.last_active ||
      item.lastMessageTime ||
      item.last_message_time ||
      item.updated_at ||
      ''

    return {
      ...item,
      id: item.id ?? item.contact_id ?? item.customer_id ?? phone ?? name,
      name,
      phone,
      lastActive,
      assignedAgent:
        item.assigned_agent || 
        item.agent_name || 
        item.assigned_to || 
        item.assigned_agent_name ||
        item.agent?.name ||
        null,
    }
  })
}

export default function useContacts() {
  const [contacts, setContacts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchContacts = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/getContacts.php`, {
        method: 'GET',
        credentials: 'include',
        headers: AUTH_HEADERS,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to load contacts')
      }
      const mapped = normalizeContacts(data.contacts)
      console.log('Contacts loaded:', mapped.length, 'contacts')
      console.log('Sample contact with assignment:', mapped.find(c => c.assignedAgent || c.assigned_agent || c.agent_name))
      setContacts(mapped)
    } catch (err) {
      setError(err?.message || 'Failed to load contacts')
      setContacts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchContacts()
  }, [fetchContacts])

  return { contacts, loading, error, refresh: fetchContacts }
}

