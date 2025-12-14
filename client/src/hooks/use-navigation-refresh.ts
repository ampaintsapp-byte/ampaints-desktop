// use-navigation-refresh.ts
import { useState, useCallback } from "react";

// ✅ Custom hook for manual refresh on sidebar clicks
export function useNavigationRefresh() {
  const [refreshKey, setRefreshKey] = useState(0);

  // ✅ This function should be called when sidebar menu is clicked
  const triggerRefresh = useCallback(() => {
    console.log("[DEBUG] Manual refresh triggered via sidebar click");
    
    // 1. Invalidate ALL queries to force fresh data
    import("@tanstack/react-query").then(({ queryClient }) => {
      queryClient.invalidateQueries();
    });
    
    // 2. Increment refresh key to trigger component re-render
    setRefreshKey(prev => prev + 1);
    
    // 3. Optional: Force a mini delay to ensure clean refresh
    setTimeout(() => {
      // Add any additional cleanup if needed
    }, 100);
  }, []);

  return {
    refreshKey,
    triggerRefresh,
  };
}