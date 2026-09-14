import { useCallback, useRef, useEffect, useState } from 'react'

export type NotificationItem = {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning' | 'alert'
  timestamp: Date
  icon?: React.ReactNode
  read?: boolean
  data?: any
}

export type Notification = {
  id: string
  title: string
  message: string
  type: 'success' | 'error' | 'info' | 'warning'
  duration?: number
  icon?: React.ReactNode
}

type NotificationCallback = (notification: Notification) => void
type NotificationItemCallback = (item: NotificationItem) => void

// Global notification listeners
const notificationListeners = new Set<NotificationCallback>()
const notificationItemListeners = new Set<NotificationItemCallback>()

// Global items storage with LocalStorage persistence
const NOTIFICATION_HISTORY_KEY = 'sipkk_notification_history_v2'

let globalNotificationItems: NotificationItem[] = []
let isItemsInitialized = false

const readStoredNotificationItems = (): NotificationItem[] => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_HISTORY_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((item: any) => ({
      ...item,
      timestamp: new Date(item.timestamp)
    }))
  } catch (e) {
    return []
  }
}

const saveStoredNotificationItems = (items: NotificationItem[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(NOTIFICATION_HISTORY_KEY, JSON.stringify(items.slice(0, 100)))
  } catch (e) {
    // Ignore storage quota errors
  }
}

const initGlobalNotificationItems = () => {
  if (!isItemsInitialized && typeof window !== 'undefined') {
    globalNotificationItems = readStoredNotificationItems()
    isItemsInitialized = true
  }
}

export function useNotification() {
  const notificationIdRef = useRef(0)

  const notify = useCallback((
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    duration: number = 5000
  ): string => {
    const id = `notification-${++notificationIdRef.current}`
    const notification: Notification = {
      id,
      title,
      message,
      type,
      duration,
    }

    // Broadcast to all listeners
    notificationListeners.forEach(listener => listener(notification))

    return id
  }, [])

  const subscribe = useCallback((callback: NotificationCallback) => {
    notificationListeners.add(callback)
    return () => {
      notificationListeners.delete(callback)
    }
  }, [])

  return { notify, subscribe }
}

// Hook for managing notification items (history)
let isPollingStarted = false

export function useNotificationItems() {
  const notificationIdRef = useRef(0)

  const fetchNotifications = useCallback(async () => {
    if (typeof window === 'undefined') return
    initGlobalNotificationItems()
    
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      const res = await fetch('/api/backend/notifications', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
      const data = await res.json()
      if (data.success && Array.isArray(data.notifications)) {
        const items: NotificationItem[] = data.notifications.map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }))

        // Merge strategy: map existing items, update read status, append new ones, keep local items
        const map = new Map<string, NotificationItem>()
        globalNotificationItems.forEach(item => map.set(item.id, item))
        
        items.forEach(item => {
          const existing = map.get(item.id)
          if (existing) {
            map.set(item.id, {
              ...existing,
              ...item,
              read: typeof item.read === 'boolean' ? item.read : existing.read
            })
          } else {
            map.set(item.id, item)
          }
        })

        const merged = Array.from(map.values())
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 100)

        globalNotificationItems = merged
        saveStoredNotificationItems(merged)

        // Broadcast to listeners
        notificationItemListeners.forEach(listener => {
          try {
            listener(null as any)
          } catch (e) {}
        })
      }
    } catch (e) {
      console.error('[fetchNotifications] Failed to fetch notifications:', e)
    }
  }, [])

  // Start global polling on mount
  useEffect(() => {
    const fetchFn = () => {
      void fetchNotifications()
    }
    
    if (!isPollingStarted) {
      isPollingStarted = true
      fetchFn()
      const interval = setInterval(fetchFn, 30000)

      if (typeof window !== 'undefined') {
        window.addEventListener('sipkk-refresh-data', fetchFn)
      }

      return () => {
        clearInterval(interval)
        if (typeof window !== 'undefined') {
          window.removeEventListener('sipkk-refresh-data', fetchFn)
        }
      }
    }
  }, [fetchNotifications])

  const addNotificationItem = useCallback((
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' | 'alert' = 'info',
    data?: any
  ): string => {
    initGlobalNotificationItems()
    const id = data?.kode_trans || `notif-item-${++notificationIdRef.current}`
    
    const existingIndex = globalNotificationItems.findIndex(i => i.id === id)
    let updated: NotificationItem[] = []

    if (existingIndex >= 0) {
      const existing = globalNotificationItems[existingIndex]
      const updatedItem: NotificationItem = {
        ...existing,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false,
        data: data || existing.data,
      }
      updated = [updatedItem, ...globalNotificationItems.filter(i => i.id !== id)].slice(0, 100)
    } else {
      const item: NotificationItem = {
        id,
        title,
        message,
        type,
        timestamp: new Date(),
        read: false,
        data,
      }
      updated = [item, ...globalNotificationItems].slice(0, 100)
    }

    console.log('[addNotificationItem] Adding/updating notification item:', id)
    globalNotificationItems = updated
    saveStoredNotificationItems(updated)

    // Broadcast to all listeners
    notificationItemListeners.forEach(listener => {
      try {
        listener(null as any)
      } catch (e) {}
    })

    return id
  }, [])

  const subscribeToItems = useCallback((callback: NotificationItemCallback) => {
    notificationItemListeners.add(callback)
    return () => {
      notificationItemListeners.delete(callback)
    }
  }, [])

  const getItems = useCallback(() => {
    initGlobalNotificationItems()
    return [...globalNotificationItems]
  }, [])

  const markAsRead = useCallback(async (id: string) => {
    initGlobalNotificationItems()
    // Update local state first
    globalNotificationItems = globalNotificationItems.map(item =>
      item.id === id ? { ...item, read: true } : item
    )
    saveStoredNotificationItems(globalNotificationItems)

    notificationItemListeners.forEach(listener => {
      try {
        listener(null as any)
      } catch (e) {}
    })

    // Send to backend
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      await fetch('/api/backend/read-notification', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ kode_trans: id })
      })
    } catch (e) {
      console.error('[markAsRead] Failed to mark as read:', e)
    }
  }, [])

  const markAllAsRead = useCallback(async () => {
    initGlobalNotificationItems()
    globalNotificationItems = globalNotificationItems.map(item => ({ ...item, read: true }))
    saveStoredNotificationItems(globalNotificationItems)

    notificationItemListeners.forEach(listener => {
      try {
        listener(null as any)
      } catch (e) {}
    })

    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      await fetch('/api/backend/read-all-notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      console.error('[markAllAsRead] Failed to mark all as read:', e)
    }
  }, [])

  const clearAll = useCallback(async () => {
    globalNotificationItems = []
    saveStoredNotificationItems([])

    notificationItemListeners.forEach(listener => {
      try {
        listener(null as any)
      } catch (e) {}
    })

    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    if (!token) return

    try {
      await fetch('/api/backend/read-all-notifications', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })
    } catch (e) {
      console.error('[clearAll] Failed to clear notifications:', e)
    }
  }, [])

  return { addNotificationItem, subscribeToItems, getItems, markAsRead, clearAll, markAllAsRead, fetchNotifications }
}

