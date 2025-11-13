import { useEffect, useMemo, useRef, useState } from 'react'

const API_BASE = 'https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api'
const AUTH_HEADER = {
  Authorization: 'Bearer q6ktqrPs3wZ4kvZAzNdi7',
  'Content-Type': 'application/json',
}

function normalizeContacts(data) {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    const name = item.name || item.phone_number || 'Unknown'
    return {
      ...item,
      id: item.id ?? item.contact_id ?? item.phone_number ?? name,
      name,
      lastMessage: item.lastMessage ?? item.last_message ?? '',
      lastMessageTime:
        item.lastMessageTime ?? item.last_message_time ?? item.last_seen ?? item.time ?? '',
      avatar: item.avatar || name.slice(0, 2).toUpperCase(),
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

function formatTime(raw) {
  if (!raw) return ''
  const toDate = (value) => {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  let date = null
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw
    date = toDate(ms)
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      date = toDate(trimmed.length === 10 ? numeric * 1000 : numeric)
    }
    if (!date) {
      const isoLike = trimmed.replace(' ', 'T')
      date = toDate(`${isoLike}Z`) ?? toDate(isoLike) ?? toDate(trimmed)
    }
  }

  if (!date) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return ''
  }
}

export default function ChatSection() {
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState('')

  const [activeContactId, setActiveContactId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState('')
  const [messageInput, setMessageInput] = useState('')

  const messageEndRef = useRef(null)

  useEffect(() => {
    let aborted = false

    async function fetchContacts() {
      setContactsLoading(true)
      setContactsError('')
      try {
        const res = await fetch(`${API_BASE}/getContacts.php`, {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADER,
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok || data?.ok !== true) {
          throw new Error(data?.error || 'Failed to load contacts')
        }

        if (aborted) return
        const mapped = normalizeContacts(data.contacts)
        setContacts(mapped)
        if (mapped.length) {
          setActiveContactId(mapped[0].id)
        }
      } catch (error) {
        if (!aborted) setContactsError(error?.message || 'Failed to load contacts')
      } finally {
        if (!aborted) setContactsLoading(false)
      }
    }

    fetchContacts()
    return () => {
      aborted = true
    }
  }, [])

  useEffect(() => {
    if (!activeContactId) {
      setMessages([])
      return
    }

    let aborted = false
    async function fetchMessages() {
      setMessagesLoading(true)
      setMessagesError('')
      try {
        const res = await fetch(
          `${API_BASE}/getMessages.php?contact_id=${encodeURIComponent(activeContactId)}`,
          {
            credentials: 'include',
            headers: AUTH_HEADER,
          }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok !== true) {
          throw new Error(data?.error || 'Failed to load messages')
        }
        if (aborted) return
        const normalized = Array.isArray(data.messages)
          ? data.messages.map((msg) => ({
              id: msg.id ?? `${msg.timestamp}-${msg.sender_type}`,
              message: msg.message_text ?? msg.message ?? '',
              senderType: msg.sender_type ?? 'customer',
              timestamp: msg.timestamp ?? msg.time ?? '',
            }))
          : []
        setMessages(normalized)
      } catch (error) {
        if (!aborted) setMessagesError(error?.message || 'Failed to load messages')
        setMessages([])
      } finally {
        if (!aborted) setMessagesLoading(false)
      }
    }

    fetchMessages()
    return () => {
      aborted = true
    }
  }, [activeContactId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return contacts
    const q = query.trim().toLowerCase()
    return contacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(q) ||
        (contact.lastMessage || '').toLowerCase().includes(q) ||
        String(contact.phone_number || '').toLowerCase().includes(q)
      )
    })
  }, [contacts, query])

  const activeContact = useMemo(
    () => contacts.find((contact) => contact.id === activeContactId) ?? null,
    [contacts, activeContactId]
  )

  const handleSend = async () => {
    if (!activeContactId || !messageInput.trim()) return
    const text = messageInput.trim()
    setMessageInput('')

    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: text,
        senderType: 'company',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      await fetch(`${API_BASE}/sendMessage.php`, {
        method: 'POST',
        credentials: 'include',
        headers: AUTH_HEADER,
        body: JSON.stringify({ contact_id: activeContactId, message: text }),
      })
    } catch (error) {
      console.error('Failed to send message', error)
    }
  }

  return (
    <div className="flex h-full min-h-0 bg-white">
      <aside className="flex w-80 min-h-0 flex-col border-r border-slate-100 bg-slate-50/70">
        <div className="border-b border-slate-100 px-5 py-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Search contacts…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-3 text-sm text-slate-700 shadow-sm placeholder:text-slate-400 focus:border-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-200/70"
          />
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
          {contactsLoading ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
              Loading contacts…
            </div>
          ) : contactsError ? (
            <div className="rounded-xl bg-rose-50 px-4 py-4 text-sm text-rose-600 shadow-sm">
              {contactsError}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-xl bg-white px-4 py-6 text-center text-sm text-slate-500 shadow-sm">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isActive = contact.id === activeContactId
              const initials = contact.avatar?.slice(0, 2).toUpperCase() || '??'
              return (
                <button
                  key={contact.id}
                  onClick={() => setActiveContactId(contact.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${
                    isActive ? 'bg-white shadow ring-1 ring-emerald-100' : 'bg-white/90 hover:bg-white'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="truncate text-sm font-semibold text-slate-900">{contact.name}</p>
                      {contact.assignedAgent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                          {contact.assignedAgent}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-medium border border-slate-200/50">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
                          Unassigned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-500 mt-0.5">
                      {contact.lastMessage || 'No recent activity'}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-400">
                    {formatTime(contact.lastMessageTime)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-[linear-gradient(135deg,#fafdff,#f1f5f9)]">
        {!activeContact ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Select a contact to view messages
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold shadow-sm">
                  {activeContact.avatar?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-900">{activeContact.name}</p>
                  <p className="truncate text-xs text-slate-500">
                    Last active {formatTime(activeContact.lastMessageTime) || 'Recently'}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0">
                {activeContact.assignedAgent ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned to</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200/60 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      {activeContact.assignedAgent}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned to</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium border border-slate-200/60 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                      Unassigned
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              {messagesLoading ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  Loading messages…
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center text-sm text-rose-500">
                  {messagesError}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-500">
                  No messages yet for this contact
                </div>
              ) : (
                <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3">
                  {messages.map((message) => {
                    const isCompany = (message.senderType || 'customer') === 'company'
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isCompany ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-3xl px-4 py-3 text-sm shadow ${
                            isCompany
                              ? 'rounded-tr-sm bg-emerald-500 text-white shadow-emerald-500/25'
                              : 'rounded-tl-sm bg-white text-slate-700 shadow-slate-300/40'
                          }`}
                        >
                          <p className="whitespace-pre-wrap wrap-break-word">{message.message}</p>
                          {message.timestamp && (
                            <p className="mt-2 text-[10px] font-medium opacity-70 text-right">
                              {formatTime(message.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messageEndRef} />
                </div>
              )}
            </div>

            <div className="border-t border-slate-100 bg-white px-6 py-4">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  type="text"
                  placeholder="Type a message…"
                  className="flex-1 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  disabled={!activeContactId}
                />
                <button
                  onClick={handleSend}
                  className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={!messageInput.trim() || !activeContactId}
                >
                  Send
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

