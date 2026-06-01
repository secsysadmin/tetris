-- Add industry ranges to draft and placeholder flag to company
ALTER TABLE "Draft" ADD COLUMN "industryRanges" JSONB;
ALTER TABLE "Company" ADD COLUMN "isPlaceholder" BOOLEAN NOT NULL DEFAULT FALSE;
