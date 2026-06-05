-- Add concentration column to pool_boi_chemical_catalog
ALTER TABLE pool_boi_chemical_catalog 
ADD COLUMN IF NOT EXISTS concentration NUMERIC;
