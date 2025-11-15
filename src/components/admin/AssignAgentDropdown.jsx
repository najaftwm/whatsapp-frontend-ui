import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import useAgents from './hooks/useAgents'

export default function AssignAgentDropdown({ contactId, onAssign, isOpen, onClose, buttonRef }) {
  const {
    agents,
    loading: agentsLoading,
    error: agentsError,
    refresh: refreshAgents,
  } = useAgents()
  const [isAssigning, setIsAssigning] = useState(false)
  const [message, setMessage] = useState(null)
  const [position, setPosition] = useState({ top: 0, right: 0 })
  const dropdownRef = useRef(null)

  useEffect(() => {
    if (!isOpen || !buttonRef?.current) {
      setMessage(null)
      return undefined
    }

    // Refresh agents list when dropdown opens
    refreshAgents()

    function updatePosition() {
      if (buttonRef?.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setPosition({
          top: rect.bottom + window.scrollY + 8,
          right: window.innerWidth - rect.right + window.scrollX,
        })
      }
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    function handleClickOutside(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, onClose, buttonRef, refreshAgents])

  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 3000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [message])

  const handleAssign = async (agentId) => {
    if (!contactId || !agentId) {
      console.error('AssignAgentDropdown: Missing IDs', { contactId, agentId })
      return
    }
    
    console.log('AssignAgentDropdown: Starting assignment', { contactId, agentId })
    setIsAssigning(true)
    setMessage(null)
    try {
      await onAssign(contactId, agentId)
      console.log('AssignAgentDropdown: Assignment successful')
      setMessage({ type: 'success', text: 'Agent assigned successfully' })
      setTimeout(() => {
        onClose()
      }, 1000)
    } catch (error) {
      console.error('AssignAgentDropdown: Assignment failed', error)
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to assign agent',
      })
    } finally {
      setIsAssigning(false)
    }
  }

  if (!isOpen) return null

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className="fixed z-9999 w-64 overflow-hidden rounded-2xl border border-slate-700 bg-slate-800 shadow-xl"
      style={{
        top: `${position.top}px`,
        right: `${position.right}px`,
      }}
    >
      <div className="border-b border-slate-700 bg-slate-700/50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Select Agent
      </div>
      <div className="max-h-60 overflow-y-auto">
        {agentsLoading ? (
          <div className="flex items-center justify-center px-4 py-3">
            <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : agentsError ? (
          <div className="px-4 py-3 text-sm text-rose-400">
            <p>{agentsError}</p>
            <button
              onClick={() => refreshAgents()}
              className="mt-2 text-xs font-semibold text-emerald-400 hover:text-emerald-300 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : agents.length === 0 ? (
          <div className="px-4 py-3 text-sm text-slate-400">No agents available</div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => handleAssign(agent.id)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left text-sm transition hover:bg-emerald-500/10 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
              disabled={isAssigning}
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 text-xs font-semibold">
                {agent.name?.slice(0, 2).toUpperCase() || 'AG'}
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-100">{agent.name}</span>
                {agent.email && <span className="text-xs text-slate-400">{agent.email}</span>}
              </div>
            </button>
          ))
        )}
      </div>
      {message && (
        <div
          className={`px-4 py-3 text-xs font-semibold ${
            message.type === 'success'
              ? 'bg-emerald-500/20 text-emerald-300'
              : 'bg-rose-900/30 text-rose-400'
          }`}
        >
          {message.text}
        </div>
      )}
    </div>
  )

  return createPortal(dropdownContent, document.body)
}

