-- Create production reports table for shift tracking
CREATE TABLE public.production_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_number INTEGER NOT NULL CHECK (shift_number IN (1, 2, 3)),
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  machine_id UUID REFERENCES public.machines(id),
  machine_name TEXT NOT NULL,
  product_name TEXT,
  cycle_time TEXT,
  production_goal NUMERIC DEFAULT 0,
  production_achieved NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create shift comments table for plant map
CREATE TABLE public.shift_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  comment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift_number INTEGER NOT NULL CHECK (shift_number IN (1, 2, 3)),
  comments TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(comment_date, shift_number)
);

-- Enable RLS
ALTER TABLE public.production_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shift_comments ENABLE ROW LEVEL SECURITY;

-- RLS policies for production_reports
CREATE POLICY "Authenticated users can view production reports"
ON public.production_reports FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert production reports"
ON public.production_reports FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update production reports"
ON public.production_reports FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete production reports"
ON public.production_reports FOR DELETE
USING (auth.uid() IS NOT NULL);

-- RLS policies for shift_comments
CREATE POLICY "Authenticated users can view shift comments"
ON public.shift_comments FOR SELECT
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can insert shift comments"
ON public.shift_comments FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update shift comments"
ON public.shift_comments FOR UPDATE
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can delete shift comments"
ON public.shift_comments FOR DELETE
USING (auth.uid() IS NOT NULL);

-- Trigger for updated_at
CREATE TRIGGER update_production_reports_updated_at
BEFORE UPDATE ON public.production_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shift_comments_updated_at
BEFORE UPDATE ON public.shift_comments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();