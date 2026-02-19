-- Create table for Bank Transactions (Uploaded from Bank Extracts)
CREATE TABLE IF NOT EXISTS bank_transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    transaction_date DATE NOT NULL,
    description TEXT,
    reference TEXT, -- Bank reference number
    amount DECIMAL(12, 2) NOT NULL, -- Positive for deposits, Negative for withdrawals
    balance DECIMAL(12, 2), -- Running balance from bank, optional
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'MATCHED', 'IGNORED')),
    matched_payment_id UUID REFERENCES unit_payments(id), -- Link to system payment if matched
    metadata JSONB -- For extra bank details
);

-- Enable RLS
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

-- Policies (Admin only for now)
CREATE POLICY "Admins can view all bank transactions"
    ON bank_transactions FOR SELECT
    TO authenticated
    USING (true); -- Refine later for admin role

CREATE POLICY "Admins can insert bank transactions"
    ON bank_transactions FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Admins can update bank transactions"
    ON bank_transactions FOR UPDATE
    TO authenticated
    USING (true);

-- Create simple index for faster matching
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_amount ON bank_transactions(amount);
