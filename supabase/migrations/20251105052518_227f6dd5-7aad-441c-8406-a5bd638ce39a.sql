-- Add current_product_id and quantity_ordered to machines table
ALTER TABLE public.machines 
ADD COLUMN current_product_id uuid REFERENCES public.products(id),
ADD COLUMN quantity_ordered numeric DEFAULT 0,
ADD COLUMN quantity_produced numeric DEFAULT 0;