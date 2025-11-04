-- Fix function search_path for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Fix function search_path for update_product_total
CREATE OR REPLACE FUNCTION public.update_product_total()
RETURNS TRIGGER AS $$
BEGIN
  NEW.total_pieces = NEW.pallets * NEW.pieces_per_package;
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = public;