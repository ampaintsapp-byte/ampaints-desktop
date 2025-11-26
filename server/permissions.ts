import { storage } from "./storage";
import type { Request, Response, NextFunction } from "express";
import type { Settings } from "@shared/schema";

export type AppPerm = 
  | 'stock:edit' 
  | 'stock:delete' 
  | 'stockHistory:delete'
  | 'sales:edit' 
  | 'sales:delete' 
  | 'payment:edit' 
  | 'payment:delete';

let permsCache: {
  perms: Record<AppPerm, boolean>;
  loadedAt: number;
} | null = null;

const CACHE_TTL_MS = 10000;

function mapSettingsToPerms(s: Settings | null): Record<AppPerm, boolean> {
  return {
    'stock:edit': s?.permStockEdit ?? true,
    'stock:delete': s?.permStockDelete ?? true,
    'stockHistory:delete': s?.permStockHistoryDelete ?? true,
    'sales:edit': s?.permSalesEdit ?? true,
    'sales:delete': s?.permSalesDelete ?? true,
    'payment:edit': s?.permPaymentEdit ?? true,
    'payment:delete': s?.permPaymentDelete ?? true,
  };
}

export async function getPermsCached(): Promise<Record<AppPerm, boolean>> {
  const now = Date.now();
  if (permsCache && (now - permsCache.loadedAt) < CACHE_TTL_MS) {
    return permsCache.perms;
  }
  
  const settings = await storage.getSettings();
  const perms = mapSettingsToPerms(settings);
  permsCache = { perms, loadedAt: now };
  return perms;
}

export function invalidatePermCache(): void {
  permsCache = null;
}

export function requirePerm(...requiredPerms: AppPerm[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const perms = await getPermsCached();
      
      for (const perm of requiredPerms) {
        if (!perms[perm]) {
          return res.status(403).json({
            error: 'Forbidden',
            code: 'PERMISSION_DENIED',
            permission: perm,
            message: `You do not have permission to perform this action. Required: ${perm}`
          });
        }
      }
      
      next();
    } catch (error) {
      console.error("[Permissions] Error checking permissions:", error);
      next(error);
    }
  };
}
