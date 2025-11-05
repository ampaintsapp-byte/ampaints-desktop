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
    };
  }
}

export {};
