import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { VisibilityState } from "@tanstack/react-table";

const DEFAULT_VISIBILITY: VisibilityState = {
  mobilize_code: true,
  utm_id: true,
  title: true,
  site_name: true,
  city: true,
  state: true,
  zip_code: true,
  type: true,
  start_date: true,
  end_date: true,
  timezone: true,
  assigned_deck_slug: true,
  status: true,
  l00_token: true,
};

// Helper to load visibility from localStorage
const loadColumnVisibility = (userId: string | undefined): VisibilityState => {
  if (!userId) return DEFAULT_VISIBILITY;
  
  try {
    const storageKey = `eoa-columns-${userId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error("Failed to load column visibility:", error);
  }
  
  return DEFAULT_VISIBILITY;
};

export function useColumnVisibility() {
  const { user } = useAuth();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(() => 
    loadColumnVisibility(user?.id)
  );

  // Save visibility to localStorage whenever it changes
  const updateColumnVisibility = useCallback((updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
    setColumnVisibility((prev) => {
      const newState = typeof updater === "function" ? updater(prev) : updater;
      
      if (user?.id) {
        try {
          const storageKey = `eoa-columns-${user.id}`;
          localStorage.setItem(storageKey, JSON.stringify(newState));
        } catch (error) {
          console.error("Failed to save column visibility:", error);
        }
      }
      
      return newState;
    });
  }, [user?.id]);

  return {
    columnVisibility,
    setColumnVisibility: updateColumnVisibility,
  };
}
