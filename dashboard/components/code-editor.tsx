"use client";

import { useTheme } from "next-themes";
import { useState, useEffect, useMemo } from "react";
import ReactCodeMirror from "@uiw/react-codemirror";
import { okaidia } from "@uiw/codemirror-theme-okaidia";
import { EditorView } from "@codemirror/view";
import { Extension } from "@codemirror/state";
import { cn } from "@/lib/utils";

export type CodeEditorLanguage =
  | "json"
  | "javascript"
  | "typescript"
  | "python"
  | "html"
  | "css"
  | "markdown"
  | "xml"
  | "sql"
  | "yaml"
  | "shell"
  | "go"
  | "rust"
  | "ruby"
  | "auto";

interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language?: CodeEditorLanguage;
  contentType?: string | null;
  filename?: string;
  height?: string;
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  extensions?: Extension[];
  lineWrapping?: boolean;
}

// Language loader cache to avoid re-importing
const languageCache = new Map<string, Extension[]>();

// Dynamic language loader - only loads the language when needed
async function loadLanguageExtension(lang: string): Promise<Extension[]> {
  if (languageCache.has(lang)) {
    return languageCache.get(lang)!;
  }

  let extensions: Extension[] = [];

  try {
    switch (lang) {
      case "json": {
        const { json } = await import("@codemirror/lang-json");
        extensions = [json()];
        break;
      }
      case "javascript":
      case "jsx": {
        const { javascript } = await import("@codemirror/lang-javascript");
        extensions = [javascript({ jsx: true })];
        break;
      }
      case "typescript":
      case "tsx": {
        const { javascript } = await import("@codemirror/lang-javascript");
        extensions = [javascript({ typescript: true, jsx: lang === "tsx" })];
        break;
      }
      case "python": {
        const { python } = await import("@codemirror/lang-python");
        extensions = [python()];
        break;
      }
      case "html": {
        const { html } = await import("@codemirror/lang-html");
        extensions = [html()];
        break;
      }
      case "css": {
        const { css } = await import("@codemirror/lang-css");
        extensions = [css()];
        break;
      }
      case "markdown": {
        const { markdown } = await import("@codemirror/lang-markdown");
        extensions = [markdown()];
        break;
      }
      case "xml": {
        const { xml } = await import("@codemirror/lang-xml");
        extensions = [xml()];
        break;
      }
      case "sql": {
        const { sql } = await import("@codemirror/lang-sql");
        extensions = [sql()];
        break;
      }
      case "yaml": {
        const { StreamLanguage } = await import("@codemirror/language");
        const { yaml } = await import("@codemirror/legacy-modes/mode/yaml");
        extensions = [StreamLanguage.define(yaml)];
        break;
      }
      case "shell":
      case "bash":
      case "zsh": {
        const { StreamLanguage } = await import("@codemirror/language");
        const { shell } = await import("@codemirror/legacy-modes/mode/shell");
        extensions = [StreamLanguage.define(shell)];
        break;
      }
      case "go": {
        const { StreamLanguage } = await import("@codemirror/language");
        const { go } = await import("@codemirror/legacy-modes/mode/go");
        extensions = [StreamLanguage.define(go)];
        break;
      }
      case "rust": {
        const { StreamLanguage } = await import("@codemirror/language");
        const { rust } = await import("@codemirror/legacy-modes/mode/rust");
        extensions = [StreamLanguage.define(rust)];
        break;
      }
      case "ruby": {
        const { StreamLanguage } = await import("@codemirror/language");
        const { ruby } = await import("@codemirror/legacy-modes/mode/ruby");
        extensions = [StreamLanguage.define(ruby)];
        break;
      }
    }
  } catch (error) {
    console.warn(`Failed to load language extension for ${lang}:`, error);
  }

  languageCache.set(lang, extensions);
  return extensions;
}

// Detect language from content type
function detectLanguageFromContentType(contentType: string): string | null {
  const type = contentType.toLowerCase();
  if (type.includes("json")) return "json";
  if (type.includes("javascript") || type.includes("js")) return "javascript";
  if (type.includes("typescript") || type.includes("ts")) return "typescript";
  if (type.includes("python") || type.includes("py")) return "python";
  if (type.includes("html")) return "html";
  if (type.includes("css")) return "css";
  if (type.includes("markdown") || type.includes("md")) return "markdown";
  if (type.includes("xml")) return "xml";
  if (type.includes("sql")) return "sql";
  if (type.includes("yaml") || type.includes("yml")) return "yaml";
  if (type.includes("shell") || type.includes("bash") || type.includes("sh")) return "shell";
  if (type.includes("go")) return "go";
  if (type.includes("rust") || type.includes("rs")) return "rust";
  if (type.includes("ruby") || type.includes("rb")) return "ruby";
  return null;
}

// Detect language from filename extension
function detectLanguageFromFilename(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "json":
      return "json";
    case "js":
    case "jsx":
    case "mjs":
      return "jsx";
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "py":
      return "python";
    case "html":
    case "htm":
      return "html";
    case "css":
      return "css";
    case "md":
    case "markdown":
      return "markdown";
    case "xml":
      return "xml";
    case "sql":
      return "sql";
    case "yaml":
    case "yml":
      return "yaml";
    case "sh":
    case "bash":
    case "zsh":
      return "shell";
    case "go":
      return "go";
    case "rs":
      return "rust";
    case "rb":
      return "ruby";
    default:
      return null;
  }
}

export function CodeEditor({
  value,
  onChange,
  language = "auto",
  contentType,
  filename,
  height = "200px",
  readOnly = false,
  placeholder,
  className,
  extensions = [],
  lineWrapping = true,
}: CodeEditorProps) {
  const { resolvedTheme } = useTheme();
  const [languageExtensions, setLanguageExtensions] = useState<Extension[]>([]);

  // Determine the target language
  const targetLanguage = useMemo(() => {
    if (language !== "auto") {
      return language;
    }
    if (contentType) {
      const detected = detectLanguageFromContentType(contentType);
      if (detected) return detected;
    }
    if (filename) {
      const detected = detectLanguageFromFilename(filename);
      if (detected) return detected;
    }
    return null;
  }, [language, contentType, filename]);

  // Load language extension dynamically
  useEffect(() => {
    let mounted = true;

    if (targetLanguage) {
      loadLanguageExtension(targetLanguage).then((exts) => {
        if (mounted) {
          setLanguageExtensions(exts);
        }
      });
    } else {
      setLanguageExtensions([]);
    }

    return () => {
      mounted = false;
    };
  }, [targetLanguage]);

  // Combine all extensions
  const allExtensions = useMemo(() => {
    return [
      ...languageExtensions,
      ...extensions,
      ...(lineWrapping ? [EditorView.lineWrapping] : []),
    ];
  }, [languageExtensions, extensions, lineWrapping]);

  return (
    <ReactCodeMirror
      value={value}
      height={height}
      theme={resolvedTheme === "dark" ? okaidia : "light"}
      extensions={allExtensions}
      onChange={onChange}
      editable={!readOnly}
      readOnly={readOnly}
      placeholder={placeholder}
      className={cn("border rounded-md overflow-hidden", className)}
    />
  );
}
