/**
 * Support for constructing session messages.
 */

import { z } from 'zod';

export const MessagePartSchema = z.object({
  type: z.string(),
  text: z.string().nullable().optional(),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
  file_field: z.string().nullable().optional(),
});

export type MessagePartInput = z.infer<typeof MessagePartSchema>;

export class MessagePart {
  type: string;
  text?: string | null;
  meta?: Record<string, unknown> | null;
  file_field?: string | null;

  constructor(data: MessagePartInput) {
    this.type = data.type;
    this.text = data.text ?? null;
    this.meta = data.meta ?? null;
    this.file_field = data.file_field ?? null;
  }

  static textPart(
    text: string,
    options?: { meta?: Record<string, unknown> | null }
  ): MessagePart {
    return new MessagePart({
      type: 'text',
      text,
      meta: options?.meta ?? null,
    });
  }

  static fileFieldPart(
    fileField: string,
    options?: { meta?: Record<string, unknown> | null }
  ): MessagePart {
    return new MessagePart({
      type: 'file',
      file_field: fileField,
      meta: options?.meta ?? null,
    });
  }

  toJSON(): MessagePartInput {
    return {
      type: this.type,
      text: this.text ?? null,
      meta: this.meta ?? null,
      file_field: this.file_field ?? null,
    };
  }
}

export const AcontextMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  parts: z.array(MessagePartSchema),
  meta: z.record(z.string(), z.unknown()).nullable().optional(),
});

export type AcontextMessageInput = z.infer<typeof AcontextMessageSchema>;

export class AcontextMessage {
  role: 'user' | 'assistant' | 'system';
  parts: MessagePart[];
  meta?: Record<string, unknown> | null;

  constructor(data: AcontextMessageInput) {
    this.role = data.role;
    this.parts = data.parts.map((p) =>
      p instanceof MessagePart ? p : new MessagePart(p)
    );
    this.meta = data.meta ?? null;
  }

  toJSON(): AcontextMessageInput {
    return {
      role: this.role,
      parts: this.parts.map((p) => p.toJSON()),
      meta: this.meta ?? null,
    };
  }
}

export function buildAcontextMessage(options: {
  role: 'user' | 'assistant' | 'system';
  parts: (MessagePart | string | MessagePartInput)[];
  meta?: Record<string, unknown> | null;
}): AcontextMessage {
  if (!['user', 'assistant', 'system'].includes(options.role)) {
    throw new Error("role must be one of {'user', 'assistant', 'system'}");
  }

  const normalizedParts = options.parts.map((part) => {
    if (part instanceof MessagePart) {
      return part;
    }
    if (typeof part === 'string') {
      return MessagePart.textPart(part);
    }
    if (typeof part === 'object' && part !== null) {
      if (!('type' in part)) {
        throw new Error("mapping message parts must include a 'type'");
      }
      return new MessagePart(part as MessagePartInput);
    }
    throw new TypeError('unsupported message part type');
  });

  return new AcontextMessage({
    role: options.role,
    parts: normalizedParts,
    meta: options.meta ?? null,
  });
}

