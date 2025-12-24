import { useLicense } from "@/hooks/use-license"
import { LicenseBlockedScreen } from "@/components/license-blocked-screen"
import { Loader2 } from "lucide-react"

interface LicenseGuardProps {
  children: React.ReactNode
}

export function LicenseGuard({ children }: LicenseGuardProps) {
  const { isLoading, isBlocked, blockedReason, deviceId, checkLicense } = useLicense()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Verifying license...</p>
        </div>
      </div>
    )
  }

  if (isBlocked) {
    return (
      <LicenseBlockedScreen
        reason={blockedReason}
        deviceId={deviceId}
        onRetry={checkLicense}
      />
    )
  }

  return <>{children}</>
}
