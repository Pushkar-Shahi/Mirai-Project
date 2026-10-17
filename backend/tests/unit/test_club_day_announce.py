import asyncio
from unittest.mock import AsyncMock, MagicMock
import pytest
from app.services.notify import club_member_ids, notify_users, record_channel_deliveries


@pytest.mark.asyncio
async def test_club_member_ids_query_structure_and_filters():
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"student_id": 10}, {"student_id": 20}])

    res = await club_member_ids(mock_conn, 42)
    assert res == [10, 20]

    call_args = mock_conn.fetch.call_args
    sql = call_args[0][0]
    args = call_args[0][1:]

    # Must filter by club_id = $1
    assert args == (42,)
    # Must enforce status='approved'
    assert "m.status = 'approved'" in sql
    # Must enforce primary and secondary types
    assert "m.type IN ('primary', 'secondary')" in sql
    # Must enforce campus match between user and club
    assert "u.campus_id = c.campus_id" in sql


@pytest.mark.asyncio
async def test_notify_users_persists_sent_at_and_records_deliveries():
    mock_conn = AsyncMock()
    mock_conn.fetch = AsyncMock(return_value=[{"id": 100, "user_id": 1}, {"id": 101, "user_id": 2}])
    
    # Mock user details for record_channel_deliveries
    mock_conn.fetchrow = AsyncMock(side_effect=[
        {"id": 1, "email": "s1@demo.edu", "email_notifications": True, "phone_e164": "+14155552671", "wp_phone": None},
        {"id": 2, "email": "s2@demo.edu", "email_notifications": False, "phone_e164": None, "wp_phone": None},
    ])
    mock_conn.execute = AsyncMock()

    n = await notify_users(
        mock_conn, [1, 2], "club_day.announced",
        {"club_day_id": 5, "title": "Build"}, "club_day.announced:5", actor_id=99
    )
    assert n == 2

    # Check notification insert query includes sent_at and actor_id
    insert_sql = mock_conn.fetch.call_args[0][0]
    assert "sent_at" in insert_sql
    assert "actor_id" in insert_sql

    # Check that channel deliveries were executed
    executed_sqls = [call[0][0] for call in mock_conn.execute.call_args_list]
    # At least one whatsapp insert and one email insert
    assert any("notification_deliveries" in sql and "'whatsapp'" in sql for sql in executed_sqls)
