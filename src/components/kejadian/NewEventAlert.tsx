'use client'

import React, { useEffect, useState } from 'react'
import { AlertTriangle, Bell, X } from 'lucide-react'
import { useNotificationSound, useNewEventDetection } from '@/hooks/useNotification'
import { formatDisasterName } from '@/lib/utils/disasterUtils'

type NewEventAlertProps = {
  events: any[]
  onDismiss?: () => void
}

export default function NewEventAlert({ events, onDismiss }: NewEventAlertProps) {
  const { playSound } = useNotificationSound()
  const [isVisible, setIsVisible] = useState(false)
  const [displayEvents, setDisplayEvents] = useState<any[]>([])

  useEffect(() => {
    if (events.length > 0) {
      setDisplayEvents(events)
      setIsVisible(true)
      // Play notification sound
      playSound('warning')
    }
  }, [events, playSound])

  const handleDismiss = () => {
    setIsVisible(false)
    onDismiss?.()
  }

  if (!isVisible || displayEvents.length === 0) {
    return null
  }

  return (
    <div className="fixed top-20 left-0 right-0 z-[9998] flex justify-center pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl mx-4">
        <div className="animate-in fade-in slide-in-from-top-4 duration-300 bg-gradient-to-r from-red-600 to-orange-600 border border-red-700 rounded-lg shadow-2xl overflow-hidden">
          <div className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="flex-shrink-0 pt-0.5">
                  <div className="animate-pulse">
                    <Bell className="h-6 w-6 text-white" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-lg text-white">
                    ⚠️ LAPORAN KEJADIAN BARU TERDETEKSI!
                  </h3>
                  <div className="mt-2 space-y-1">
                    {displayEvents.map((event, idx) => (
                      <div key={`${event.kode_trans}-${idx}`} className="text-sm text-red-50">
                        <p className="font-semibold">
                          {idx + 1}. {formatDisasterName(event.jenis_bencana)}
                        </p>
                        <p className="text-xs opacity-90">
                          📍 {event.kabupaten || event.provinsi || 'Lokasi tidak diketahui'} • 
                          👥 {event.total_korban || 0} korban
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={handleDismiss}
                className="flex-shrink-0 text-white hover:bg-white/20 rounded-lg p-1 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Animated bottom border */}
          <div className="h-1 bg-gradient-to-r from-red-400 via-orange-400 to-red-400 animate-pulse" />
        </div>
      </div>
    </div>
  )
}