// Hook for playing notification sound
export function useNotificationSound() {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const playSound = useCallback((type: 'success' | 'error' | 'info' | 'warning' | 'alert' = 'info') => {
    if (typeof window === 'undefined') return

    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (AudioContextClass) {
        const audioContext = new AudioContextClass()
        if (audioContext.state === 'suspended') {
          void audioContext.resume().catch(() => undefined)
        }
        
        const now = audioContext.currentTime
        const oscillator = audioContext.createOscillator()
        const gainNode = audioContext.createGain()

        oscillator.connect(gainNode)
        gainNode.connect(audioContext.destination)

        if (type === 'alert' || type === 'error') {
          // Crisis Siren (Sawtooth wave wailing up and down)
          oscillator.type = 'sawtooth'
          oscillator.frequency.setValueAtTime(450, now)
          
          // Siren modulation: rise and fall 3 times
          oscillator.frequency.linearRampToValueAtTime(850, now + 0.3)
          oscillator.frequency.linearRampToValueAtTime(450, now + 0.6)
          oscillator.frequency.linearRampToValueAtTime(850, now + 0.9)
          oscillator.frequency.linearRampToValueAtTime(450, now + 1.2)
          oscillator.frequency.linearRampToValueAtTime(850, now + 1.5)
          oscillator.frequency.linearRampToValueAtTime(450, now + 1.8)
          
          gainNode.gain.setValueAtTime(0.2, now)
          gainNode.gain.setValueAtTime(0.2, now + 1.5)
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 1.8)
          
          oscillator.start(now)
          oscillator.stop(now + 1.8)
          return
        }

        if (type === 'warning') {
          // Double Urgent Beep
          oscillator.type = 'triangle'
          oscillator.frequency.setValueAtTime(650, now)
          gainNode.gain.setValueAtTime(0.2, now)
          gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
          
          const osc2 = audioContext.createOscillator()
          const gain2 = audioContext.createGain()
          osc2.connect(gain2)
          gain2.connect(audioContext.destination)
          osc2.type = 'triangle'
          osc2.frequency.setValueAtTime(650, now + 0.2)
          gain2.gain.setValueAtTime(0.2, now + 0.2)
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
          
          oscillator.start(now)
          oscillator.stop(now + 0.15)
          osc2.start(now + 0.2)
          osc2.stop(now + 0.35)
          return
        }

        if (type === 'success') {
          // Ascending Chime
          oscillator.type = 'sine'
          oscillator.frequency.setValueAtTime(523.25, now) // C5
          gainNode.gain.setValueAtTime(0.15, now)
          gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.1)
          
          const osc2 = audioContext.createOscillator()
          const gain2 = audioContext.createGain()
          osc2.connect(gain2)
          gain2.connect(audioContext.destination)
          osc2.type = 'sine'
          osc2.frequency.setValueAtTime(659.25, now + 0.08) // E5
          gain2.gain.setValueAtTime(0.15, now + 0.08)
          gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.18)

          const osc3 = audioContext.createOscillator()
          const gain3 = audioContext.createGain()
          osc3.connect(gain3)
          gain3.connect(audioContext.destination)
          osc3.type = 'sine'
          osc3.frequency.setValueAtTime(783.99, now + 0.16) // G5
          gain3.gain.setValueAtTime(0.15, now + 0.16)
          gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.3)
          
          oscillator.start(now)
          oscillator.stop(now + 0.1)
          osc2.start(now + 0.08)
          osc2.stop(now + 0.18)
          osc3.start(now + 0.16)
          osc3.stop(now + 0.3)
          return
        }

        // Info / fallback (Single gentle chime)
        oscillator.type = 'sine'
        oscillator.frequency.setValueAtTime(587.33, now) // D5
        gainNode.gain.setValueAtTime(0.15, now)
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        oscillator.start(now)
        oscillator.stop(now + 0.25)
        return
      }

      if (!audioRef.current) {
        const audio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJCfQAAAAA=')
        audioRef.current = audio
      }
      audioRef.current.currentTime = 0
      audioRef.current.volume = 0.4
      void audioRef.current.play().catch(() => undefined)
    } catch (err) {
      console.error('Failed to play notification sound:', err)
    }
  }, [])

  return { playSound }
}

