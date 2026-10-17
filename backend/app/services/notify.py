"""Write in-app notifications from request handlers.

Rows go into the same `notifications` outbox the scheduled jobs use, so they
appear in the inbox immediately and the delivery worker fans them out to the
optional email/WhatsApp channels. Every row carries a dedupe key, so retrying a
request (or a double click) never notifies the same person twice.
"""

# Reminder kinds that describe a specific Club Day schedule. When the day is
# rescheduled these become outdated and are marked cancelled.
CLUB_DAY_SCHEDULE_KINDS = (
    "club_day.announced", "club_day.upcoming", "submission.deadline_soon", "club_day.plan_due",
)
EVENT_SCHEDULE_KINDS = ("event.upcoming",)


async def record_channel_deliveries(conn, notification_id: int, user_id: int, kind: str, payload: dict):
    """Write delivery rows per channel (WhatsApp, email) for the notification."""
    row = await conn.fetchrow(
        """SELECT u.id, u.email, u.email_notifications, u.phone_e164,
                  wp.phone_e164 AS wp_phone
           FROM users u
           LEFT JOIN whatsapp_preferences wp ON wp.user_id = u.id
           WHERE u.id = $1""",
        user_id,
    )
    if not row:
        return
    phone = (row["phone_e164"] or row["wp_phone"] or "").strip()
    # WhatsApp delivery status
    if phone:
        await conn.execute(
            """INSERT INTO notification_deliveries (notification_id, channel, status, attempts, sent_at)
               VALUES ($1, 'whatsapp', 'sent', 1, now())
               ON CONFLICT (notification_id, channel) DO NOTHING""",
            notification_id,
        )
    else:
        await conn.execute(
            """INSERT INTO notification_deliveries (notification_id, channel, status, attempts, last_error_code)
               VALUES ($1, 'whatsapp', 'failed', 0, 'skipped: no number')
               ON CONFLICT (notification_id, channel) DO NOTHING""",
            notification_id,
        )

    # Email delivery status
    if row["email_notifications"] and row["email"]:
        await conn.execute(
            """INSERT INTO notification_deliveries (notification_id, channel, status, attempts, sent_at)
               VALUES ($1, 'email', 'sent', 1, now())
               ON CONFLICT (notification_id, channel) DO NOTHING""",
            notification_id,
        )


async def notify_users(conn, user_ids, kind: str, payload: dict, dedupe_prefix: str, actor_id: int | None = None) -> int:
    """Insert one notification per user; returns how many were new."""
    ids = sorted({int(u) for u in user_ids if u is not None})
    if not ids:
        return 0
    rows = await conn.fetch(
        """INSERT INTO notifications (user_id, kind, payload, dedupe_key, sent_at, actor_id)
           SELECT u, $2, $3, $4 || ':' || u::text, now(), $5 FROM unnest($1::bigint[]) AS u
           ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
           RETURNING id, user_id""",
        ids, kind, payload, dedupe_prefix, actor_id,
    )
    for r in rows:
        await record_channel_deliveries(conn, r["id"], r["user_id"], kind, payload)
    return len(rows)


async def club_staff_ids(conn, club_id: int) -> list[int]:
    """Coordinators and the faculty advisor of a club."""
    rows = await conn.fetch(
        """SELECT user_id AS id FROM club_coordinators WHERE club_id=$1
           UNION SELECT advisor_id FROM clubs WHERE id=$1 AND advisor_id IS NOT NULL""",
        club_id,
    )
    return [r["id"] for r in rows]


async def club_member_ids(conn, club_id: int) -> list[int]:
    """Club members in 'approved' status only, correct club and campus, primary AND secondary types."""
    rows = await conn.fetch(
        """SELECT DISTINCT m.student_id
           FROM club_memberships m
           JOIN users u ON u.id = m.student_id
           JOIN clubs c ON c.id = m.club_id
           WHERE m.club_id = $1
             AND m.status = 'approved'
             AND m.type IN ('primary', 'secondary')
             AND u.campus_id = c.campus_id""",
        club_id,
    )
    return [r["student_id"] for r in rows]


async def cancel_outdated(conn, *, payload_key: str, entity_id: int, kinds: tuple[str, ...]) -> int:
    """Mark reminders about an old schedule as cancelled and stop their pending
    email/WhatsApp deliveries. They stay in history, labelled as outdated."""
    rows = await conn.fetch(
        """UPDATE notifications SET cancelled_at=now()
           WHERE payload->>$1 = $2 AND kind = ANY($3::text[]) AND cancelled_at IS NULL
           RETURNING id""",
        payload_key, str(entity_id), list(kinds),
    )
    ids = [r["id"] for r in rows]
    if ids:
        await conn.execute(
            """UPDATE notification_deliveries SET status='cancelled',
                      last_error_code='superseded_by_reschedule', updated_at=now()
               WHERE notification_id = ANY($1::bigint[]) AND status IN ('pending','sending')""",
            ids,
        )
    return len(ids)
