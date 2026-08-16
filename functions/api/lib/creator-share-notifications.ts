import type { Env } from './types'
import { buildCreatorModerationMessage, sendMail } from './mail'
import { parseStoredSnapshot } from './creator-sharing-service'

export type CreatorShareNotificationStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

type NotificationEventRow = {
  id: number
  share_link_id: number
  share_version: number
  event_type: 'moderation_approved' | 'moderation_blocked'
  status: CreatorShareNotificationStatus
  creator_user_id: number | null
  current_share_version: number
  moderation_status: 'pending' | 'approved' | 'blocked'
  moderation_reason: string | null
  moderation_target: 'general' | 'title' | 'creator_statement' | 'product' | null
  moderation_item_index: number | null
  is_revoked: number
  legacy_provenance_status: 'ambiguous' | null
  snapshot_json: string
  recipient_email: string | null
}

export type CreatorShareNotificationDelivery = {
  status: CreatorShareNotificationStatus | 'missing'
  claimed: boolean
}

export type CreatorShareNotificationDrain = {
  claimed: number
  pending: number
  sending: number
  failed: number
  complete: boolean
}

function d1Changes(result: D1Result<unknown>): number {
  return Number((result.meta as { changes?: number } | undefined)?.changes ?? 0)
}

async function finishEvent(
  db: D1Database,
  eventId: number,
  status: 'sent' | 'failed' | 'skipped',
  error: string | null,
): Promise<void> {
  const result = await db.prepare(`
    UPDATE creator_share_notification_events
    SET status = ?, last_error = ?,
      sent_at = CASE WHEN ? = 'sent' THEN CURRENT_TIMESTAMP ELSE NULL END
    WHERE id = ? AND status = 'sending'
  `).bind(status, error, status, eventId).run()
  if (d1Changes(result) !== 1) {
    throw new Error('creator_share_notification_finalize_conflict')
  }
}

function moderationTargetLabel(row: NotificationEventRow): string | null {
  if (row.moderation_target === 'title') return 'Name der Empfehlung'
  if (row.moderation_target === 'creator_statement') {
    return `Persönlicher Hinweis bei Produkt ${(row.moderation_item_index ?? 0) + 1}`
  }
  if (row.moderation_target === 'product') return `Produkt ${(row.moderation_item_index ?? 0) + 1}`
  if (row.moderation_target === 'general') return 'Allgemeine Rückmeldung'
  return null
}

export async function deliverCreatorShareNotification(
  env: Env,
  eventId: number,
  claimRunKey: string | null = null,
): Promise<CreatorShareNotificationDelivery> {
  const claim = await env.DB.prepare(`
    UPDATE creator_share_notification_events
    SET status = 'sending', attempts = attempts + 1,
      claim_run_key = ?, last_error = NULL
    WHERE id = ? AND status = 'pending'
  `).bind(claimRunKey, eventId).run()
  if (d1Changes(claim) !== 1) {
    const current = await env.DB.prepare(`
      SELECT status FROM creator_share_notification_events WHERE id = ?
    `).bind(eventId).first<{ status: CreatorShareNotificationStatus }>()
    return { status: current?.status ?? 'missing', claimed: false }
  }

  const row = await env.DB.prepare(`
    SELECT event.id, event.share_link_id, event.share_version, event.event_type,
      event.status, share.creator_user_id, share.version AS current_share_version,
      share.moderation_status, share.moderation_reason, share.moderation_target,
      share.moderation_item_index, share.is_revoked,
      share.legacy_provenance_status, share.snapshot_json,
      recipient.email AS recipient_email
    FROM creator_share_notification_events event
    JOIN share_links share ON share.id = event.share_link_id
    LEFT JOIN users recipient
      ON recipient.id = share.creator_user_id
     AND recipient.deleted_at IS NULL
     AND trim(recipient.email) <> ''
    WHERE event.id = ? AND event.status = 'sending'
  `).bind(eventId).first<NotificationEventRow>()
  if (!row) {
    throw new Error('creator_share_notification_claim_missing')
  }

  const expectedModeration = row.event_type === 'moderation_approved' ? 'approved' : 'blocked'
  if (
    row.current_share_version !== row.share_version
    || row.moderation_status !== expectedModeration
    || row.is_revoked !== 0
    || row.legacy_provenance_status !== null
  ) {
    await finishEvent(env.DB, eventId, 'skipped', 'share_state_changed')
    return { status: 'skipped', claimed: true }
  }
  if (!row.recipient_email) {
    await finishEvent(env.DB, eventId, 'skipped', 'recipient_unavailable')
    return { status: 'skipped', claimed: true }
  }

  const parsed = parseStoredSnapshot(row.snapshot_json)
  if (!parsed.value) {
    await finishEvent(env.DB, eventId, 'failed', 'snapshot_invalid')
    return { status: 'failed', claimed: true }
  }
  const message = buildCreatorModerationMessage(env.FRONTEND_URL, {
    shareId: row.share_link_id,
    title: parsed.value.title,
    status: expectedModeration,
    reason: row.moderation_reason,
    targetLabel: moderationTargetLabel(row),
  })
  let delivered = false
  try {
    delivered = (await sendMail(env, {
      to: row.recipient_email,
      subject: message.subject,
      html: message.html,
    })).ok
  } catch {
    delivered = false
  }
  const status = delivered ? 'sent' : 'failed'
  await finishEvent(env.DB, eventId, status, delivered ? null : 'mail_delivery_failed')
  return { status, claimed: true }
}

export async function drainLegacyCreatorShareNotifications(
  env: Env,
  runKey: string,
  limit = 10,
): Promise<CreatorShareNotificationDrain> {
  // A different deploy run means the previous claimant has ended. Its SMTP
  // outcome is unknowable, so it is terminalized without another send. The
  // previous deploy already failed; this explicit rerun can then finish.
  await env.DB.prepare(`
    UPDATE creator_share_notification_events
    SET status = 'failed', last_error = 'delivery_unconfirmed'
    WHERE origin = 'legacy_activation' AND status = 'sending'
      AND (claim_run_key IS NULL OR claim_run_key <> ?)
  `).bind(runKey).run()
  const { results } = await env.DB.prepare(`
    SELECT id
    FROM creator_share_notification_events
    WHERE origin = 'legacy_activation' AND status = 'pending'
    ORDER BY created_at, id
    LIMIT ?
  `).bind(limit).all<{ id: number }>()
  let claimed = 0
  let failed = 0
  for (const event of results ?? []) {
    const delivery = await deliverCreatorShareNotification(env, event.id, runKey)
    if (delivery.claimed) claimed += 1
    if (delivery.status === 'failed') failed += 1
  }
  // A confirmed delivery failure is terminal because SMTP has no idempotency
  // key: reclaiming it could duplicate a message whose final acknowledgement
  // was lost. It fails the invocation that attempted it, but an explicit
  // deploy rerun observes the durable `failed` receipt and does not resend or
  // stay red forever.
  const counts = await env.DB.prepare(`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
      SUM(CASE WHEN status = 'sending' THEN 1 ELSE 0 END) AS sending
    FROM creator_share_notification_events
    WHERE origin = 'legacy_activation'
  `).first<{ pending: number | null; sending: number | null }>()
  const pending = Number(counts?.pending ?? 0)
  const sending = Number(counts?.sending ?? 0)
  return {
    claimed,
    pending,
    sending,
    failed,
    complete: pending === 0 && sending === 0 && failed === 0,
  }
}
