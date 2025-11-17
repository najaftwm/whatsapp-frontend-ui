import { useEffect, useState, useRef } from 'react'
import { X, Send, Edit2, FileText, Trash2, Loader2 } from 'lucide-react'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'

const API_BASE = API_BASE_URL
const AUTH_HEADER = AUTH_HEADERS

export default function TemplatePopup({ isOpen, onClose, onSelectTemplate, activeContactId }) {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('ready-made') // 'ready-made' or 'customizable'
  const [editingTemplate, setEditingTemplate] = useState(null)
  const [editContent, setEditContent] = useState('')
  const popupRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      setSearchQuery('')
      setActiveTab('ready-made')
      setEditingTemplate(null)
      setEditContent('')
    }
  }, [isOpen])

  // Close popup when clicking outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event) {
      if (popupRef.current && !popupRef.current.contains(event.target)) {
        onClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onClose])

  const fetchTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/getTemplates.php`, {
        method: 'GET',
        credentials: 'include',
        headers: AUTH_HEADER,
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to load templates')
      }

      setTemplates(data.templates || [])
    } catch (err) {
      setError(err?.message || 'Failed to load templates')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTemplate = async (templateId, e) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      const res = await fetch(`${API_BASE}/deleteTemplate.php`, {
        method: 'DELETE',
        credentials: 'include',
        headers: AUTH_HEADER,
        body: JSON.stringify({ template_id: templateId }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to delete template')
      }

      // Refresh templates
      fetchTemplates()
    } catch (err) {
      alert(err?.message || 'Failed to delete template')
    }
  }

  const handleReadyMadeSend = (template) => {
    if (onSelectTemplate && activeContactId) {
      onSelectTemplate(template.content)
      onClose()
    }
  }

  const handleStartEdit = (template) => {
    setEditingTemplate(template)
    setEditContent(template.content)
  }

  const handleCustomizableSend = () => {
    if (editContent.trim() && onSelectTemplate && activeContactId) {
      onSelectTemplate(editContent.trim())
      onClose()
    }
  }

  const handleCancelEdit = () => {
    setEditingTemplate(null)
    setEditContent('')
  }

  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = 
      template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.content.toLowerCase().includes(searchQuery.toLowerCase())
    
    if (activeTab === 'ready-made') {
      // Ready-made: shared templates or own templates (can be sent directly)
      return matchesSearch && (template.is_shared || template.is_own)
    } else {
      // Customizable: all templates that can be edited
      return matchesSearch
    }
  })

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div 
        ref={popupRef}
        className="relative w-full max-w-4xl max-h-[90vh] bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col m-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700">
          <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
            <FileText size={24} className="text-emerald-500" />
            Message Templates
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-4 border-b border-slate-700">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full px-4 py-2 rounded-xl border border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
          />
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => {
              setActiveTab('ready-made')
              setEditingTemplate(null)
            }}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'ready-made'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            Ready-Made Templates
          </button>
          <button
            onClick={() => {
              setActiveTab('customizable')
              setEditingTemplate(null)
            }}
            className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
              activeTab === 'customizable'
                ? 'text-emerald-400 border-b-2 border-emerald-500 bg-slate-700/50'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/30'
            }`}
          >
            Customizable Templates
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-emerald-500" size={32} />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-rose-900/30 px-4 py-4 text-sm text-rose-400 shadow-sm border border-rose-800/50">
              {error}
            </div>
          ) : editingTemplate ? (
            // Edit mode for customizable template
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Template: {editingTemplate.title}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-slate-600 bg-slate-700 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none"
                  placeholder="Edit template content..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCustomizableSend}
                  disabled={!editContent.trim() || !activeContactId}
                  className="flex-1 px-4 py-2 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <Send size={18} />
                  Send
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 rounded-xl border border-slate-600 bg-slate-700 text-slate-300 font-semibold hover:bg-slate-600 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-xl bg-slate-700 px-4 py-8 text-center text-sm text-slate-400">
              {searchQuery ? 'No templates found matching your search' : 'No templates available'}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-xl border p-4 transition-all ${
                    activeTab === 'ready-made'
                      ? 'border-slate-600 bg-slate-700/50 hover:bg-slate-700 hover:border-emerald-500/50'
                      : 'border-slate-600 bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-slate-100 truncate">
                          {template.title}
                        </h3>
                        {template.is_shared && (
                          <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-xs font-medium border border-blue-500/30">
                            Shared
                          </span>
                        )}
                        {template.is_own && !template.is_shared && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-medium border border-emerald-500/30">
                            Mine
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-300 whitespace-pre-wrap break-words mb-3">
                        {template.content}
                      </p>
                      {template.created_by_name && (
                        <p className="text-xs text-slate-500">
                          Created by: {template.created_by_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeTab === 'ready-made' ? (
                        <button
                          onClick={() => handleReadyMadeSend(template)}
                          disabled={!activeContactId}
                          className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          title="Send template"
                        >
                          <Send size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(template)}
                            className="p-2 rounded-lg bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                            title="Edit and send"
                          >
                            <Edit2 size={18} />
                          </button>
                          {template.is_own && (
                            <button
                              onClick={(e) => handleDeleteTemplate(template.id, e)}
                              className="p-2 rounded-lg bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                              title="Delete template"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

