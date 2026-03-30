"use client";
import { useState, useCallback } from "react";

const STORAGE_KEY_PREFIX = "acontext_api_key_";
// Compact format body: base64url(0x01 | auth_16B | aes_kw_40B) = 76 chars
const COMPACT_BODY_LENGTH = 76;

/**
 * Check if an API key has a valid prefix.
 */
export function hasValidApiKeyPrefix(key: string, prefix: string): boolean {
  return key.startsWith(prefix);
}

/**
 * Check if an API key is in compact format (supports encryption).
 * Compact keys: prefix + 76-char base64url body.
 * Legacy keys have a different body length and do not support encryption.
 */
export function isCompactApiKey(key: string, prefix: string): boolean {
  return hasValidApiKeyPrefix(key, prefix) && key.length === prefix.length + COMPACT_BODY_LENGTH;
}

export function useApiKeyStorage(projectId: string, apiKeyPrefix: string) {
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

  const hasApiKey = apiKey !== null && apiKey !== "";

  return {
    apiKey,
    hasApiKey,
    hasValidPrefix: hasApiKey && hasValidApiKeyPrefix(apiKey!, apiKeyPrefix),
    isCompactKey: hasApiKey && isCompactApiKey(apiKey!, apiKeyPrefix),
    saveApiKey,
    removeApiKey,
  };
}
