'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { Notification, useNotification } from '@/hooks/useNotification'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type NotificationContextType = {
  notify: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning', duration?: number) => string
  notifications: Notification[]
  removeNotification: (id: string) => void
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { notify: notifyFn, subscribe } = useNotification()
  const [notifications, setNotifications] = useState<Notification[]>([])

  // Subscribe to global notifications
  useEffect(() => {
    const unsubscribe = subscribe((notification: Notification) => {
      setNotifications(prev => [...prev, notification])

      // Auto-remove after duration
      if (notification.duration) {
        const timer = setTimeout(() => {
          removeNotification(notification.id)
        }, notification.duration)

        return () => clearTimeout(timer)
      }
    })

    return unsubscribe
  }, [subscribe])

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id))
  }, [])

  const notify = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info', duration: number = 5000) => {
      return notifyFn(title, message, type, duration)
    },
    [notifyFn]
  )

  return (
    <NotificationContext.Provider value={{ notify, notifications, removeNotification }}>
      {children}
      <NotificationContainer notifications={notifications} onRemove={removeNotification} />
    </NotificationContext.Provider>
  )
}

export function useNotificationContext() {
  const context = useContext(NotificationContext)
  if (!context) {
    throw new Error('useNotificationContext must be used within NotificationProvider')
  }
  return context
}

// Toast Container Component
function NotificationContainer({
  notifications,
  onRemove,
}: {
  notifications: Notification[]
  onRemove: (id: string) => void
}) {
  return (
    <div className="fixed top-4 right-4 z-[9999] space-y-3 pointer-events-none">
      {notifications.map(notification => (
        <Toast
          key={notification.id}
          notification={notification}
          onClose={() => onRemove(notification.id)}
        />
      ))}
    </div>
  )
}

// Individual Toast Component
function Toast({
  notification,
  onClose,
}: {
  notification: Notification
  onClose: () => void
}) {
  const [isExiting, setIsExiting] = useState(false)

  const handleClose = () => {
    setIsExiting(true)
    setTimeout(onClose, 300)
  }

  const typeConfig = {
    success: {
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: <CheckCircle className="h-5 w-5 text-green-600" />,
      titleColor: 'text-green-800',
      messageColor: 'text-green-700',
    },
    error: {
      bg: 'bg-red-50',
      border: 'border-red-200',
      icon: <AlertCircle className="h-5 w-5 text-red-600" />,
      titleColor: 'text-red-800',
      messageColor: 'text-red-700',
    },
    info: {
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: <Info className="h-5 w-5 text-blue-600" />,
      titleColor: 'text-blue-800',
      messageColor: 'text-blue-700',
    },
    warning: {
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      titleColor: 'text-amber-800',
      messageColor: 'text-amber-700',
    },
  }

  const config = typeConfig[notification.type]

  return (
    <div
      className={`
        pointer-events-auto
        ${config.bg} ${config.border}
        border rounded-lg shadow-lg p-4 max-w-sm
        animate-in fade-in slide-in-from-top-2 duration-300
        ${isExiting ? 'animate-out fade-out slide-out-to-right-2 duration-300' : ''}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 pt-0.5">
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold text-sm ${config.titleColor}`}>
            {notification.title}
          </h3>
          <p className={`text-sm mt-1 ${config.messageColor}`}>
            {notification.message}
          </p>
        </div>
        <button
          onClick={handleClose}
          className={`flex-shrink-0 ${config.titleColor} hover:opacity-75 transition-opacity`}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      {notification.duration && (
        <div className={`h-1 ${config.border} bg-opacity-30 mt-2 rounded-full overflow-hidden`}>
          <div
            className={`h-full ${notification.type === 'success' ? 'bg-green-600' : notification.type === 'error' ? 'bg-red-600' : notification.type === 'warning' ? 'bg-amber-600' : 'bg-blue-600'} rounded-full`}
            style={{
              animation: `shrink ${notification.duration}ms linear forwards`,
            }}
          />
        </div>
      )}

      <style>{`
        @keyframes shrink {
          from {
            width: 100%;
          }
          to {
            width: 0%;
          }
        }
      `}</style>
    </div>
  )
}
