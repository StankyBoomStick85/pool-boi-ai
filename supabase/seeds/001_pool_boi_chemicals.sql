-- Seed baseline reference products for Pool Boi AI
INSERT INTO pool_boi_chemical_catalog (brand, product_name, primary_chemical, concentration, function_tag, unit_type, affiliate_url)
VALUES
('Champion', 'Liquid Chlorine', 'Sodium Hypochlorite', 12.5, 'Sanitizer', 'Ounces', 'https://www.amazon.com/s?k=liquid+chlorine+pool+12.5&s=review-rank'),
('Champion', 'Muriatic Acid', 'Hydrochloric Acid', 31.45, 'pH_Decrease', 'Ounces', 'https://www.amazon.com/s?k=muriatic+acid+pool&s=review-rank'),
('HTH', 'pH Up', 'Sodium Carbonate', 100, 'pH_Increase', 'Pounds', 'https://www.amazon.com/s?k=pool+pH+up&s=review-rank'),
('HTH', 'pH Down', 'Sodium Bisulfate', 93.2, 'pH_Decrease', 'Pounds', 'https://www.amazon.com/s?k=pool+pH+down&s=review-rank'),
('HTH', 'Alkalinity Up', 'Sodium Bicarbonate', 100, 'Alkalinity_Increase', 'Pounds', 'https://www.amazon.com/s?k=pool+alkalinity+up&s=review-rank'),
('HTH', 'Calcium Hardness Up', 'Calcium Chloride', 100, 'Calcium_Increase', 'Pounds', 'https://www.amazon.com/s?k=pool+calcium+hardness+up&s=review-rank'),
('HTH', 'Stabilizer', 'Cyanuric Acid', 100, 'Stabilizer_Increase', 'Pounds', 'https://www.amazon.com/s?k=pool+stabilizer+cyanuric+acid&s=review-rank'),
('HTH', 'Super Shock', 'Calcium Hypochlorite', 68, 'Sanitizer', 'Pounds', 'https://www.amazon.com/s?k=pool+shock+treatment&s=review-rank')
ON CONFLICT DO NOTHING; -- In case we add unique constraints later or run this again
