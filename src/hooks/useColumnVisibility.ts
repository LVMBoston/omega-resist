import { useState, useEffect } from "react";
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

export function useColumnVisibility() {
  const { user } = useAuth();
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(DEFAULT_VISIBILITY);

  // Load visibility from localStorage on mount
  useEffect(() => {
    if (!user?.id) {
      setColumnVisibility(DEFAULT_VISIBILITY);
      return;
    }

    try {
      const storageKey = `eoa-columns-${user.id}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        const parsed = JSON.parse(stored);
        setColumnVisibility(parsed);
      }
    } catch (error) {
      console.error("Failed to load column visibility:", error);
      setColumnVisibility(DEFAULT_VISIBILITY);
    }
  }, [user?.id]);

  // Save visibility to localStorage whenever it changes
  const updateColumnVisibility = (updater: VisibilityState | ((old: VisibilityState) => VisibilityState)) => {
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
  };

  return {
    columnVisibility,
    setColumnVisibility: updateColumnVisibility,
  };
}
