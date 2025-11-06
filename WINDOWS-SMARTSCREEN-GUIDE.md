# Windows SmartScreen Warning - Installation Guide

## Why This Warning Appears

When you try to install PaintPulse, you may see a Windows SmartScreen warning that says:

> **"Windows protected your PC"**  
> Microsoft Defender SmartScreen prevented an unrecognized app from starting.  
> **Publisher: Unknown publisher**

This is **NORMAL** and **SAFE** for unsigned applications. Here's why:

- PaintPulse is not code-signed with a digital certificate
- Code signing certificates cost $200-400/year from Certificate Authorities
- Windows shows this warning for **all** unsigned apps as a security precaution
- **Your app is safe** - this is just a standard Windows security feature

## ✅ How to Install (Immediate Solution)

Follow these steps to install PaintPulse on Windows:

### Step 1: Run the Installer
Double-click `PaintPulse-Setup-0.1.7.exe`

### Step 2: Handle the SmartScreen Warning
When you see the blue warning screen:

1. **Click "More info"** (text link at the top of the dialog)
2. A "Run anyway" button will appear at the bottom
3. **Click "Run anyway"**

![SmartScreen Steps](https://i.imgur.com/example.png)

### Step 3: Complete Installation
- The installer will now run normally
- Choose your installation directory (default is recommended)
- Wait for installation to complete
- Launch PaintPulse from the desktop shortcut or Start Menu

## 🔒 Is This Safe?

**YES!** This warning appears because:
- The app doesn't have an expensive code-signing certificate
- Windows doesn't recognize the publisher (AMPaints)
- It's a **security feature**, not a virus detection

**The app is completely safe:**
- Built with trusted technologies (Electron, React, SQLite)
- No network connections to external servers
- All data stored locally on your computer
- Open source build process

## 📝 For IT Administrators

If you're deploying PaintPulse across multiple computers:

### Option 1: Group Policy
Add PaintPulse to your organization's trusted apps via Group Policy:
- Computer Configuration → Policies → Windows Settings → Security Settings → Application Control Policies

### Option 2: SmartScreen Bypass
Temporarily disable SmartScreen for installation (not recommended for production):
```powershell
Set-ItemProperty -Path "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer" -Name "SmartScreenEnabled" -Value "Off"
```

### Option 3: Create Installation Script
Create a PowerShell script that bypasses SmartScreen for this specific installer:
```powershell
Start-Process -FilePath "PaintPulse-Setup-0.1.7.exe" -ArgumentList "/S" -Wait
```

## 🎯 Future: Getting Code Signed (Optional)

If you want to eliminate this warning for all users, you can purchase a code-signing certificate:

### Requirements
- **Cost**: $200-400/year
- **Providers**: DigiCert, Sectigo, GlobalSign, Comodo
- **Type**: "Code Signing Certificate" for Windows applications
- **Validation**: Business identity verification (3-5 days)

### Benefits
- ✅ No SmartScreen warnings for users
- ✅ Shows your company name as publisher
- ✅ Professional appearance
- ✅ Builds user trust

### How to Apply Code Signing

1. **Purchase Certificate** from a trusted CA
2. **Install Certificate** on your build machine
3. **Update package.json** with signing configuration:

```json
"build": {
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "YOUR_PASSWORD",
    "signingHashAlgorithms": ["sha256"],
    "publisherName": "AMPaints"
  }
}
```

4. **Rebuild** the installer:
```bash
npm run build
npm run build:electron
npm run package:win
```

The signed installer will now show:
- ✅ **Publisher: AMPaints** (verified)
- ✅ No SmartScreen warning
- ✅ "Verified publisher" badge in Windows

## 📞 User Support

If users contact you about this warning:

### Email Template
```
Subject: PaintPulse Installation - Windows Security Warning

Hi [Name],

When installing PaintPulse, Windows may show a security warning. 
This is normal for new applications and is completely safe.

To install:
1. Click "More info" on the warning screen
2. Click "Run anyway"
3. Complete the installation normally

This warning appears because we haven't purchased an expensive 
code-signing certificate yet. Your data and computer are completely safe.

If you have any concerns, please don't hesitate to contact me.

Best regards,
AMPaints Team
```

## 🚀 Alternative Distribution Methods

If SmartScreen warnings are a concern, consider:

1. **Microsoft Store** - Submit to Windows Store (no warnings, but 15% commission)
2. **Web Version** - Deploy as a web app (no installation needed)
3. **Enterprise MSI** - Create MSI package for corporate deployment
4. **Portable Version** - Distribute as ZIP (no installer needed)

## Summary

- ✅ The SmartScreen warning is **normal and safe**
- ✅ Users can bypass it by clicking "More info" → "Run anyway"
- ✅ Code signing is **optional** and costs $200-400/year
- ✅ Your application is secure and trustworthy

---

**Updated**: November 6, 2025  
**Version**: 0.1.7  
**Contact**: AMPaints Support
