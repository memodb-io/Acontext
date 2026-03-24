"use client";
import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "acontext_api_key_";

export function useApiKeyStorage(projectId: string) {
  const storageKey = `${STORAGE_KEY_PREFIX}${projectId}`;

  const [apiKey, setApiKeyState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(storageKey);
  });

  const saveApiKey = useCallback(
    (key: string) => {
      localStorage.setItem(storageKey, key);
      setApiKeyState(key);
    },
    [storageKey]
  );

  const removeApiKey = useCallback(() => {
    localStorage.removeItem(storageKey);
    setApiKeyState(null);
  }, [storageKey]);

  return {
    apiKey,
    hasApiKey: apiKey !== null && apiKey !== "",
    saveApiKey,
    removeApiKey,
  };
}
