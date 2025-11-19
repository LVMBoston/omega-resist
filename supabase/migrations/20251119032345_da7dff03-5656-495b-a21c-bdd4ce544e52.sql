-- Create a test table to verify migrations are working
CREATE TABLE public.migration_test (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_field TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.migration_test ENABLE ROW LEVEL SECURITY;

-- Add a basic policy
CREATE POLICY "Anyone can view test data"
  ON public.migration_test
  FOR SELECT
  USING (true);

COMMENT ON TABLE public.migration_test IS 'Temporary table to test migration system';