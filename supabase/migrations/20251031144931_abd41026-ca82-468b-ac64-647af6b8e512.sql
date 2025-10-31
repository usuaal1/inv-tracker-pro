-- Create production orders table
CREATE TABLE public.production_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity_ordered numeric NOT NULL,
  machine_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone,
  user_id uuid
);

-- Enable RLS
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view production orders" 
ON public.production_orders 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert production orders" 
ON public.production_orders 
FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update production orders" 
ON public.production_orders 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete production orders" 
ON public.production_orders 
FOR DELETE 
USING (auth.uid() IS NOT NULL);

-- Add index for faster queries
CREATE INDEX idx_production_orders_status ON public.production_orders(status);
CREATE INDEX idx_production_orders_product_id ON public.production_orders(product_id);