
-- Step 1: Create audit/backup table for rollback capability
CREATE TABLE IF NOT EXISTS public.l00_instance_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  original_token text NOT NULL,
  new_token text NOT NULL,
  event_id uuid NOT NULL,
  zip_code text,
  corrected_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.l00_instance_corrections ENABLE ROW LEVEL SECURITY;

-- Admin-only access
CREATE POLICY "Admins can manage l00_instance_corrections"
ON public.l00_instance_corrections
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Step 2: Create new instance tokens for each non-home zip in instance 5731e6
-- Home zip (02217) stays on original token; others get new tokens

DO $$
DECLARE
  base_token TEXT := 'l00-837854-rsg1-qr';
  original_instance TEXT := 'l00-837854-rsg1-qr:5731e6';
  home_zip TEXT;
  r RECORD;
  new_token TEXT;
  token_data RECORD;
BEGIN
  -- Get the home zip (earliest event)
  SELECT zip_code INTO home_zip
  FROM public.url_events
  WHERE token = original_instance
    AND zip_code IS NOT NULL
  ORDER BY occurred_at ASC
  LIMIT 1;
  
  RAISE NOTICE 'Home zip for instance 5731e6: %', home_zip;
  
  -- Get original token data for copying
  SELECT * INTO token_data
  FROM public.tokens
  WHERE token = original_instance;
  
  -- Process each non-home zip
  FOR r IN 
    SELECT DISTINCT zip_code
    FROM public.url_events
    WHERE token = original_instance
      AND zip_code IS NOT NULL
      AND zip_code != home_zip
  LOOP
    -- Generate new token with zip suffix
    new_token := original_instance || '-' || r.zip_code || 'fix';
    
    -- Insert new token record
    INSERT INTO public.tokens (
      token, parent_token, root_token, level, eoa_id, deck_slug,
      utm_campaign, utm_id, utm_content, utm_medium, utm_source,
      full_url, deck_version_at_mint, l00_instance
    ) VALUES (
      new_token,
      token_data.parent_token,
      token_data.root_token,
      token_data.level,
      token_data.eoa_id,
      token_data.deck_slug,
      token_data.utm_campaign,
      token_data.utm_id,
      token_data.utm_content,
      token_data.utm_medium,
      token_data.utm_source,
      regexp_replace(token_data.full_url, 't=[^&]+', 't=' || new_token),
      token_data.deck_version_at_mint,
      new_token  -- L00 instance points to itself
    );
    
    -- Log changes to audit table BEFORE updating events
    INSERT INTO public.l00_instance_corrections (original_token, new_token, event_id, zip_code)
    SELECT original_instance, new_token, id, zip_code
    FROM public.url_events
    WHERE token = original_instance
      AND zip_code = r.zip_code;
    
    -- Update events to point to new token
    UPDATE public.url_events
    SET token = new_token
    WHERE token = original_instance
      AND zip_code = r.zip_code;
    
    RAISE NOTICE 'Created token % for zip %', new_token, r.zip_code;
  END LOOP;
END $$;

-- Add comment explaining the table purpose
COMMENT ON TABLE public.l00_instance_corrections IS 
  'Audit log for L00 instance token corrections. Used for rollback if needed. See docs/IMPLEMENTATION_VERIFICATION_REQUIREMENTS.md for rollback procedure.';
