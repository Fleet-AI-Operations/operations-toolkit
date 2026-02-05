-- Add STANDARD value to RecordCategory enum
ALTER TYPE public."RecordCategory" ADD VALUE IF NOT EXISTS 'STANDARD';
