# Admin Panel Security Guide

## Overview
The admin panel has been enhanced with multiple layers of security to prevent unauthorized access and protect sensitive license operations.

## Security Features

### 1. Admin PIN Protection
**Default PIN:** `0000`

#### How It Works
- Admin panel requires a 4-digit PIN to access
- Default PIN is `0000` for first-time setup
- Can be changed to custom PIN in the PIN tab
- PIN is hashed using scrypt and stored securely
- Never stored in plain text

#### Changing the PIN
1. Go to Admin → PIN tab
2. Enter current PIN (or leave empty if using default)
3. Enter new 4-digit PIN
4. Confirm new PIN
5. Click "Change PIN"

#### PIN Security Features
- ✅ Weak PIN detection (rejects `0000`, `1111`, `1234`, etc. with warning)
- ✅ PIN confirmation required
- ✅ Secure storage using scrypt hashing
- ✅ No plain text storage

---

### 2. Rate Limiting (Brute Force Protection)

#### Settings
- **Maximum Attempts:** 5 failed attempts
- **Lockout Duration:** 15 minutes
- **Scope:** Per IP address

#### How It Works
1. User enters incorrect PIN
2. System tracks failed attempts per IP
3. After 5 failed attempts, account is locked for 15 minutes
4. User sees: "Too many failed attempts. Please wait X minutes."
5. Successful login resets the counter

#### Example
```
Attempt 1: ❌ Invalid PIN (4 remaining)
Attempt 2: ❌ Invalid PIN (3 remaining)
Attempt 3: ❌ Invalid PIN (2 remaining)
Attempt 4: ❌ Invalid PIN (1 remaining)
Attempt 5: ❌ Invalid PIN (0 remaining)
Attempt 6: 🔒 Blocked (wait 15 minutes)
```

---

### 3. License Management Secret Key

**Purpose:** Prevents clients from resetting license expiry dates without authorization.

#### How It Works
- All license operations require a Master Secret Key
- Secret key is **never stored** in database or browser
- Server validates using SHA-256 hash comparison
- Cannot be bypassed by clients

#### Default Secret Key
```
3620192373285
```

#### Customizing Secret Key
See [SECRET-KEY-CONFIGURATION.md](./SECRET-KEY-CONFIGURATION.md) for details.

**Recommended:** Use environment variable
```bash
export MASTER_SECRET_KEY=your_custom_key_here
```

#### Protected Operations
- ✅ Set License Expiry Date
- ✅ Deactivate License
- ✅ Reactivate License

#### Security Guarantees
- **Server-side validation:** Clients cannot bypass by modifying requests
- **Hash-based comparison:** Prevents key extraction from network traffic
- **No storage:** Key must be entered for each operation
- **Audit logging:** All operations are logged server-side

---

## Admin Panel Features

### License Management Tab

#### Current Status Display
- Shows if license is Active/Inactive
- Displays current expiry date
- Status badge for quick reference

#### Operations

**1. Set License Expiry Date**
- Requires: Secret Key + Future Date
- Effect: Software expires on selected date
- Security: Server validates secret key

**2. Deactivate License**
- Requires: Secret Key + Confirmation
- Effect: Software becomes completely unusable
- Warning: Double confirmation required
- Use case: Revoke access for non-payment

**3. Reactivate License**
- Requires: Secret Key
- Effect: Sets expiry to 10 years in future
- Use case: Restore functionality after payment

---

## Security Warnings

### 🔒 Security Protected Banner
The admin panel displays prominent security warnings:

- Secret key is never stored in database or browser
- Key is hashed using SHA-256 before validation
- Without correct secret key, no one can reset expiry dates
- Clients cannot bypass security - it's server-side validated
- Contact administrator if secret key is lost

### ℹ️ Secret Key Information
- Can be set via environment variable `MASTER_SECRET_KEY`
- Default key provided in SECRET-KEY-CONFIGURATION.md
- Never share key publicly
- Rotate keys periodically for security

---

## Logging & Auditing

### PIN Verification Logs
```
[Admin PIN] Verifying PIN attempt (4 attempts remaining)
[Admin PIN] Default PIN verified successfully
[Admin PIN] Rate limit exceeded for 192.168.1.100 - locked out for 15 minutes
```

### License Operation Logs
```
[Admin PIN] Attempting to change master PIN
[Admin PIN] Master PIN changed successfully
License expiry date set to 2025-12-31 with valid secret key
License deactivated by admin with valid secret key
License reactivated with valid secret key
```

---

