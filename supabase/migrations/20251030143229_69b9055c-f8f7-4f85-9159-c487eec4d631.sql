-- Modify scrap_records quantity column to handle decimal values (KG)
ALTER TABLE public.scrap_records 
ALTER COLUMN quantity TYPE numeric(10,2);

-- Update products table to rename packages to pallets
ALTER TABLE public.products 
RENAME COLUMN packages TO pallets;

-- Update the trigger function to use pallets instead of packages
CREATE OR REPLACE FUNCTION public.update_product_total()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.total_pieces = NEW.pallets * NEW.pieces_per_package;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;