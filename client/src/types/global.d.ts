// Global type definitions for Electron IPC API

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

export {};
