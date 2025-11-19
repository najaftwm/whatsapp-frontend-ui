import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FileText, Paperclip, X, MessageCircle } from 'lucide-react'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'
import TemplatePopup from './TemplatePopup'
import MessageWithMedia from './MessageWithMedia'
import { pusher } from '../../pusherClient'

const API_BASE = API_BASE_URL
const AUTH_HEADER = AUTH_HEADERS

function normalizeContacts(data, existingContacts = []) {
  if (!Array.isArray(data)) return []
  // Create a map of existing contacts by ID to preserve lastMessageTime
  const existingMap = new Map()
  existingContacts.forEach(contact => {
    if (contact.id && contact.lastMessageTime) {
      existingMap.set(String(contact.id), contact.lastMessageTime)
    }
  })
  
  return data.map((item) => {
    const name = item.name || item.phone_number || 'Unknown'
    const contactId = String(item.id ?? item.contact_id ?? item.phone_number ?? name)
    
    // Get last_message_time from server, or preserve existing if server doesn't have it
    let lastMessageTime = item.last_message_time ?? item.lastMessageTime ?? item.time ?? null
    // Only use last_seen if we don't have last_message_time and it's not empty
    if (!lastMessageTime && item.last_seen) {
      // Don't use last_seen as it's not the message time
      lastMessageTime = null
    }
    // If server doesn't return a valid lastMessageTime, preserve existing one
    if (!lastMessageTime && existingMap.has(contactId)) {
      lastMessageTime = existingMap.get(contactId)
    }
    
    return {
      ...item,
      id: contactId,
      name,
      lastMessage: item.lastMessage ?? item.last_message ?? '',
      // Only set lastMessageTime if we have a valid value, otherwise null (not empty string)
      lastMessageTime: lastMessageTime || null,
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

function parseTimestamp(raw) {
  if (!raw) return null
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
    if (!trimmed) return null
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      date = toDate(trimmed.length === 10 ? numeric * 1000 : numeric)
    }
    if (!date) {
      const isoLike = trimmed.replace(' ', 'T')
      date = toDate(`${isoLike}Z`) ?? toDate(isoLike) ?? toDate(trimmed)
    }
  }

  return date
}

function formatTime(raw) {
  const date = parseTimestamp(raw)
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

function formatFullTimestamp(raw) {
  const date = parseTimestamp(raw)
  if (!date) return ''

  try {
    const dateStr = date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric'
    })
    const timeStr = date.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    })
    return `${dateStr} ${timeStr}`
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
  const [showTemplatePopup, setShowTemplatePopup] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const mediaCacheRef = useRef(new Map()) // Cache for media object URLs using ref to avoid re-renders

  const messageEndRef = useRef(null)
  const fileInputRef = useRef(null)

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
        setContacts((prev) => {
          const mapped = normalizeContacts(data.contacts, prev)
          // Don't auto-select first contact - let user select manually
          return mapped
        })
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
    // Clear media selection when switching contacts
    setSelectedMedia(null)
    setMediaPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
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
              mediaType: msg.media_type ?? null,
              mediaFilePath: msg.media_file_path ?? null,
              mediaFileName: msg.media_file_name ?? null,
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

  // Real-time updates with Pusher
  useEffect(() => {
    if (!activeContactId) return

    const channel = pusher.subscribe('chat-channel')
    channel.bind('new-message', (data) => {
      if (data.contact_id === activeContactId || String(data.contact_id) === String(activeContactId)) {
        // Generate unique ID if not provided
        const uniqueId = data.id || `pusher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
        const text = data.message || data.message_text || ''
        const now = data.timestamp || new Date().toISOString()
        
        setMessages((prev) => {
          // If this is a company (outgoing) message, replace the last optimistic temp one
          if ((data.sender_type || 'customer') === 'company') {
            const lastIdx = [...prev].reverse().findIndex((m) => {
              if (m.senderType !== 'company') return false
              const id = typeof m.id === 'string' ? m.id : ''
              return id.startsWith('temp-') && (m.message === text)
            })
            if (lastIdx !== -1) {
              const idx = prev.length - 1 - lastIdx
              const next = [...prev]
              next[idx] = {
                id: uniqueId,
                message: text,
                senderType: 'company',
                timestamp: now,
                mediaType: data.media_type || next[idx].mediaType || null,
                mediaFilePath: data.media_file_path || next[idx].mediaFilePath || null,
                mediaFileName: data.media_file_name || next[idx].mediaFileName || null,
              }
              return next
            }
          }

          // Otherwise, prevent exact duplicates
          const exists = prev.some(
            (msg) =>
              msg.id === uniqueId ||
              (msg.timestamp === data.timestamp &&
                msg.message === text &&
                msg.senderType === (data.sender_type || 'customer'))
          )
          if (exists) return prev

          return [
            ...prev,
            {
              id: uniqueId,
              message: text,
              senderType: data.sender_type || 'customer',
              timestamp: now,
              mediaType: data.media_type || null,
              mediaFilePath: data.media_file_path || null,
              mediaFileName: data.media_file_name || null,
            },
          ]
        })

        // Update the contact's lastMessage and lastMessageTime in the contacts list
        setContacts((prev) =>
          prev.map((contact) =>
            contact.id === activeContactId
              ? {
                  ...contact,
                  lastMessage: text,
                  lastMessageTime: now,
                }
              : contact
          )
        )
      }
    })

    return () => {
      pusher.unsubscribe('chat-channel')
    }
  }, [activeContactId])

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

  // Get the last message time from messages if available, otherwise use contact's lastMessageTime
  const lastMessageTime = useMemo(() => {
    if (messages.length > 0) {
      // Get the most recent message timestamp
      const sortedMessages = [...messages].sort((a, b) => {
        const timeA = new Date(a.timestamp || 0).getTime()
        const timeB = new Date(b.timestamp || 0).getTime()
        return timeB - timeA
      })
      return sortedMessages[0]?.timestamp || activeContact?.lastMessageTime || ''
    }
    return activeContact?.lastMessageTime || ''
  }, [messages, activeContact])

  const handleSend = async (templateText = null) => {
    // Ignore event objects that might be passed from button clicks
    if (templateText && typeof templateText === 'object' && templateText.preventDefault) {
      templateText = null
    }
    
    const text = templateText || messageInput.trim()
    if (!activeContactId || !text) return
    
    if (!templateText) {
      setMessageInput('')
    }

    const tempId = `temp-${Date.now()}`
    const now = new Date().toISOString()
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: text,
        senderType: 'company',
        timestamp: now,
      },
    ])

    // Update the contact's lastMessageTime in the contacts list optimistically
    setContacts((prev) =>
      prev.map((contact) =>
        contact.id === activeContactId
          ? {
              ...contact,
              lastMessage: text,
              lastMessageTime: now,
            }
          : contact
      )
    )

    try {
      await fetch(`${API_BASE}/sendMessage.php`, {
        method: 'POST',
        credentials: 'include',
        headers: AUTH_HEADER,
        body: JSON.stringify({ contact_id: activeContactId, message: text }),
      })
      
      // Refresh contacts to get updated last_message_time from server
      // But preserve the optimistic update we just made
      try {
        const res = await fetch(`${API_BASE}/getContacts.php`, {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADER,
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.ok === true && Array.isArray(data.contacts)) {
          setContacts((prev) => {
            const mapped = normalizeContacts(data.contacts, prev)
            // Ensure the contact we just sent to still has the correct lastMessageTime
            return mapped.map(contact => {
              if (contact.id === activeContactId) {
                // If server returned a valid last_message_time, use it, otherwise keep our optimistic update
                const serverTime = contact.lastMessageTime
                const optimisticTime = prev.find(c => c.id === activeContactId)?.lastMessageTime
                return {
                  ...contact,
                  lastMessage: contact.lastMessage || text,
                  lastMessageTime: serverTime || optimisticTime || contact.lastMessageTime
                }
              }
              return contact
            })
          })
        }
      } catch (refreshError) {
        console.error('Failed to refresh contacts', refreshError)
      }
    } catch (error) {
      console.error('Failed to send message', error)
    }
  }

  const handleTemplateSelect = (templateText) => {
    if (templateText && activeContactId) {
      handleSend(templateText)
    }
  }

  const handleMediaSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit')
      return
    }

    setSelectedMedia(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setMediaPreview(e.target.result)
    }

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('video/')) {
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(null)
    }
  }

  const handleMediaUpload = async () => {
    if (!selectedMedia || !activeContactId || uploading) return

    setUploading(true)

    const formData = new FormData()
    formData.append('media', selectedMedia)
    formData.append('contact_id', activeContactId)
    if (messageInput.trim()) {
      formData.append('message', messageInput.trim())
    }

    const tempId = `temp-${Date.now()}`
    const messageText = messageInput.trim() || 'Media file'

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: messageText,
        senderType: 'company',
        timestamp: new Date().toISOString(),
        mediaType: getMediaType(selectedMedia.type),
        mediaPreview: mediaPreview,
        isPending: true,
      },
    ])

    setMessageInput('')
    setSelectedMedia(null)
    setMediaPreview(null)

    try {
      const res = await fetch(`${API_BASE}/uploadMedia.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: AUTH_HEADER.Authorization,
        },
        body: formData,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to upload media')
      }

      // Update message with server response
      const now = new Date().toISOString()
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: data.message_id.toString(),
                mediaType: data.media_type,
                mediaFilePath: data.media_file_path,
                mediaFileName: data.media_file_name,
                isPending: false,
                timestamp: now,
              }
            : msg
        )
      )

      // Update the contact's lastMessageTime in the contacts list
      setContacts((prev) =>
        prev.map((contact) =>
          contact.id === activeContactId
            ? {
                ...contact,
                lastMessage: messageText,
                lastMessageTime: now,
              }
            : contact
        )
      )

      // Refresh contacts to get updated last_message_time from server
      // But preserve the optimistic update we just made
      try {
        const res = await fetch(`${API_BASE}/getContacts.php`, {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADER,
        })
        const contactData = await res.json().catch(() => ({}))
        if (res.ok && contactData?.ok === true && Array.isArray(contactData.contacts)) {
          setContacts((prev) => {
            const mapped = normalizeContacts(contactData.contacts, prev)
            // Ensure the contact we just sent to still has the correct lastMessageTime
            return mapped.map(contact => {
              if (contact.id === activeContactId) {
                // If server returned a valid last_message_time, use it, otherwise keep our optimistic update
                const serverTime = contact.lastMessageTime
                const optimisticTime = prev.find(c => c.id === activeContactId)?.lastMessageTime
                return {
                  ...contact,
                  lastMessage: contact.lastMessage || messageText,
                  lastMessageTime: serverTime || optimisticTime || contact.lastMessageTime
                }
              }
              return contact
            })
          })
        }
      } catch (refreshError) {
        console.error('Failed to refresh contacts', refreshError)
      }
    } catch (error) {
      console.error('Failed to upload media', error)
      // Remove failed message
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      alert(error?.message || 'Failed to upload media')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveMedia = () => {
    setSelectedMedia(null)
    setMediaPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getMediaType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('zip')) return 'document'
    return 'document'
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      mediaCacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      mediaCacheRef.current.clear()
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 bg-[#0d1117] text-white">
      {/* Left Sidebar - Chat List */}
      <aside className="w-64 backdrop-blur-md bg-[#0f141a]/80 border-r border-white/10 p-5 flex flex-col">
        <div className="text-lg font-semibold mb-6">Chats</div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="text"
            placeholder="Search..."
            className="w-full px-3 py-2 pl-10 rounded-lg bg-white/10 border border-white/10 placeholder-white/30 focus:bg-white/20 outline-none transition"
          />
        </div>

        {/* Contact List */}
        <div className="mt-5 space-y-2 overflow-y-auto flex-1">
          {contactsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-white/40 rounded-full" role="status" aria-label="loading">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : contactsError ? (
            <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-4 text-sm text-red-400">
              {contactsError}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-lg bg-white/5 px-4 py-6 text-center text-sm text-white/50">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isActive = contact.id === activeContactId
              const initials = contact.avatar?.slice(0, 2).toUpperCase() || '??'
              return (
                <div
                  key={contact.id}
                  onClick={() => setActiveContactId(contact.id)}
                  className={`flex items-center gap-3 px-3 py-3 rounded-lg cursor-pointer transition ${
                    isActive
                      ? 'bg-white/10 border border-white/10'
                      : 'hover:bg-white/10'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{contact.name}</div>
                    {contact.assignedAgent && (
                      <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                        {contact.assignedAgent}
                      </div>
                    )}
                    <div className="text-xs opacity-50">
                      {contact.lastMessage && (
                        <div className="truncate">{contact.lastMessage}</div>
                      )}
                      {(() => {
                        // Only show time if we have a valid lastMessageTime
                        if (!contact.lastMessageTime) {
                          // Default is empty - show nothing
                          return null
                        }
                        // Try to format the timestamp
                        const formatted = formatFullTimestamp(contact.lastMessageTime) || formatTime(contact.lastMessageTime)
                        if (formatted) {
                          return (
                            <div className={`text-xs opacity-40 ${contact.lastMessage ? 'mt-0.5' : ''}`}>
                              {formatted}
                            </div>
                          )
                        }
                        // If formatting fails, try to parse and display raw date
                        try {
                          const date = new Date(contact.lastMessageTime)
                          if (!isNaN(date.getTime())) {
                            const dateStr = date.toLocaleDateString('en-GB', { 
                              day: '2-digit', 
                              month: 'short', 
                              year: 'numeric'
                            })
                            const timeStr = date.toLocaleTimeString('en-GB', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            })
                            return (
                              <div className={`text-xs opacity-40 ${contact.lastMessage ? 'mt-0.5' : ''}`}>
                                {dateStr} {timeStr}
                              </div>
                            )
                          }
                        } catch (e) {
                          // If all else fails, show nothing (default is empty)
                        }
                        return null
                      })()}
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </aside>

      {/* Middle Chat Window */}
      <main className="flex-1 flex flex-col">
        {!activeContact ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-[#0d1117] text-center px-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-white/10 border border-white/20">
              <MessageCircle className="text-white/40" size={40} />
            </div>
            <div className="flex flex-col items-center gap-2">
              <h3 className="text-lg font-semibold text-white">Select a contact</h3>
              <p className="text-sm text-white/50 max-w-md">
                Choose a contact from the list to view and send messages
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Chat Header */}
            <header className="px-6 py-4 border-b border-white/10 flex items-center gap-3 backdrop-blur-md bg-[#0f141a]/70">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center text-sm font-semibold shrink-0">
                {activeContact.avatar?.slice(0, 2).toUpperCase() || '??'}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-base font-medium">{activeContact.name}</div>
                <div className="text-xs opacity-50">
                  {lastMessageTime ? formatFullTimestamp(lastMessageTime) || formatTime(lastMessageTime) || 'No recent messages' : 'No recent messages'}
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-2">
                <span className="text-sm italic text-white/70 font-medium">Agent :</span>
                <div className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                  activeContact.assignedAgent 
                    ? 'bg-emerald-900 text-emerald-50' 
                    : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {activeContact.assignedAgent || 'Unassigned'}
                </div>
              </div>
            </header>

            {/* Chat Messages */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {messagesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-white/40 rounded-full" role="status" aria-label="loading">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center text-sm text-red-400">
                  {messagesError}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-white/50">
                  No messages yet for this contact
                </div>
              ) : (
                <>
                  {/* Timestamp */}
                  {messages.length > 0 && (
                    <div className="text-center text-xs opacity-40">
                      Today • {formatTime(messages[0]?.timestamp) || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  )}
                  {messages.map((message, index) => {
                    const isCompany = (message.senderType || 'customer') === 'company'
                    const hasMedia = message.mediaType && message.mediaType !== 'none'
                    
                    return (
                      <div
                        key={message.id}
                        className={isCompany ? 'flex justify-end' : 'flex items-start gap-3'}
                      >
                        {!isCompany && (
                          <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center text-xs font-semibold shrink-0">
                            {activeContact.avatar?.slice(0, 1).toUpperCase() || '?'}
                          </div>
                        )}
                        <div
                          className={`px-4 py-3 rounded-xl max-w-lg ${
                            isCompany
                              ? 'bg-emerald-900 text-emerald-50'
                              : 'bg-white/10 border border-white/10'
                          }`}
                        >
                          {hasMedia && (
                            <MessageWithMedia
                              message={message}
                              mediaCacheRef={mediaCacheRef}
                            />
                          )}
                          {message.message && (
                            <p className="whitespace-pre-wrap break-words">{message.message}</p>
                          )}
                          {message.timestamp && (
                            <p className="mt-1 text-[10px] opacity-60 text-right">
                              {new Date(message.timestamp).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              }) + ' ' + formatTime(message.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messageEndRef} />
                </>
              )}
            </div>

            {/* Media Preview */}
            {selectedMedia && (
              <div className="px-6 py-3 border-t border-white/10 backdrop-blur-md bg-[#0f141a]/80">
                <div className="relative rounded-xl border border-white/10 bg-white/5 p-3">
                  <button
                    onClick={handleRemoveMedia}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 text-white/70 hover:text-red-400 transition-colors z-10"
                    title="Remove media"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-3">
                    {mediaPreview ? (
                      <>
                        {getMediaType(selectedMedia.type) === 'image' && (
                          <img
                            src={mediaPreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        )}
                        {getMediaType(selectedMedia.type) === 'video' && (
                          <video
                            src={mediaPreview}
                            className="w-20 h-20 object-cover rounded-lg"
                            muted
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center rounded-lg bg-white/10">
                        <Paperclip size={24} className="text-white/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">
                        {selectedMedia.name}
                      </p>
                      <p className="text-xs opacity-50">
                        {(selectedMedia.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Chat Input */}
            <footer className="p-5 border-t border-white/10 backdrop-blur-md bg-[#0f141a]/80 flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleMediaSelect}
                accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.avi,.webm,.mp3,.wav,.ogg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                className="hidden"
                disabled={!activeContactId || uploading}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!activeContactId || uploading}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Attach media"
              >
                <Paperclip size={20} />
              </button>
              <button
                onClick={() => setShowTemplatePopup(true)}
                disabled={!activeContactId}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title="Templates"
              >
                <FileText size={20} />
              </button>
              <input
                value={messageInput}
                onChange={(event) => setMessageInput(event.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && activeContactId) {
                    if (selectedMedia) {
                      handleMediaUpload()
                    } else if (messageInput.trim()) {
                      handleSend()
                    }
                  }
                }}
                type="text"
                placeholder={selectedMedia ? "Add a caption (optional)..." : "Type a message…"}
                className="flex-1 px-4 py-3 rounded-xl bg-white/10 border border-white/10 placeholder-white/40 focus:bg-white/20 outline-none transition"
                disabled={!activeContactId || uploading}
              />
              <button
                onClick={(e) => {
                  e.preventDefault()
                  if (selectedMedia) {
                    handleMediaUpload()
                  } else {
                    handleSend()
                  }
                }}
                disabled={uploading || !activeContactId || (!messageInput.trim() && !selectedMedia)}
                className="px-5 py-3 rounded-xl bg-emerald-900 hover:bg-emerald-800 transition-all duration-200 font-medium text-emerald-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploading ? (
                  <div className="animate-spin inline-block size-4 border-2 border-current border-t-transparent rounded-full" />
                ) : (
                  'Send'
                )}
              </button>
            </footer>
          </>
        )}
      </main>
      
      <TemplatePopup
        isOpen={showTemplatePopup}
        onClose={() => setShowTemplatePopup(false)}
        onSelectTemplate={handleTemplateSelect}
        activeContactId={activeContactId}
      />
    </div>
  )
}

