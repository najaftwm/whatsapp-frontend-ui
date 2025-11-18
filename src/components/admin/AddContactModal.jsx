import { useState, useEffect, useRef } from 'react'
import { X, UserPlus, Loader2, AlertCircle, User, Phone, ExternalLink } from 'lucide-react'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'

export default function AddContactModal({ isOpen, onClose, onContactCreated, onNavigateToContact }) {
  const [name, setName] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('+91')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [existingContact, setExistingContact] = useState(null)
  const modalRef = useRef(null)

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setName('')
      setPhoneNumber('+91')
      setError('')
      setExistingContact(null)
    }
  }, [isOpen])

  // Close modal when clicking outside
  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event) {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        handleClose()
      }
    }

    function handleEscape(event) {
      if (event.key === 'Escape') {
        handleClose()
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  const handleClose = () => {
    if (!loading) {
      setName('')
      setPhoneNumber('+91')
      setError('')
      setExistingContact(null)
      onClose()
    }
  }

  const handleNavigateToContact = () => {
    if (existingContact && onNavigateToContact) {
      onNavigateToContact(existingContact.id)
      handleClose()
    }
  }

  const validatePhoneNumber = (phone) => {
    // Remove any spaces or dashes for validation
    const cleaned = phone.replace(/[\s-]/g, '')
    // Must start with +91 and have exactly 10 digits after (total 13 characters)
    return /^\+91[0-9]{10}$/.test(cleaned)
  }

  const handlePhoneChange = (e) => {
    const value = e.target.value
    
    // Always ensure it starts with +91
    if (!value.startsWith('+91')) {
      // If user tries to delete +91, prevent it
      if (value.length < 3) {
        setPhoneNumber('+91')
        return
      }
      // If user pastes something without +91, add it
      const digitsOnly = value.replace(/\D/g, '')
      if (digitsOnly.length > 0) {
        setPhoneNumber('+91' + digitsOnly.slice(0, 10))
        if (error) setError('')
        return
      }
      setPhoneNumber('+91')
      return
    }
    
    // Extract only digits after +91 (max 10 digits)
    const afterPlus91 = value.slice(3).replace(/\D/g, '').slice(0, 10)
    setPhoneNumber('+91' + afterPlus91)
    
    // Clear error when user starts typing
    if (error) setError('')
  }

  const handlePhoneKeyDown = (e) => {
    // Prevent deletion of +91 prefix
    const input = e.target
    const cursorPosition = input.selectionStart
    
    // If cursor is before or within +91, prevent backspace/delete
    if (cursorPosition <= 3 && (e.key === 'Backspace' || e.key === 'Delete')) {
      e.preventDefault()
      // Move cursor to after +91
      setTimeout(() => {
        input.setSelectionRange(3, 3)
      }, 0)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Clean phone number (remove spaces and dashes)
    const cleanedPhone = phoneNumber.replace(/[\s-]/g, '')

    // Validate phone number
    if (!cleanedPhone.trim() || cleanedPhone === '+91') {
      setError('Please enter a 10-digit phone number after +91')
      return
    }

    if (!validatePhoneNumber(cleanedPhone)) {
      setError('Invalid phone number format. Please enter exactly 10 digits after +91 (e.g., +919876543210)')
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`${API_BASE_URL}/createContact.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          ...AUTH_HEADERS,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim() || null, // Send null if empty string
          phone_number: cleanedPhone,
        }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        // Handle specific error cases - duplicate contact
        if (res.status === 409 && data?.existing_contact) {
          setExistingContact(data.existing_contact)
          setError('DUPLICATE_CONTACT') // Special error code to show detailed UI
          return
        }
        throw new Error(data?.error || `Failed to create contact (${res.status})`)
      }

      if (data?.ok !== true) {
        throw new Error(data?.error || 'Failed to create contact')
      }

      // Success - notify parent and close modal
      if (onContactCreated) {
        onContactCreated(data.contact)
      }
      handleClose()
    } catch (err) {
      setError(err?.message || 'Failed to create contact. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="relative w-full max-w-md bg-[#0d1117] rounded-2xl shadow-2xl border border-white/10 m-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f141a]/80 backdrop-blur-md">
          <h2 className="text-xl font-semibold text-white flex items-center gap-2">
            <UserPlus size={24} className="text-emerald-400" />
            Add New Contact
          </h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Duplicate Contact Warning */}
          {error === 'DUPLICATE_CONTACT' && existingContact && (
            <div className="rounded-xl bg-amber-900/30 px-4 py-4 text-sm border border-amber-800/50 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle size={18} className="shrink-0 mt-0.5 text-amber-400" />
                <div className="flex-1">
                  <p className="text-amber-400 font-semibold mb-2">
                    Contact Already Exists
                  </p>
                  <p className="text-amber-300/90 mb-3">
                    A contact with this phone number already exists in the system. An agent may already be speaking to this contact.
                  </p>
                  
                  {/* Existing Contact Details */}
                  <div className="bg-white/5 rounded-lg p-3 space-y-2 border border-white/10">
                    <div className="flex items-center gap-2 text-white/90">
                      <User size={16} className="text-amber-400" />
                      <span className="font-medium">
                        {existingContact.name || 'Unnamed Contact'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-white/70 text-xs">
                      <Phone size={14} className="text-amber-400/70" />
                      <span>{existingContact.phone_number}</span>
                    </div>
                    {existingContact.id && (
                      <div className="text-xs text-white/60 pt-1 border-t border-white/10">
                        Contact ID: {existingContact.id}
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    type="button"
                    onClick={handleNavigateToContact}
                    className="w-full mt-3 px-4 py-2.5 rounded-xl bg-emerald-900 text-emerald-50 font-semibold hover:bg-emerald-800 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
                  >
                    <ExternalLink size={16} />
                    View Existing Contact
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Regular Error Message */}
          {error && error !== 'DUPLICATE_CONTACT' && (
            <div className="rounded-xl bg-rose-900/30 px-4 py-3 text-sm text-rose-400 border border-rose-800/50 flex items-start gap-2">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <span className="flex-1">{error}</span>
            </div>
          )}

          {/* Name Field */}
          <div>
            <label htmlFor="contact-name" className="block text-sm font-semibold text-white/70 mb-2">
              Name <span className="text-white/40 font-normal">(Optional)</span>
            </label>
            <input
              id="contact-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter contact name..."
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
              disabled={loading}
            />
          </div>

          {/* Phone Number Field */}
          <div>
            <label htmlFor="contact-phone" className="block text-sm font-semibold text-white/70 mb-2">
              Phone Number <span className="text-rose-400">*</span>
            </label>
            <input
              id="contact-phone"
              type="text"
              value={phoneNumber}
              onChange={handlePhoneChange}
              onKeyDown={handlePhoneKeyDown}
              onFocus={(e) => {
                // Move cursor to end if clicking on +91
                if (e.target.selectionStart <= 3) {
                  e.target.setSelectionRange(3, 3)
                }
              }}
              placeholder="+91XXXXXXXXXX"
              className="w-full px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white placeholder:text-white/40 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
              disabled={loading}
              required
            />
            <p className="mt-1.5 text-xs text-white/50">
              Format: +91XXXXXXXXXX (10 digits after +91)
            </p>
          </div>

          {/* Action Buttons */}
          {error !== 'DUPLICATE_CONTACT' && (
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !phoneNumber.trim() || phoneNumber === '+91' || phoneNumber.length < 13}
                className="flex-1 px-4 py-3 rounded-xl bg-emerald-900 text-emerald-50 font-semibold hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 border border-emerald-800/30"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" size={18} />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Create Contact
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="px-4 py-3 rounded-xl border border-white/10 bg-white/5 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          )}

          {/* Close button when duplicate is shown */}
          {error === 'DUPLICATE_CONTACT' && (
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/70 font-semibold hover:bg-white/10 hover:text-white transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  )
}

