import { useState, useEffect, useCallback } from "react"
import { apiRequest } from "@/lib/queryClient"

interface LicenseStatus {
  deviceId: string
  status: string
  isBlocked: boolean
  blockedReason: string | null
  blockedAt: string | null
  message: string
}

interface UseLicenseReturn {
  isLoading: boolean
  isBlocked: boolean
  blockedReason: string | null
  deviceId: string | null
  checkLicense: () => Promise<void>
  error: string | null
}

const HEARTBEAT_INTERVAL = 5 * 60 * 1000

function getStoredDeviceId(): string | null {
  try {
    return localStorage.getItem("paintpulse_device_id")
  } catch {
    return null
  }
}

function setStoredDeviceId(deviceId: string): void {
  try {
    localStorage.setItem("paintpulse_device_id", deviceId)
  } catch {
  }
}

function generateDeviceId(): string {
  const random = Math.random().toString(36).substring(2, 15)
  const timestamp = Date.now().toString(36)
  return `${random}${timestamp}`.substring(0, 16)
}

export function useLicense(): UseLicenseReturn {
  const [isLoading, setIsLoading] = useState(true)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkLicense = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)

      let currentDeviceId = getStoredDeviceId()
      if (!currentDeviceId) {
        currentDeviceId = generateDeviceId()
        setStoredDeviceId(currentDeviceId)
      }

      const settingsResponse = await fetch("/api/settings")
      const settings = await settingsResponse.json()
      const storeName = settings.storeName || "PaintPulse"

      const response = await apiRequest("POST", "/api/license/check", {
        deviceId: currentDeviceId,
        deviceName: `Web Browser`,
        storeName,
      })

      const data: LicenseStatus = await response.json()
      
      setDeviceId(data.deviceId)
      setIsBlocked(data.isBlocked)
      setBlockedReason(data.blockedReason)

      if (data.isBlocked) {
        console.warn("[License] Software is blocked:", data.blockedReason)
      }
    } catch (err) {
      console.error("[License] Error checking license:", err)
      setError("Failed to verify license - please check your connection")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    checkLicense()

    const intervalId = setInterval(checkLicense, HEARTBEAT_INTERVAL)

    return () => clearInterval(intervalId)
  }, [checkLicense])

  return {
    isLoading,
    isBlocked,
    blockedReason,
    deviceId,
    checkLicense,
    error,
  }
}
