-- Create towers table
CREATE TABLE IF NOT EXISTS towers (
    name TEXT PRIMARY KEY,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Populate towers from existing units
INSERT INTO towers (name)
SELECT DISTINCT tower FROM units
ON CONFLICT (name) DO NOTHING;

-- Enable RLS
ALTER TABLE towers ENABLE ROW LEVEL SECURITY;

-- Create policy for read/write
CREATE POLICY "Enable all access for authenticated users" ON towers
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
