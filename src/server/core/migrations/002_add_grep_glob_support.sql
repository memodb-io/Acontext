-- Migration: Add grep and glob search support for artifacts
-- Description: Enable pg_trgm extension and add GIN index for text search on artifact content

-- Enable pg_trgm extension for pattern matching and similarity searches
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a function to check if mime type is text-searchable
CREATE OR REPLACE FUNCTION is_text_searchable_mime(mime_type text) 
RETURNS boolean AS $$
BEGIN
    RETURN mime_type LIKE 'text/%' 
        OR mime_type = 'application/json'
        OR mime_type LIKE 'application/x-%';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Add GIN index on asset_meta->>'content' for text search
-- Only index artifacts with text-searchable mime types and non-null content
-- Note: CREATE INDEX CONCURRENTLY cannot be run inside a transaction block
-- Note: The artifacts table must exist (created by GORM AutoMigrate) before running this migration
-- If you get "relation artifacts does not exist", start the Go API server first to create tables, then re-run this migration
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_content_trgm 
ON artifacts USING GIN (((asset_meta->>'content')) gin_trgm_ops)
WHERE (asset_meta->>'content') IS NOT NULL
    AND ((asset_meta->>'mime') LIKE 'text/%' 
        OR (asset_meta->>'mime') = 'application/json' 
        OR (asset_meta->>'mime') LIKE 'application/x-%');

-- Add GIN index on filename and path for glob pattern matching
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artifacts_path_filename_trgm 
ON artifacts USING GIN (((path || '/' || filename)) gin_trgm_ops);
