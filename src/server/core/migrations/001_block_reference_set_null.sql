-- Migration: Change block_references.reference_block_id foreign key from CASCADE to SET NULL
-- Date: 2025-11-04
-- Description: When a referenced block is deleted, set reference_block_id to NULL instead of deleting the BlockReference record

BEGIN;

-- Drop the existing foreign key constraint
ALTER TABLE block_references 
DROP CONSTRAINT IF EXISTS block_references_reference_block_id_fkey;

-- Make the column nullable if it isn't already
ALTER TABLE block_references 
ALTER COLUMN reference_block_id DROP NOT NULL;

-- Add the new foreign key constraint with SET NULL behavior
ALTER TABLE block_references 
ADD CONSTRAINT block_references_reference_block_id_fkey 
FOREIGN KEY (reference_block_id) 
REFERENCES blocks(id) 
ON DELETE SET NULL 
ON UPDATE CASCADE;

COMMIT;

-- Verify the change
-- SELECT conname, contype, confdeltype, confupdtype 
-- FROM pg_constraint 
-- WHERE conname = 'block_references_reference_block_id_fkey';
-- Expected: confdeltype = 'n' (SET NULL), confupdtype = 'c' (CASCADE)

