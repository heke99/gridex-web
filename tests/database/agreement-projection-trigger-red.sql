-- LOCAL ONLY. The exact captured original function + trigger must be loaded.
-- Prove the real failure on an existing PDF-only metadata mutation. Catch only
-- the known enum/column errors; a success or a different failure is not evidence.
begin;
do $$ declare actual_state text; actual_message text; baseline jsonb; begin
  select to_jsonb(a) into strict baseline from public.contract_agreements a where id=md5('pdf-agreement')::uuid;
  begin
    update public.contract_agreements set contract_pdf_path='archive/red-trigger-proof.pdf',updated_at=now()
    where id=md5('pdf-agreement')::uuid;
  exception when invalid_text_representation or undefined_column then
    get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
  end;
  if actual_state is null then raise exception 'RED failed: original projection trigger accepted PDF-only update'; end if;
  if (select to_jsonb(a) from public.contract_agreements a where id=md5('pdf-agreement')::uuid) is distinct from baseline then
    raise exception 'RED exception left partially updated agreement';
  end if;
  if actual_state<>'22P02' then raise exception 'Original enum fault had unexpected state: %',actual_state; end if;
  raise notice 'RED original production trigger reproduced SQLSTATE %: %',actual_state,actual_message;
  -- Isolate the second independent defect without turning this proof into the
  -- fix: substitute only the invalid enum literal in the captured definition.
  -- The surrounding rollback restores the exact original function afterward.
  execute replace(pg_get_functiondef('public.gridex_sync_portal_from_agreement()'::regprocedure),
    quote_literal('finalized'),quote_literal('activated'));
  actual_state:=null;
  begin
    update public.contract_agreements set contract_pdf_path='archive/red-column-proof.pdf',updated_at=now()
    where id=md5('pdf-agreement')::uuid;
  exception when undefined_column then
    get stacked diagnostics actual_state=returned_sqlstate,actual_message=message_text;
  end;
  if actual_state is distinct from '42703' then raise exception 'RED failed to isolate missing bankid_signed_at column'; end if;
  if (select to_jsonb(a) from public.contract_agreements a where id=md5('pdf-agreement')::uuid) is distinct from baseline then
    raise exception 'RED column failure left partially updated agreement';
  end if;
  raise notice 'RED isolated production column fault reproduced SQLSTATE %: %',actual_state,actual_message;
end $$;
rollback;
