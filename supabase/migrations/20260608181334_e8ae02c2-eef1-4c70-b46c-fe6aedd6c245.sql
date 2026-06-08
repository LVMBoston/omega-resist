
-- Helper: derive the correct utm_medium from an EoA's utm_id.
-- Mirrors src/lib/virality/deriveUtmMedium.ts so client and server agree.
CREATE OR REPLACE FUNCTION public.derive_utm_medium(_utm_id text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  raw text := lower(trim(coalesce(_utm_id, '')));
BEGIN
  IF raw = '' THEN RETURN 'qr'; END IF;

  -- Exact matches
  IF raw IN ('email', 'mail', 'em')          THEN RETURN 'em';     END IF;
  IF raw IN ('sms', 'text', 'tx')            THEN RETURN 'sms';    END IF;
  IF raw IN ('qr', 'qrcode')                 THEN RETURN 'qr';     END IF;
  IF raw IN ('facebook', 'fb')               THEN RETURN 'fb';     END IF;
  IF raw IN ('twitter', 'x')                 THEN RETURN 'x';      END IF;
  IF raw IN ('linkedin', 'li')               THEN RETURN 'li';     END IF;
  IF raw IN ('bluesky', 'bs')                THEN RETURN 'bs';     END IF;
  IF raw = 'social'                          THEN RETURN 'social'; END IF;
  IF raw = 'p2p'                             THEN RETURN 'p2p';    END IF;

  -- Substring matches (order matters)
  IF raw ~ '(email|mail)'      THEN RETURN 'em';     END IF;
  IF raw ~ '(sms|text)'        THEN RETURN 'sms';    END IF;
  IF raw ~ '(facebook|\mfb\M)' THEN RETURN 'fb';     END IF;
  IF raw ~ '(twitter|\mx\M)'   THEN RETURN 'x';      END IF;
  IF raw ~ '(linkedin|\mli\M)' THEN RETURN 'li';     END IF;
  IF raw ~ '(bluesky|\mbs\M)'  THEN RETURN 'bs';     END IF;
  IF raw ~ 'social'            THEN RETURN 'social'; END IF;
  IF raw ~ 'p2p'               THEN RETURN 'p2p';    END IF;
  IF raw ~ 'qr'                THEN RETURN 'qr';     END IF;

  RETURN 'qr';
END;
$$;

-- Back-fix RPC: dry-run by default; admin/manager only.
CREATE OR REPLACE FUNCTION public.recompute_l00_utm_medium(
  _campaign_code text DEFAULT NULL,
  _dry_run boolean DEFAULT true
)
RETURNS TABLE(
  token text,
  eoa_id uuid,
  utm_campaign text,
  mobilize_code text,
  utm_id text,
  old_medium text,
  new_medium text,
  short_urls_updated integer,
  applied boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  r record;
  _new_medium text;
  _new_full_url text;
  _short_count integer;
BEGIN
  IF NOT (public.has_role(_user_id, 'admin') OR public.has_role(_user_id, 'manager')) THEN
    RAISE EXCEPTION 'Permission denied: only admin or manager can recompute utm_medium';
  END IF;

  FOR r IN
    SELECT
      t.token        AS t_token,
      t.eoa_id       AS t_eoa_id,
      t.utm_campaign AS t_utm_campaign,
      t.utm_medium   AS t_utm_medium,
      t.full_url     AS t_full_url,
      ea.mobilize_code AS ea_mobilize_code,
      ea.utm_id        AS ea_utm_id
    FROM public.tokens t
    JOIN public.events_actions ea ON ea.id = t.eoa_id
    WHERE t.level = 0
      AND t.deleted_at IS NULL
      AND (_campaign_code IS NULL OR t.utm_campaign = _campaign_code)
  LOOP
    _new_medium := public.derive_utm_medium(r.ea_utm_id);

    -- Skip rows that already have the correct value
    IF _new_medium IS NOT DISTINCT FROM r.t_utm_medium THEN
      CONTINUE;
    END IF;

    _short_count := 0;

    IF NOT _dry_run THEN
      -- Rewrite the utm_medium= segment inside the token's full_url
      _new_full_url := regexp_replace(
        r.t_full_url,
        '([?&])utm_medium=[^&]*',
        '\1utm_medium=' || _new_medium
      );

      UPDATE public.tokens
         SET utm_medium = _new_medium,
             full_url   = _new_full_url
       WHERE tokens.token = r.t_token;

      -- Rewrite the same segment in any shortened_urls row that points at this token
      WITH upd AS (
        UPDATE public.shortened_urls
           SET full_url = regexp_replace(
                 full_url,
                 '([?&])utm_medium=[^&]*',
                 '\1utm_medium=' || _new_medium
               )
         WHERE full_url LIKE '%t=' || r.t_token || '%'
        RETURNING 1
      )
      SELECT count(*)::integer INTO _short_count FROM upd;
    ELSE
      -- Dry-run: just count short URLs that WOULD be touched
      SELECT count(*)::integer INTO _short_count
      FROM public.shortened_urls
      WHERE full_url LIKE '%t=' || r.t_token || '%';
    END IF;

    token              := r.t_token;
    eoa_id             := r.t_eoa_id;
    utm_campaign       := r.t_utm_campaign;
    mobilize_code      := r.ea_mobilize_code;
    utm_id             := r.ea_utm_id;
    old_medium         := r.t_utm_medium;
    new_medium         := _new_medium;
    short_urls_updated := _short_count;
    applied            := NOT _dry_run;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_l00_utm_medium(text, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_l00_utm_medium(text, boolean) TO authenticated;
