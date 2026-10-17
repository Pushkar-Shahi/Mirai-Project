import pytest
from fastapi import HTTPException
from app.routers.clubs import add_coordinator, CoordinatorIn


@pytest.mark.asyncio
async def test_add_coordinator_enforces_conditions():
    class MockConn:
        async def fetchrow(self, query, *args):
            if "FROM clubs" in query:
                return {
                    "id": 1,
                    "name": "Robotics",
                    "approval_status": "approved",
                    "is_active": True,
                    "campus_id": 10,
                }
            if "FROM users" in query:
                uid = args[0]
                if uid == 100:  # Valid coordinator on same campus
                    return {"id": 100, "name": "Robotics Coord", "role": "coordinator", "campus_id": 10, "email": "coord@demo.edu"}
                if uid == 101:  # Wrong role
                    return {"id": 101, "name": "Student A", "role": "student", "campus_id": 10, "email": "student@demo.edu"}
                if uid == 102:  # Wrong campus
                    return {"id": 102, "name": "Hitech Coord", "role": "coordinator", "campus_id": 20, "email": "hitech@demo.edu"}
                return None
            return None

        async def fetchval(self, query, *args):
            if "FROM club_coordinators" in query:
                # Mock already assigned if user_id == 103
                return 1 if args[1] == 103 else None
            if "FROM campus" in query:
                cid = args[0]
                return "Rathinam" if cid == 10 else "Hitech"
            return None

        async def execute(self, query, *args):
            return "INSERT 0 1"

    conn = MockConn()
    admin_user = {"id": 1, "role": "super_admin", "campus_id": None, "permissions": ["club.coordinators"]}

    # 1. Non-existent user
    with pytest.raises(HTTPException) as exc_info:
        await add_coordinator(1, CoordinatorIn(user_id=999), user=admin_user, conn=conn)
    assert exc_info.value.status_code == 404

    # 2. Wrong role
    with pytest.raises(HTTPException) as exc_info:
        await add_coordinator(1, CoordinatorIn(user_id=101), user=admin_user, conn=conn)
    assert exc_info.value.status_code == 422
    assert "Club coordinator role" in exc_info.value.detail

    # 3. Wrong campus
    with pytest.raises(HTTPException) as exc_info:
        await add_coordinator(1, CoordinatorIn(user_id=102), user=admin_user, conn=conn)
    assert exc_info.value.status_code == 422
    assert "Campus mismatch" in exc_info.value.detail

    # 4. Valid assignment
    res = await add_coordinator(1, CoordinatorIn(user_id=100), user=admin_user, conn=conn)
    assert res["user_id"] == 100
    assert res["name"] == "Robotics Coord"