const SEEN_EVENTS_STORAGE_KEY = 'sipkk-dashboard-seen-events-v1'

const readSeenEventCodes = () => {
  if (typeof window === 'undefined') return []

  try {
    const storedValue = window.localStorage.getItem(SEEN_EVENTS_STORAGE_KEY)
    if (!storedValue) return []

    const parsed = JSON.parse(storedValue)
    return Array.isArray(parsed) ? parsed.filter(Boolean) : []
  } catch {
    return []
  }
}

const writeSeenEventCodes = (codes: string[]) => {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(SEEN_EVENTS_STORAGE_KEY, JSON.stringify(codes))
  } catch {
    // Ignore storage errors to avoid breaking the UI
  }
}

// Hook to detect new events
export function useNewEventDetection(
  currentData: any[],
  onNewEvent?: (newItems: any[]) => void
) {
  const previousDataRef = useRef<any[]>([])
  const hasInitializedRef = useRef(false)
  const [newEvents, setNewEvents] = useState<any[]>([])

  // Store onNewEvent in a ref to avoid dependency-induced re-runs of the detection effect
  const onNewEventRef = useRef(onNewEvent)
  useEffect(() => {
    onNewEventRef.current = onNewEvent
  }, [onNewEvent])

  useEffect(() => {
    if (!currentData || currentData.length === 0) {
      previousDataRef.current = []
      return
    }

    const currentCodes = currentData
      .map(item => item?.kode_trans)
      .filter(Boolean) as string[]

    const seenCodes = new Set(readSeenEventCodes())
    const previousCodes = new Set(previousDataRef.current.map(item => item?.kode_trans).filter(Boolean))

    console.log('[useNewEventDetection] currentData length:', currentData.length)
    console.log('[useNewEventDetection] seenCodes count:', seenCodes.size)

    // A record is new if:
    // 1. It is not in seenCodes (never seen by this user/browser)
    // 2. AND either the hook is already initialized (meaning it arrived in real-time)
    //    OR the event's date is very recent (within 24 hours, allowing for timezone/clock deviations)
    const newItems = currentData.filter(item => {
      const code = item?.kode_trans
      if (!code || seenCodes.has(code)) return false

      if (hasInitializedRef.current) {
        // Real-time addition while the page is already open
        return !previousCodes.has(code)
      } else {
        // Initial page load: alert if the event was created very recently (within 24 hours)
        if (item.tgl_kejadian) {
          try {
            const eventTime = new Date(item.tgl_kejadian).getTime()
            const now = new Date().getTime()
            const diffMinutes = Math.abs(now - eventTime) / (1000 * 60)
            console.log(`[useNewEventDetection] Checking age of initial item ${code}: ${diffMinutes.toFixed(1)} mins`)
            return diffMinutes <= 1440 // 24 hours to cover timezone offsets (e.g. UTC vs WIB)
          } catch (e) {
            return false
          }
        }
        return false
      }
    })

    console.log('[useNewEventDetection] newItems detected:', newItems.length, newItems)

    previousDataRef.current = [...currentData]
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
    }

    // Write all current codes to seen codes so they don't trigger again on subsequent renders
    writeSeenEventCodes(Array.from(new Set([...readSeenEventCodes(), ...currentCodes])))

    if (newItems.length > 0) {
      setNewEvents(newItems)
      onNewEventRef.current?.(newItems)
    }

    return () => {
      // Cleanup if needed
    }
  }, [currentData]) // Only run when currentData changes

  const clearNewEvents = useCallback(() => {
    setNewEvents([])
  }, [])

  return { newEvents, clearNewEvents }
}


