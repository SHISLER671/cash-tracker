-- The app supports custom categories (presets, free-text edits).
-- Drop the legacy enum-style check that only allowed gas/food/medical/other.

alter table public.shared_transactions
  drop constraint if exists shared_transactions_category_check;