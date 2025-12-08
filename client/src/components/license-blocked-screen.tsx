import { AlertTriangle, Lock, Phone, Mail } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

interface LicenseBlockedScreenProps {
  reason: string | null
  deviceId: string | null
  onRetry: () => void
}

export function LicenseBlockedScreen({ reason, deviceId, onRetry }: LicenseBlockedScreenProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 dark:from-red-950/20 dark:via-orange-950/20 dark:to-yellow-950/20 flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-2 border-red-200 dark:border-red-800 shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-2">
          <div className="mx-auto w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
            <Lock className="h-10 w-10 text-red-600 dark:text-red-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-red-600 dark:text-red-400">
            Software Access Blocked
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-red-800 dark:text-red-200">Access Denied</p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {reason || "Your software access has been temporarily suspended. Please contact the administrator."}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
              If you believe this is an error, please contact your administrator with the following details:
            </p>
            
            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg p-3">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Device ID:</p>
              <p className="font-mono text-sm text-slate-700 dark:text-slate-300 select-all" data-testid="text-device-id">
                {deviceId || "Unknown"}
              </p>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Phone className="h-4 w-4" />
              <span>Contact your software provider</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Mail className="h-4 w-4" />
              <span>Email support for assistance</span>
            </div>
          </div>

          <Button 
            onClick={onRetry} 
            variant="outline" 
            className="w-full"
            data-testid="button-retry-license"
          >
            Check Again
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
