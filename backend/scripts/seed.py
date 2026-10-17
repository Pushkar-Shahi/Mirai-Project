"""Dev seed data. Run: docker compose exec api python -m scripts.seed
Safe to run more than once. All users have the password: password123
"""
import asyncio
import os

import asyncpg

from app.core.security import hash_password

PW = hash_password("password123")


async def main():
    conn = await asyncpg.connect(os.environ["DATABASE_URL"])

    for name in ("Rathinam", "Hitech", "JU Sitapura"):
        await conn.execute("INSERT INTO campus (name) VALUES ($1) ON CONFLICT DO NOTHING", name)
    rathinam_id = await conn.fetchval("SELECT id FROM campus WHERE name='Rathinam'")
    hitech_id = await conn.fetchval("SELECT id FROM campus WHERE name='Hitech'")
    ju_id = await conn.fetchval("SELECT id FROM campus WHERE name='JU Sitapura'")

    users = [
        # role, campus, student_code, email, name
        ("super_admin", None, None, "super@demo.edu", "Super Admin"),
        ("campus_admin", rathinam_id, None, "admin@demo.edu", "Rathinam Campus Admin"),
        ("advisor", rathinam_id, None, "advisor@demo.edu", "Dr. Advisor"),
        ("coordinator", rathinam_id, None, "coord@demo.edu", "Robotics Coordinator"),
        ("student", rathinam_id, "S001", "s001@demo.edu", "Student One"),
        ("student", rathinam_id, "S002", "s002@demo.edu", "Student Two"),
        ("student", rathinam_id, "S003", "s003@demo.edu", "Student Three"),
        ("student", hitech_id, "N001", "n001@demo.edu", "Hitech Student"),
    ]
    for role, campus, code, email, name in users:
        await conn.execute(
            """INSERT INTO users (role, campus_id, student_code, email, name, pw_hash)
               VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING""",
            role, campus, code, email, name, PW,
        )

    advisor_id = await conn.fetchval("SELECT id FROM users WHERE email='advisor@demo.edu'")
    coord_id = await conn.fetchval("SELECT id FROM users WHERE email='coord@demo.edu'")

    # Robotics has capacity 2 on purpose, so you can test "club full".
    for name, cap in (("Robotics", 2), ("Coding Club", 30)):
        await conn.execute(
            """INSERT INTO clubs (campus_id, name, capacity, advisor_id)
               VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING""",
            rathinam_id, name, cap, advisor_id,
        )
    # chill club at Hitech
    await conn.execute(
        """INSERT INTO clubs (campus_id, name, capacity)
           VALUES ($1, 'chill', 20) ON CONFLICT DO NOTHING""",
        hitech_id,
    )
    robotics = await conn.fetchval("SELECT id FROM clubs WHERE name='Robotics'")
    coding_club = await conn.fetchval("SELECT id FROM clubs WHERE name='Coding Club'")
    s001_id = await conn.fetchval("SELECT id FROM users WHERE email='s001@demo.edu'")

    await conn.execute(
        "INSERT INTO club_coordinators (club_id, user_id) VALUES ($1,$2) ON CONFLICT DO NOTHING",
        robotics, coord_id,
    )
    if s001_id and robotics and coding_club:
        # Robotics: Student One as primary (pending)
        await conn.execute(
            """INSERT INTO club_memberships (student_id, club_id, type, status)
               VALUES ($1, $2, 'primary', 'pending')
               ON CONFLICT (student_id, club_id) WHERE status IN ('pending','approved') DO NOTHING""",
            s001_id, robotics,
        )
        # Coding Club: Student One as secondary (approved)
        await conn.execute(
            """INSERT INTO club_memberships (student_id, club_id, type, status)
               VALUES ($1, $2, 'secondary', 'approved')
               ON CONFLICT (student_id, club_id) WHERE status IN ('pending','approved') DO NOTHING""",
            s001_id, coding_club,
        )
    await conn.close()
    print("Seeded. Login e.g. s001@demo.edu / password123")


asyncio.run(main())