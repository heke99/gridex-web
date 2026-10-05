-- Tenant-local delivery durability only. This creates no OPS memberships/RBAC.
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='120s';
CREATE SCHEMA IF NOT EXISTS support_private;
REVOKE ALL ON SCHEMA support_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA support_private TO service_role;
CREATE TABLE support_private.staff_invitation_deliveries(
  delivery_id uuid PRIMARY KEY,
  request_hash text NOT NULL CHECK(request_hash ~ '^[a-f0-9]{64}$'),
  request_fingerprint text NOT NULL CHECK(request_fingerprint ~ '^[a-f0-9]{64}$'),
  receipt_base jsonb NOT NULL CHECK(jsonb_typeof(receipt_base)='object'),
  status text NOT NULL CHECK(status IN ('started','complete')),
  claim_token uuid NOT NULL DEFAULT gen_random_uuid(),
  receipt_data jsonb,
  local_auth_subject uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  CHECK((status='started' AND receipt_data IS NULL AND completed_at IS NULL)
    OR (status='complete' AND jsonb_typeof(receipt_data)='object' AND completed_at IS NOT NULL))
);
ALTER TABLE support_private.staff_invitation_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE support_private.staff_invitation_deliveries FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION public.gridex_support_claim_staff_delivery_v1(p_command jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_id uuid:=(p_command->>'delivery_id')::uuid;
  v_hash text:=p_command->>'request_hash';
  v_fingerprint text:=p_command->>'request_fingerprint';
  v_base jsonb:=p_command->'receipt_base';
  v_inserted boolean;
  v_row support_private.staff_invitation_deliveries%rowtype;
BEGIN
  IF v_id IS NULL OR v_hash IS NULL OR v_hash !~ '^[a-f0-9]{64}$'
    OR v_fingerprint IS NULL OR v_fingerprint !~ '^[a-f0-9]{64}$'
    OR jsonb_typeof(v_base) IS DISTINCT FROM 'object'
    OR v_base->>'delivery_id' IS DISTINCT FROM v_id::text
    OR v_base->>'request_hash' IS DISTINCT FROM v_hash
  THEN RAISE EXCEPTION 'support_delivery_input_invalid'; END IF;
  INSERT INTO support_private.staff_invitation_deliveries(delivery_id,request_hash,request_fingerprint,receipt_base,status)
    VALUES(v_id,v_hash,v_fingerprint,v_base,'started') ON CONFLICT(delivery_id) DO NOTHING;
  v_inserted:=FOUND;
  SELECT * INTO v_row FROM support_private.staff_invitation_deliveries WHERE delivery_id=v_id FOR UPDATE;
  IF v_row.request_hash IS DISTINCT FROM v_hash OR v_row.request_fingerprint IS DISTINCT FROM v_fingerprint OR v_row.receipt_base IS DISTINCT FROM v_base
  THEN RAISE EXCEPTION 'support_delivery_idempotency_conflict'; END IF;
  IF v_inserted THEN
    RETURN jsonb_build_object('outcome','start','claim_token',v_row.claim_token);
  ELSIF v_row.status='complete' THEN
    IF NOT EXISTS(SELECT FROM auth.users WHERE id=v_row.local_auth_subject AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=now())) THEN
      RETURN jsonb_build_object('outcome','indeterminate');
    END IF;
    RETURN jsonb_build_object('outcome','complete','receipt_data',v_row.receipt_data);
  END IF;
  -- A provider email call cannot share this database transaction. Never resend
  -- automatically after a crash/unknown outcome; reconcile through a trusted
  -- operator using the original claim and provider delivery evidence.
  RETURN jsonb_build_object('outcome','indeterminate');
END;$$;
REVOKE ALL ON FUNCTION public.gridex_support_claim_staff_delivery_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridex_support_claim_staff_delivery_v1(jsonb) TO service_role;

CREATE FUNCTION public.gridex_support_complete_staff_delivery_v1(p_command jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog AS $$
DECLARE
  v_id uuid:=(p_command->>'delivery_id')::uuid;
  v_claim uuid:=(p_command->>'claim_token')::uuid;
  v_hash text:=p_command->>'request_hash';
  v_data jsonb:=p_command->'receipt_data';
  v_row support_private.staff_invitation_deliveries%rowtype;
BEGIN
  SELECT * INTO v_row FROM support_private.staff_invitation_deliveries WHERE delivery_id=v_id FOR UPDATE;
  IF NOT FOUND OR v_claim IS DISTINCT FROM v_row.claim_token OR v_hash IS DISTINCT FROM v_row.request_hash
    OR jsonb_typeof(v_data) IS DISTINCT FROM 'object'
    OR v_data-'local_auth_subject'-'status' IS DISTINCT FROM v_row.receipt_base
    OR v_data->>'status' IS DISTINCT FROM 'sent'
    OR nullif(v_data->>'local_auth_subject','')::uuid IS NULL
    OR NOT EXISTS(SELECT FROM auth.users WHERE id=(v_data->>'local_auth_subject')::uuid
      AND lower(email)=lower(v_row.receipt_base->>'email') AND deleted_at IS NULL
      AND (banned_until IS NULL OR banned_until<=now()))
  THEN RAISE EXCEPTION 'support_delivery_completion_invalid'; END IF;
  IF v_row.status='complete' THEN
    IF v_row.receipt_data IS DISTINCT FROM v_data THEN RAISE EXCEPTION 'support_delivery_idempotency_conflict'; END IF;
    RETURN true;
  END IF;
  UPDATE support_private.staff_invitation_deliveries SET status='complete',receipt_data=v_data,
    local_auth_subject=(v_data->>'local_auth_subject')::uuid,completed_at=now() WHERE delivery_id=v_id;
  RETURN true;
END;$$;
REVOKE ALL ON FUNCTION public.gridex_support_complete_staff_delivery_v1(jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridex_support_complete_staff_delivery_v1(jsonb) TO service_role;

CREATE FUNCTION public.gridex_support_existing_invitation_subject_v1(p_email text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$
  SELECT id FROM auth.users WHERE lower(email)=lower(btrim(p_email))
    AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.gridex_support_existing_invitation_subject_v1(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.gridex_support_existing_invitation_subject_v1(text) TO service_role;
COMMIT;
