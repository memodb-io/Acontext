"use client";

import { CodeEditor } from "@/components/code-editor";
import { useLearningSpaceContext } from "../learning-space-layout-client";

export default function MetadataPage() {
  const { metaValue, metaError, handleMetaChange } =
    useLearningSpaceContext();

  return (
    <>
      <CodeEditor
        value={metaValue}
        onChange={handleMetaChange}
        language="json"
        height="100%"
      />
      {metaError && (
        <p className="text-sm text-destructive mt-1">{metaError}</p>
      )}
    </>
  );
}
