"use client";

import { useEffect, useMemo, useCallback, useRef } from "react";
import { useCreateBlockNote } from "@blocknote/react";
import { BlockNoteView } from "@blocknote/shadcn";
import { useTheme } from "next-themes";
import {
  DefaultReactSuggestionItem,
  SuggestionMenuController,
} from "@blocknote/react";
import {
  filterSuggestionItems,
  insertOrUpdateBlock,
  BlockNoteEditor as BNEditor,
} from "@blocknote/core";
import { FileText, ListOrdered } from "lucide-react";
import { Block } from "@/types";
import "@blocknote/shadcn/style.css";

interface BlockNoteEditorProps {
  blocks: Block[];
  editable?: boolean;
  onChange?: (blocks: Block[]) => void;
}

export function BlockNoteEditor({
  blocks,
  editable = false,
  onChange,
}: BlockNoteEditorProps) {
  const { resolvedTheme } = useTheme();
  // Track if we're updating from external source to prevent onChange loop
  const isExternalUpdateRef = useRef(false);
  // Track previous blocks to detect real changes
  const prevBlocksRef = useRef<Block[]>([]);

  // Transform Block[] to BlockNote schema format
  const initialContent = useMemo(() => {
    if (!blocks || blocks.length === 0) return [];

    return blocks.map((block) => {
      const content = block.props?.content || block.title || "";
      // Ensure type is a valid BlockNote type
      let blockType = "paragraph";
      if (block.type === "text" || !block.type) {
        blockType = "paragraph";
      } else if (["heading", "bulletListItem", "numberedListItem", "checkListItem"].includes(block.type)) {
        blockType = block.type;
      }

      return {
        id: block.id,
        type: blockType,
        content: typeof content === "string" ? [{ type: "text", text: content, styles: {} }] : [],
        children: [],
        props: { _originalBlock: block },
      };
    });
  }, [blocks]);

  const editor = useCreateBlockNote({
    initialContent: initialContent.length > 0 ? initialContent : undefined,
  });

  // Custom Slash Menu items for text and sop blocks
  const getCustomSlashMenuItems = useCallback(
    (editor: BNEditor) => {
      const customItems: DefaultReactSuggestionItem[] = [
        {
          title: "Text Block",
          onItemClick: () => {
            insertOrUpdateBlock(editor, {
              type: "paragraph",
            });
          },
          aliases: ["text", "paragraph", "p"],
          group: "Content Blocks",
          icon: <FileText size={18} />,
          subtext: "Insert a text block",
        },
        {
          title: "SOP Block",
          onItemClick: () => {
            insertOrUpdateBlock(editor, {
              type: "paragraph",
              content: [{ type: "text", text: "[SOP] ", styles: { bold: true } }],
            });
          },
          aliases: ["sop", "procedure", "standard"],
          group: "Content Blocks",
          icon: <ListOrdered size={18} />,
          subtext: "Insert a Standard Operating Procedure block",
        },
      ];

      return customItems;
    },
    []
  );

  useEffect(() => {
    if (!editor) return;

    // Check if blocks actually changed by comparing with previous
    const hasChanged =
      prevBlocksRef.current.length !== blocks.length ||
      blocks.some((block, idx) => {
        const prevBlock = prevBlocksRef.current[idx];
        if (!prevBlock) return true;
        return (
          block.id !== prevBlock.id ||
          block.title !== prevBlock.title ||
          block.type !== prevBlock.type ||
          JSON.stringify(block.props) !== JSON.stringify(prevBlock.props)
        );
      });

    if (!hasChanged) return;

    // Update previous blocks reference
    prevBlocksRef.current = blocks;

    // Check if editor is focused (user is actively editing)
    const isFocused = editor.isFocused();

    // Save current cursor position before updating
    const textCursorPosition = isFocused ? editor.getTextCursorPosition() : null;
    const currentBlockId = textCursorPosition?.block?.id;

    // Set flag to indicate this is an external update
    isExternalUpdateRef.current = true;

    try {
      // Update editor content when blocks change
      if (initialContent.length > 0) {
        // BlockNote type definitions are complex, our Block format needs type casting
        editor.replaceBlocks(editor.document, initialContent as Parameters<typeof editor.replaceBlocks>[1]);
      } else if (blocks.length === 0) {
        // If blocks are empty, replace with an empty paragraph
        editor.replaceBlocks(editor.document, [{
          type: "paragraph",
          content: [],
        }]);
      }
    } catch (error) {
      console.error("Error updating editor content:", error);
      // Reset flag even if update fails
      isExternalUpdateRef.current = false;
      return;
    }

    // Restore cursor position after update (only if editor was focused)
    if (isFocused && currentBlockId && textCursorPosition) {
      // Use requestAnimationFrame to ensure DOM is updated before setting cursor
      requestAnimationFrame(() => {
        try {
          // Find the block in the new content that matches the cursor's block
          const targetBlock = initialContent.find(
            (block) => block.id === currentBlockId
          );
          if (targetBlock) {
            // Restore position to the same block
            editor.setTextCursorPosition(targetBlock, "end");
            // Re-focus the editor
            editor.focus();
          }
        } catch (error) {
          // If restoration fails, just continue without repositioning
          console.debug("Could not restore cursor position:", error);
        }
      });
    }

    // Reset flag after a short delay to allow the change event to process
    setTimeout(() => {
      isExternalUpdateRef.current = false;
    }, 100);
  }, [editor, initialContent, blocks]);

  // Handle changes in the editor
  const handleChange = useCallback(() => {
    if (!onChange || !editable || !editor) return;

    // Don't trigger onChange if this is an external update
    if (isExternalUpdateRef.current) return;

    try {
      // Get current blocks from editor
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentBlocks = editor.document as any[];

      // Convert BlockNote blocks back to our Block format
      const updatedBlocks: Block[] = currentBlocks.map((bnBlock, index) => {
        // Try to get the original block from props
        const originalBlock = bnBlock.props?._originalBlock as Block | undefined;

        // Extract content from BlockNote block
        let content = "";
        if (Array.isArray(bnBlock.content)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          content = bnBlock.content.map((c: any) => c.text || "").join("");
        } else if (typeof bnBlock.content === "string") {
          content = bnBlock.content;
        }

        // Determine block type
        let blockType = "text";
        // Check if content starts with [SOP] to mark it as SOP block
        if (content.trim().startsWith("[SOP]")) {
          blockType = "sop";
        } else if (bnBlock.type === "paragraph") {
          blockType = "text";
        } else {
          blockType = bnBlock.type;
        }

        // If we have an original block, update it
        if (originalBlock) {
          return {
            ...originalBlock,
            type: blockType,
            title: content,
            props: {
              ...originalBlock.props,
              content,
            },
            sort: index,
          };
        }

        // Otherwise, create a new block structure (will need to be created via API)
        return {
          id: bnBlock.id,
          space_id: blocks[0]?.space_id || "",
          type: blockType,
          parent_id: blocks[0]?.parent_id || null,
          title: content,
          props: {
            content,
          },
          sort: index,
          is_archived: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      onChange(updatedBlocks);
    } catch (error) {
      console.error("Error handling block change:", error);
    }
  }, [onChange, editable, editor, blocks]);

  return (
    <div className="blocknote-editor-container">
      <BlockNoteView
        editor={editor}
        editable={editable}
        theme={resolvedTheme === "dark" ? "dark" : "light"}
        onChange={handleChange}
        slashMenu={false}
      >
        {editable && (
          <SuggestionMenuController
            triggerCharacter={"/"}
            getItems={async (query) =>
              filterSuggestionItems(getCustomSlashMenuItems(editor), query)
            }
          />
        )}
      </BlockNoteView>
    </div>
  );
}
