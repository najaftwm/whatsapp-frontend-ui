import React, { useEffect, useRef, useState } from 'react'
import { Smile, Paperclip, Mic, Send } from 'lucide-react'


export default function MessageInput({ onSend }) {
  const [text, setText] = useState('')
  const textareaRef = useRef(null)

  const send = () => {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = Math.min(el.scrollHeight, 160) + 'px'
  }, [text])

  const hasText = !!text.trim()

  return (
    <div className="px-6 h-[70px] bg-(--color-panelElevated) border-t border-(--color-border) flex items-center gap-4">
      <button
        className="p-2 rounded-full text-textSecondary hover:text-textPrimary"
        title="Emoji"
      >
        <Smile size={20} />
      </button>
      <button
        className="p-2 rounded-full text-textSecondary hover:text-textPrimary"
        title="Attach"
      >
        <Paperclip size={20} />
      </button>
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={onKey}
          rows={1}
          className="w-full resize-none px-4 py-3 rounded-xl bg-(--color-inputBg) outline-none hide-scrollbar text-textPrimary placeholder:text-textSecondary text-[15px]"
          placeholder="Type a message"
        />
      </div>
      <button
        onClick={hasText ? send : undefined}
        className={`w-10 h-10 rounded-full grid place-items-center ${hasText ? 'bg-whatsappGreen text-white' : 'text-textSecondary hover:text-textPrimary'}`}
        title={hasText ? 'Send' : 'Voice'}
      >
        {hasText ? <Send size={18} /> : <Mic size={20} />}
      </button>
    </div>
  )
}