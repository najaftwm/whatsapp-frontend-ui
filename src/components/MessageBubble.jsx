import React from 'react'


function TickIcon({ filled, blue }) {
// simple double tick SVG. `filled` shows two ticks, `blue` colors them.
return (
<svg className={`w-4 h-4 ${blue ? 'text-blue-500' : 'text-gray-400'}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path d="M1 13l4 4L11 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
{filled && <path d="M7 13l4 4L21 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
</svg>
)
}


export default function MessageBubble({ m, isMine }) {
const containerClasses = isMine ? 'justify-end' : 'justify-start'
const bubbleClasses = isMine
? 'bg-(--color-bubbleOutgoing) text-textPrimary rounded-2xl rounded-tr-sm'
: 'bg-(--color-bubbleIncoming) text-textPrimary rounded-2xl rounded-tl-sm'
const paddingClasses = isMine ? 'pl-3 pr-10 py-2' : 'px-3 py-2 pr-6'


return (
<div className={`w-full flex ${containerClasses} mb-3`}>
<div className={`max-w-[65%] ${paddingClasses} ${bubbleClasses} relative`}>
<div className="text-[15px] leading-6 select-text">{m.body}</div>
<div className="text-[11px] mt-1 flex items-center justify-end space-x-1">
<span className="text-textSecondary">{new Date(m.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
{isMine && (
<span className="ml-1">
{m.status === 'sent' && <TickIcon filled={false} blue={false} />}
{m.status === 'delivered' && <TickIcon filled={true} blue={false} />}
{m.status === 'read' && <TickIcon filled={true} blue={true} />}
</span>
)}
</div>
</div>
</div>
)
}