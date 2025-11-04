-- Create function to update timestamps (if not exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create machines table
CREATE TABLE public.machines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  cavities INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'producing',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_status CHECK (status IN ('producing', 'mold_change', 'minor_stop', 'major_stop'))
);

-- Create machine production tracking table
CREATE TABLE public.machine_production (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  production_count INTEGER NOT NULL DEFAULT 0,
  hour_timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT date_trunc('hour', now()),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machine_production ENABLE ROW LEVEL SECURITY;

-- RLS Policies for machines
CREATE POLICY "Authenticated users can view machines"
ON public.machines FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert machines"
ON public.machines FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update machines"
ON public.machines FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete machines"
ON public.machines FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS Policies for machine_production
CREATE POLICY "Authenticated users can view machine production"
ON public.machine_production FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert machine production"
ON public.machine_production FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update machine production"
ON public.machine_production FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete machine production"
ON public.machine_production FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Create trigger to update updated_at
CREATE TRIGGER update_machines_updated_at
BEFORE UPDATE ON public.machines
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial machines with their cavities
INSERT INTO public.machines (name, cavities, status) VALUES
('ISBM 8', 5, 'producing'),
('ISBM 7', 5, 'producing'),
('ISBM 9', 5, 'producing'),
('ISBM 6', 4, 'producing'),
('ISBM 3', 7, 'producing'),
('ISBM 4', 5, 'producing'),
('ISBM 5', 4, 'producing'),
('ISBM 12', 1, 'producing'),
('I1', 4, 'producing'),
('I3', 4, 'producing'),
('I4', 8, 'producing'),
('I8', 8, 'producing'),
('I11', 4, 'producing'),
('I5', 4, 'producing'),
('INY 6', 1, 'producing'),
('INY 7', 1, 'producing');

-- Make product_id nullable in scrap_records
ALTER TABLE public.scrap_records ALTER COLUMN product_id DROP NOT NULL;