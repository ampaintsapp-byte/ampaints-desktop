import { contextBridge, ipcRenderer } from "electron";

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electron", {
  // Database operations
  getDatabasePath: () => ipcRenderer.invoke("get-database-path"),
  selectDatabaseLocation: () => ipcRenderer.invoke("select-database-location"),
  exportDatabase: () => ipcRenderer.invoke("export-database"),
  importDatabase: () => ipcRenderer.invoke("import-database"),
  // Activation operations
  getActivationStatus: () => ipcRenderer.invoke("get-activation-status"),
  setActivationStatus: (status: boolean) => ipcRenderer.invoke("set-activation-status", status),
  // WhatsApp PDF sharing
  sharePdfToWhatsApp: (data: { pdfBase64: string; fileName: string; phoneNumber: string }) => 
    ipcRenderer.invoke("share-pdf-to-whatsapp", data),
  savePdfToDocuments: (data: { pdfBase64: string; fileName: string }) => 
    ipcRenderer.invoke("save-pdf-to-documents", data),
});

// Add type definitions for TypeScript
declare global {
  interface Window {
    electron?: {
      getDatabasePath: () => Promise<string>;
      selectDatabaseLocation: () => Promise<string | null>;
      exportDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      importDatabase: () => Promise<{ success: boolean; path?: string; error?: string }>;
      getActivationStatus: () => Promise<boolean>;
      setActivationStatus: (status: boolean) => Promise<boolean>;
      sharePdfToWhatsApp: (data: { pdfBase64: string; fileName: string; phoneNumber: string }) => 
        Promise<{ success: boolean; path?: string; message?: string; error?: string }>;
      savePdfToDocuments: (data: { pdfBase64: string; fileName: string }) => 
        Promise<{ success: boolean; path?: string; error?: string }>;
    };
  }
}
