import { type Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import crypto from "crypto";

/**
 * Middleware to verify audit PIN token
 * Checks if the user has provided a valid audit PIN
 */
export function verifyAuditToken(req: Request, res: Response, next: NextFunction) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    
    if (!token) {
      return res.status(401).json({ 
        message: "Audit token required for this operation" 
      });
    }

    // Store token in request for later use
    (req as any).auditToken = token;
    next();
  } catch (error) {
    console.error("[Auth] Error verifying audit token:", error);
    res.status(401).json({ 
      message: "Invalid audit token" 
    });
  }
}

/**
 * Verify audit PIN against stored hash
 */
export async function verifyAuditPin(pin: string): Promise<boolean> {
  try {
    const settings = await storage.getSettings();
    
    if (!settings.auditPinHash || !settings.auditPinSalt) {
      console.warn("[Auth] No audit PIN configured");
      return false;
    }

    // Hash the provided PIN with the stored salt
    const hash = crypto
      .pbkdf2Sync(pin, settings.auditPinSalt, 100000, 64, "sha512")
      .toString("hex");

    return hash === settings.auditPinHash;
  } catch (error) {
    console.error("[Auth] Error verifying audit PIN:", error);
    return false;
  }
}

/**
 * Hash an audit PIN for storage
 */
export function hashAuditPin(pin: string): { hash: string; salt: string } {
  const salt = crypto.randomBytes(32).toString("hex");
  const hash = crypto
    .pbkdf2Sync(pin, salt, 100000, 64, "sha512")
    .toString("hex");

  return { hash, salt };
}
