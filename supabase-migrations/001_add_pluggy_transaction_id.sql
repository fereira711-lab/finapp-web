-- Add pluggy_transaction_id column to transactions table
-- Required for Pluggy webhook upsert to work correctly

ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS pluggy_transaction_id TEXT UNIQUE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_transactions_pluggy_id
ON transactions (pluggy_transaction_id)
WHERE pluggy_transaction_id IS NOT NULL;
