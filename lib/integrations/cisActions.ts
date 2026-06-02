import type { SupabaseClient } from '@supabase/supabase-js'

export type CisActionOperation = 'retry' | 'cancel' | 'resend_signature'

type CisActionRow = {
  id: string
  signup_order_id: string | null
  agreement_id: string | null
  user_id: string | null
  action_type: string
  status: string
  request_payload: Record<string, unknown>
}

function nextIdempotencyKey(action: CisActionRow, operation: CisActionOperation) {
  return `cis:${operation}:${action.id}:${Date.now()}`
}

export async function runCisActionOperation(
  supabase: SupabaseClient,
  params: {
    actionId: string
    operation: CisActionOperation
    actorId: string
  }
) {
  const { data: action, error } = await supabase
    .from('cis_sync_actions')
    .select(
      'id,signup_order_id,agreement_id,user_id,action_type,status,request_payload'
    )
    .eq('id', params.actionId)
    .single<CisActionRow>()

  if (error || !action) {
    throw Object.assign(new Error(error?.message ?? 'CIS action not found'), {
      status: 404,
    })
  }

  if (params.operation === 'cancel') {
    const { error: updateError } = await supabase
      .from('cis_sync_actions')
      .update({
        status: 'cancelled',
        last_error: 'Cancelled by admin',
      })
      .eq('id', action.id)

    if (updateError) {
      throw Object.assign(new Error(updateError.message), { status: 500 })
    }

    await supabase.from('customer_agreement_events').insert({
      user_id: action.user_id,
      agreement_id: action.agreement_id,
      signup_order_id: action.signup_order_id,
      event_type: 'cis_sync_cancelled',
      summary: 'CIS-sync avbröts av admin.',
      payload: { actionId: action.id, actorId: params.actorId },
      source: 'admin',
    })

    return { ok: true, createdActionId: null }
  }

  const actionType =
    params.operation === 'resend_signature'
      ? 'resend_signature_email'
      : action.action_type

  const { data: created, error: createError } = await supabase
    .from('cis_sync_actions')
    .insert({
      signup_order_id: action.signup_order_id,
      agreement_id: action.agreement_id,
      user_id: action.user_id,
      action_type: actionType,
      status: 'queued',
      provider_key: 'cis',
      idempotency_key: nextIdempotencyKey(action, params.operation),
      request_payload: {
        ...action.request_payload,
        operation: params.operation,
        previousActionId: action.id,
      },
    })
    .select('id')
    .single<{ id: string }>()

  if (createError || !created) {
    throw Object.assign(new Error(createError?.message ?? 'Could not create CIS action'), {
      status: 500,
    })
  }

  await supabase.from('customer_agreement_events').insert({
    user_id: action.user_id,
    agreement_id: action.agreement_id,
    signup_order_id: action.signup_order_id,
    event_type:
      params.operation === 'resend_signature'
        ? 'cis_signature_email_resend_queued'
        : 'cis_sync_retry_queued',
    summary:
      params.operation === 'resend_signature'
        ? 'Omskick av signeringsmail har köats.'
        : 'CIS-sync har köats om.',
    payload: {
      previousActionId: action.id,
      createdActionId: created.id,
      actorId: params.actorId,
    },
    source: 'admin',
    customer_visible: params.operation === 'resend_signature',
    customer_label:
      params.operation === 'resend_signature'
        ? 'Avtal väntar på signering'
        : null,
  })

  if (params.operation === 'resend_signature' && action.signup_order_id) {
    await supabase.rpc('gridex_apply_signup_order_status', {
      p_signup_order_id: action.signup_order_id,
      p_status: 'signature_email_sent',
      p_event_type: 'cis_signature_email_sent',
      p_summary: 'Signeringsmail har skickats om via CIS.',
      p_payload: { createdActionId: created.id },
      p_customer_visible: true,
    })
  }

  return { ok: true, createdActionId: created.id }
}
