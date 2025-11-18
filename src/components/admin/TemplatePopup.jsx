import { useEffect, useState, useRef } from 'react'
import { X, Send, Edit2, FileText, Trash2, Loader2, Plus } from 'lucide-react'
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
  const [isCreating, setIsCreating] = useState(false)
  const [newTemplateTitle, setNewTemplateTitle] = useState('')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [creating, setCreating] = useState(false)
  const popupRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      fetchTemplates()
      setSearchQuery('')
      setActiveTab('ready-made')
      setEditingTemplate(null)
      setEditContent('')
      setIsCreating(false)
      setNewTemplateTitle('')
      setNewTemplateContent('')
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

  const handleStartCreate = () => {
    setIsCreating(true)
    setEditingTemplate(null)
    setEditContent('')
    setNewTemplateTitle('')
    setNewTemplateContent('')
  }

  const handleCancelCreate = () => {
    setIsCreating(false)
    setNewTemplateTitle('')
    setNewTemplateContent('')
  }

  const handleCreateTemplate = async () => {
    if (!newTemplateTitle.trim() || !newTemplateContent.trim()) {
      setError('Title and content are required')
      return
    }

    setCreating(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/createTemplate.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...AUTH_HEADER,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: newTemplateTitle.trim(),
          content: newTemplateContent.trim(),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to create template')
      }

      // Reset form and refresh templates
      setIsCreating(false)
      setNewTemplateTitle('')
      setNewTemplateContent('')
      await fetchTemplates()
    } catch (err) {
      setError(err?.message || 'Failed to create template')
    } finally {
      setCreating(false)
    }
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
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#0d1117] rounded-2xl shadow-2xl border border-white/10 flex flex-col m-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f141a]/80 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <FileText size={24} className="text-emerald-400" />
            Message Templates
          </h2>
          <div className="flex items-center gap-2">
            {!isCreating && !editingTemplate && (
              <button
                onClick={handleStartCreate}
                className="px-4 py-2 rounded-xl bg-emerald-900 text-emerald-50 font-semibold hover:bg-emerald-800 transition-colors flex items-center gap-2 shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
              >
                <Plus size={18} />
                Create Template
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Search */}
        {!isCreating && !editingTemplate && (
          <div className="px-6 py-4 border-b border-white/10 bg-[#0f141a]/50">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            />
          </div>
        )}

        {/* Tabs */}
        {!isCreating && !editingTemplate && (
          <div className="flex border-b border-white/10">
            <button
              onClick={() => {
                setActiveTab('ready-made')
                setEditingTemplate(null)
                setIsCreating(false)
              }}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'ready-made'
                  ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-900/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Ready-Made Templates
            </button>
            <button
              onClick={() => {
                setActiveTab('customizable')
                setEditingTemplate(null)
                setIsCreating(false)
              }}
              className={`flex-1 px-6 py-3 text-sm font-semibold transition-colors ${
                activeTab === 'customizable'
                  ? 'text-emerald-400 border-b-2 border-emerald-500 bg-emerald-900/20'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              Customizable Templates
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 bg-[#0d1117]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
            </div>
          ) : error ? (
            <div className="rounded-xl bg-rose-900/30 px-4 py-4 text-sm text-rose-400 shadow-sm border border-rose-800/50">
              {error}
            </div>
          ) : isCreating ? (
            // Create mode for new template
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Template Title
                </label>
                <input
                  type="text"
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
                  placeholder="Enter template title..."
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Template Content
                </label>
                <textarea
                  value={newTemplateContent}
                  onChange={(e) => setNewTemplateContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none transition-all"
                  placeholder="Enter template content..."
                />
              </div>
              {error && (
                <div className="rounded-xl bg-rose-900/30 px-4 py-3 text-sm text-rose-400 border border-rose-800/50">
                  {error}
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={handleCreateTemplate}
                  disabled={!newTemplateTitle.trim() || !newTemplateContent.trim() || creating}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-900 text-emerald-50 font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
                >
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={18} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus size={18} />
                      Create Template
                    </>
                  )}
                </button>
                <button
                  onClick={handleCancelCreate}
                  disabled={creating}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : editingTemplate ? (
            // Edit mode for customizable template
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white/70 mb-2">
                  Template: {editingTemplate.title}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none transition-all"
                  placeholder="Edit template content..."
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCustomizableSend}
                  disabled={!editContent.trim() || !activeContactId}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-900 text-emerald-50 font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
                >
                  <Send size={18} />
                  Send
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-8 text-center text-sm text-white/50">
              {searchQuery ? 'No templates found matching your search' : 'No templates available'}
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className={`rounded-xl border p-4 transition-all ${
                    activeTab === 'ready-made'
                      ? 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-emerald-500/50 cursor-pointer'
                      : 'border-white/10 bg-white/5 hover:bg-white/10'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-sm font-semibold text-white truncate">
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
                      <p className="text-sm text-white/70 whitespace-pre-wrap break-words mb-3">
                        {template.content}
                      </p>
                      {template.created_by_name && (
                        <p className="text-xs text-white/50">
                          Created by: {template.created_by_name}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {activeTab === 'ready-made' ? (
                        <button
                          onClick={() => handleReadyMadeSend(template)}
                          disabled={!activeContactId}
                          className="p-2 rounded-lg bg-emerald-900 text-emerald-50 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
                          title="Send template"
                        >
                          <Send size={18} />
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStartEdit(template)}
                            className="p-2 rounded-lg bg-blue-900/40 text-blue-300 hover:bg-blue-900/60 transition-colors border border-blue-800/30"
                            title="Edit and send"
                          >
                            <Edit2 size={18} />
                          </button>
                          {template.is_own && (
                            <button
                              onClick={(e) => handleDeleteTemplate(template.id, e)}
                              className="p-2 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 transition-colors border border-rose-500/30 hover:border-rose-500/50"
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