## Best Practices

### For Administrators
1. ✅ Change default PIN (0000) immediately after setup
2. ✅ Use strong secret key (minimum 10 digits)
3. ✅ Store secret key in secure location (password manager)
4. ✅ Use environment variables for secret key (never hardcode)
5. ✅ Monitor logs for unauthorized access attempts
6. ✅ Rotate secret key periodically
7. ✅ Use different keys for different deployments

### For Deployment
1. ✅ Set `MASTER_ADMIN_PIN` environment variable
2. ✅ Set `MASTER_SECRET_KEY` environment variable
3. ✅ Never commit secrets to version control
4. ✅ Use secure channels for key distribution
5. ✅ Implement IP whitelisting if possible
6. ✅ Enable server-side logging
7. ✅ Regular security audits

---

## Troubleshooting

### Issue: Cannot access admin panel (403 error)
**Solution:**
1. Check default PIN is `0000`
2. Verify you haven't exceeded rate limit (wait 15 minutes)
3. Clear browser cache and try again
4. Check server logs for specific error

### Issue: "Invalid secret key" error
**Solution:**
1. Verify secret key is correct (default: `3620192373285`)
2. Check environment variable `MASTER_SECRET_KEY`
3. Ensure no leading/trailing spaces in key
4. Contact administrator for correct key

### Issue: "Too many failed attempts"
**Solution:**
1. Wait 15 minutes before trying again
2. Check if someone else is attempting access
3. Contact administrator to reset rate limit
4. Verify you're using correct PIN

### Issue: Lost admin PIN
**Solution:**
1. Access database directly
2. Clear `masterPinHash` and `masterPinSalt` from settings table
3. Restart application
4. Default PIN (0000) will work again
5. Set new PIN immediately

### Issue: Lost secret key
**Solution:**
1. Check environment variable `MASTER_SECRET_KEY`
2. Check SECRET-KEY-CONFIGURATION.md for default
3. If changed, check secure key storage
4. Last resort: Reset to default and inform clients

---

## API Endpoints

### POST `/api/license/verify-pin`
**Purpose:** Verify admin PIN for panel access

**Request:**
```json
{
  "masterPin": "0000"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "message": "Master PIN verified"
}
```

**Response (Failed):**
```json
{
  "valid": false,
  "error": "Invalid master PIN",
  "remainingAttempts": 3
}
```

**Response (Rate Limited):**
```json
{
  "valid": false,
  "error": "Too many failed attempts. Please wait 15 minutes.",
  "lockoutTime": 15
}
```

### POST `/api/license/set-expiry`
**Purpose:** Set license expiration date

**Request:**
```json
{
  "expiryDate": "2025-12-31",
  "secretKey": "3620192373285"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "License expiration date set to 2025-12-31",
  "expiryDate": "2025-12-31"
}
```

**Response (Invalid Key):**
```json
{
  "error": "Invalid secret key"
}
```

---

## Testing

### Test Admin PIN
```bash
# Default PIN
curl -X POST http://localhost:3000/api/license/verify-pin \
  -H "Content-Type: application/json" \
  -d '{"masterPin":"0000"}'

# Expected: {"valid":true,"message":"Master PIN verified"}
```

### Test Rate Limiting
```bash
# Make 6 attempts with wrong PIN
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/license/verify-pin \
    -H "Content-Type: application/json" \
    -d '{"masterPin":"9999"}'
  echo ""
done

# 6th attempt should return 429 with lockout message
```

### Test Secret Key
```bash
# Valid secret key
curl -X POST http://localhost:3000/api/license/set-expiry \
  -H "Content-Type: application/json" \
  -d '{"expiryDate":"2025-12-31","secretKey":"3620192373285"}'

# Expected: {"success":true,...}
```

---

## Compliance & Standards

### Security Standards Met
- ✅ **OWASP Top 10:** Protection against brute force attacks
- ✅ **Rate Limiting:** Prevents automated attacks
- ✅ **Secure Hashing:** scrypt for PINs, SHA-256 for secret keys
- ✅ **No Plain Text Storage:** All secrets are hashed
- ✅ **Audit Logging:** All security events are logged
- ✅ **Principle of Least Privilege:** Operations require explicit authorization

---

## Support

For security concerns or questions:
- **Company:** RAYOUX INNOVATIONS PRIVATE LIMITED
- **Contact:** 0300-1204190
- **CEO:** AHSAN KAMRAN

**Important:** Never share secret keys or PINs through unsecured channels (email, SMS, chat).
