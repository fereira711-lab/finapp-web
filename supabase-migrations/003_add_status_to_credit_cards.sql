-- Add status column to credit_cards table
ALTER TABLE credit_cards ADD COLUMN status TEXT DEFAULT 'pending';

-- Add check constraint for valid statuses
ALTER TABLE credit_cards ADD CONSTRAINT credit_cards_status_check
  CHECK (status IN ('pending', 'paid', 'overdue'));
