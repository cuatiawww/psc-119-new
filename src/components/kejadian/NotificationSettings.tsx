'use client'

import React, { useEffect, useState, useCallback } from 'react'
import { Bell, Volume2, VolumeX, Settings } from 'lucide-react'

type NotificationSettingsProps = {
  onToggleSoundEnabled?: (enabled: boolean) => void
  onToggleAlerts?: (enabled: boolean) => void
  defaultSoundEnabled?: boolean
  defaultAlertsEnabled?: boolean
}

export default function NotificationSettings({
  onToggleSoundEnabled,
  onToggleAlerts,
  defaultSoundEnabled = true,
  defaultAlertsEnabled = true,
}: NotificationSettingsProps) {
  const [soundEnabled, setSoundEnabled] = useState(defaultSoundEnabled)
  const [alertsEnabled, setAlertsEnabled] = useState(defaultAlertsEnabled)
  const [showSettings, setShowSettings] = useState(false)

  const handleToggleSound = useCallback(() => {
    setSoundEnabled(prev => {
      const newValue = !prev
      onToggleSoundEnabled?.(newValue)
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('notification_sound_enabled', String(newValue))
      }
      return newValue
    })
  }, [onToggleSoundEnabled])

  const handleToggleAlerts = useCallback(() => {
    setAlertsEnabled(prev => {
      const newValue = !prev
      onToggleAlerts?.(newValue)
      // Save to localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('notification_alerts_enabled', String(newValue))
      }
      return newValue
    })
  }, [onToggleAlerts])

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSound = localStorage.getItem('notification_sound_enabled')
      const savedAlerts = localStorage.getItem('notification_alerts_enabled')
      if (savedSound !== null) setSoundEnabled(JSON.parse(savedSound))
      if (savedAlerts !== null) setAlertsEnabled(JSON.parse(savedAlerts))
    }
  }, [])

  return (
    <div className="relative">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="relative p-2 hover:bg-slate-100 rounded-lg transition-colors"
        title="Pengaturan Notifikasi"
      >
        <Bell className="h-5 w-5 text-slate-600" />
        {soundEnabled && alertsEnabled && (
          <span className="absolute top-0 right-0 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
        )}
      </button>

      {showSettings && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50">
          <h3 className="font-semibold text-sm text-slate-800 mb-3">Pengaturan Notifikasi</h3>

          <div className="space-y-3">
            {/* Sound Toggle */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Suara Notifikasi</p>
                <p className="text-xs text-slate-500">Nyalakan alert suara</p>
              </div>
              <div
                onClick={handleToggleSound}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  soundEnabled ? 'bg-green-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>

            {/* Alerts Toggle */}
            <label className="flex items-center gap-3 cursor-pointer hover:bg-slate-50 p-2 rounded">
              <div className="flex-1">
                <p className="text-sm font-medium text-slate-700">Visual Alert</p>
                <p className="text-xs text-slate-500">Tampilkan notifikasi visual</p>
              </div>
              <div
                onClick={handleToggleAlerts}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  alertsEnabled ? 'bg-green-500' : 'bg-slate-300'
                }`}
              >
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                    alertsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </label>

            {/* Status Info */}
            <div className="mt-4 p-2 bg-blue-50 border border-blue-100 rounded text-xs text-blue-700">
              <p className="font-semibold mb-1">Status Sinkronisasi</p>
              <p>Data diperbarui setiap 30 detik</p>
            </div>
          </div>

          <button
            onClick={() => setShowSettings(false)}
            className="w-full mt-4 px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded transition-colors"
          >
            Tutup
          </button>
        </div>
      )}
    </div>
  )
}
