-- Allow all operations on pool_boi_chemical_catalog
CREATE POLICY "allow_all_pool_boi_catalog" 
ON pool_boi_chemical_catalog
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Allow all operations on pool_boi_inventory
CREATE POLICY "allow_all_pool_boi_inventory" 
ON pool_boi_inventory
FOR ALL 
USING (true) 
WITH CHECK (true);
