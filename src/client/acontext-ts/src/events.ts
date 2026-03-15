/**
 * Session event types for the Acontext SDK.
 */

export interface EventPayload {
  type: string;
  data: Record<string, unknown>;
}

/**
 * A disk-related event.
 */
export class DiskEvent {
  readonly diskId: string;
  readonly path: string;
  readonly note?: string;

  constructor(options: { diskId: string; path: string; note?: string }) {
    this.diskId = options.diskId;
    this.path = options.path;
    this.note = options.note;
  }

  toPayload(): EventPayload {
    const data: Record<string, unknown> = {
      disk_id: this.diskId,
      path: this.path,
    };
    if (this.note !== undefined) {
      data.note = this.note;
    }
    return { type: 'disk_event', data };
  }
}

/**
 * A free-text event.
 */
export class TextEvent {
  readonly text: string;

  constructor(options: { text: string }) {
    this.text = options.text;
  }

  toPayload(): EventPayload {
    return { type: 'text_event', data: { text: this.text } };
  }
}
