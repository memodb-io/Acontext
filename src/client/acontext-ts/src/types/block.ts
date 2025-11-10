/**
 * Type definitions for block resources.
 */

import { z } from 'zod';

export const BlockSchema: z.ZodType<Block> = z.lazy(() =>
  z.object({
    id: z.string(),
    space_id: z.string(),
    type: z.string(),
    parent_id: z.string().nullable().optional(),
    title: z.string(),
    props: z.record(z.string(), z.unknown()),
    sort: z.number(),
    is_archived: z.boolean(),
    created_at: z.string(),
    updated_at: z.string(),
    children: z.array(BlockSchema).nullable().optional(),
  })
);

export type Block = {
  id: string;
  space_id: string;
  type: string;
  parent_id?: string | null;
  title: string;
  props: Record<string, unknown>;
  sort: number;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  children?: Block[] | null;
};

