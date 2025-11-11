import React from 'react'
import * as FM from 'framer-motion'


export default function TypingIndicator() {
const dot = {
animate: { y: [0, -5, 0] },
transition: { repeat: Infinity, duration: 0.7 },
}
return (
<div className="flex items-center space-x-2 px-3 py-2  rounded-2xl shadow-sm">
  <div className="flex items-end space-x-1">
    <FM.motion.span className="w-2 h-2 rounded-full bg-gray-500" {...dot} style={{transitionDelay: '0s'}} />
    <FM.motion.span className="w-2 h-2 rounded-full bg-gray-400" {...dot} style={{transitionDelay: '0.12s'}} />
    <FM.motion.span className="w-2 h-2 rounded-full bg-gray-300" {...dot} style={{transitionDelay: '0.24s'}} />
  </div>
  <span className="text-xs text-gray-600">typing…</span>
</div>
)
}