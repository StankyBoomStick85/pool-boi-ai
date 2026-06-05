-- Create pool_boi_chemical_catalog table
CREATE TABLE IF NOT EXISTS pool_boi_chemical_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand TEXT NOT NULL,
    product_name TEXT NOT NULL,
    primary_chemical TEXT,
    function_tag TEXT CHECK (function_tag IN ('pH_Decrease', 'pH_Increase', 'Sanitizer', 'Alkalinity_Increase', 'Calcium_Increase', 'Stabilizer_Increase')),
    unit_type TEXT CHECK (unit_type IN ('Ounces', 'Pounds')),
    affiliate_url TEXT
);

-- Create pool_boi_inventory table
CREATE TABLE IF NOT EXISTS pool_boi_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    catalog_id UUID REFERENCES pool_boi_chemical_catalog(id) ON DELETE CASCADE,
    total_volume_capacity NUMERIC NOT NULL,
    current_volume_level NUMERIC NOT NULL,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS (standard practice for Supabase)
ALTER TABLE pool_boi_chemical_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE pool_boi_inventory ENABLE ROW LEVEL SECURITY;

-- Note: Policies are not defined here as specific requirements were not provided.
