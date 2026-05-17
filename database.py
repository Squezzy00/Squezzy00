import asyncpg
from config import DATABASE_URL

pool = None

async def init_db():
    global pool
    pool = await asyncpg.create_pool(DATABASE_URL)
    async with pool.acquire() as conn:
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS users (
                user_id BIGINT PRIMARY KEY,
                name TEXT,
                cash BIGINT DEFAULT 50000,
                bank BIGINT DEFAULT 0,
                energy INT DEFAULT 100,
                exp BIGINT DEFAULT 0,
                level INT DEFAULT 1,
                status TEXT DEFAULT 'Новичок',
                work_time BIGINT DEFAULT 0,
                work_streak INT DEFAULT 0,
                last_work_hour INT DEFAULT 0
            )
        ''')
        print("✅ База данных подключена")

async def get_user(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM users WHERE user_id = $1", user_id)

async def create_user(user_id, name):
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (user_id, name) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING",
            user_id, name
        )

async def update_balance(user_id, amount, type_):
    async with pool.acquire() as conn:
        if type_ == 'cash':
            await conn.execute("UPDATE users SET cash = cash + $1 WHERE user_id = $2", amount, user_id)
        else:
            await conn.execute("UPDATE users SET bank = bank + $1 WHERE user_id = $2", amount, user_id)

async def update_energy(user_id, delta):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET energy = energy + $1 WHERE user_id = $2", delta, user_id)

async def update_work_streak(user_id, streak):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET work_streak = $1 WHERE user_id = $2", streak, user_id)

async def update_last_work_hour(user_id, hour):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET last_work_hour = $1 WHERE user_id = $2", hour, user_id)

async def update_exp(user_id, exp):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET exp = $1 WHERE user_id = $2", exp, user_id)

async def update_level(user_id, level, exp):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET level = $1, exp = $2 WHERE user_id = $3", level, exp, user_id)

async def record_world_action(user_id, action):
    """Записывает действие пользователя для мира"""
    async with pool.acquire() as conn:
        await conn.execute("""
            INSERT INTO world_actions (user_id, action, time)
            VALUES ($1, $2, NOW())
        """, user_id, action)

async def get_top_users(limit=10):
    async with pool.acquire() as conn:
        return await conn.fetch(
            "SELECT name, cash + bank as total FROM users ORDER BY total DESC LIMIT $1",
            limit
        )
