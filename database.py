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
                reg_date TEXT,
                work_streak INT DEFAULT 0,
                last_work_hour INT DEFAULT 0
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS crypto_farms (
                user_id BIGINT PRIMARY KEY,
                name TEXT DEFAULT 'ЮмаФерма',
                cards INT DEFAULT 0,
                balance BIGINT DEFAULT 0
            )
        ''')
        await conn.execute('''
            CREATE TABLE IF NOT EXISTS businesses (
                user_id BIGINT PRIMARY KEY,
                biz_id INT,
                name TEXT,
                level INT DEFAULT 1,
                workers INT DEFAULT 0,
                balance BIGINT DEFAULT 0
            )
        ''')
        print("✅ База данных подключена")

async def get_user(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM users WHERE user_id = $1", user_id)

async def create_user(user_id, name):
    from datetime import datetime
    reg_date = datetime.now().strftime("%d.%m.%Y, %H:%M:%S")
    async with pool.acquire() as conn:
        await conn.execute(
            "INSERT INTO users (user_id, name, reg_date) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
            user_id, name, reg_date
        )

async def update_cash(user_id, amount):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET cash = cash + $1 WHERE user_id = $2", amount, user_id)

async def update_bank(user_id, amount):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET bank = bank + $1 WHERE user_id = $2", amount, user_id)

async def update_energy(user_id, delta):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET energy = energy + $1 WHERE user_id = $2", delta, user_id)

async def update_exp(user_id, amount):
    async with pool.acquire() as conn:
        await conn.execute("UPDATE users SET exp = exp + $1 WHERE user_id = $2", amount, user_id)
        user = await get_user(user_id)
        if user['level'] * 1000 <= user['exp']:
            await conn.execute("UPDATE users SET level = level + 1 WHERE user_id = $1", user_id)

async def get_reg_number(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchval("SELECT COUNT(*) FROM users WHERE user_id <= $1", user_id)

async def get_farm(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM crypto_farms WHERE user_id = $1", user_id)

async def create_farm(user_id):
    async with pool.acquire() as conn:
        await conn.execute("INSERT INTO crypto_farms (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING", user_id)

async def buy_cards(user_id, amount):
    async with pool.acquire() as conn:
        farm = await get_farm(user_id)
        if not farm:
            await create_farm(user_id)
        price = 35000 * amount
        user = await get_user(user_id)
        if user['cash'] >= price:
            await conn.execute("UPDATE users SET cash = cash - $1 WHERE user_id = $2", price, user_id)
            await conn.execute("UPDATE crypto_farms SET cards = cards + $1 WHERE user_id = $2", amount, user_id)
            return True, price
        return False, price

async def sell_cards(user_id, amount):
    async with pool.acquire() as conn:
        farm = await get_farm(user_id)
        if farm and farm['cards'] >= amount:
            price = 15750 * amount
            await conn.execute("UPDATE users SET cash = cash + $1 WHERE user_id = $2", price, user_id)
            await conn.execute("UPDATE crypto_farms SET cards = cards - $1 WHERE user_id = $2", amount, user_id)
            return True, price
        return False, 0

async def collect_farm(user_id):
    async with pool.acquire() as conn:
        farm = await get_farm(user_id)
        if farm:
            profit = farm['cards']
            await conn.execute("UPDATE crypto_farms SET balance = balance + $1 WHERE user_id = $2", profit, user_id)
            return profit
        return 0

async def withdraw_farm(user_id):
    async with pool.acquire() as conn:
        farm = await get_farm(user_id)
        if farm and farm['balance'] > 0:
            cash = farm['balance'] * 50000
            await conn.execute("UPDATE users SET cash = cash + $1 WHERE user_id = $2", cash, user_id)
            await conn.execute("UPDATE crypto_farms SET balance = 0 WHERE user_id = $1", user_id)
            return cash
        return 0

async def get_business(user_id):
    async with pool.acquire() as conn:
        return await conn.fetchrow("SELECT * FROM businesses WHERE user_id = $1", user_id)

async def buy_business(user_id, biz_id, biz_name, price):
    async with pool.acquire() as conn:
        user = await get_user(user_id)
        if user['cash'] >= price:
            await conn.execute("UPDATE users SET cash = cash - $1 WHERE user_id = $2", price, user_id)
            await conn.execute(
                "INSERT INTO businesses (user_id, biz_id, name) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING",
                user_id, biz_id, biz_name
            )
            return True
        return False

async def hire_workers(user_id, amount):
    async with pool.acquire() as conn:
        biz = await get_business(user_id)
        if biz:
            cost = 50000 * amount
            user = await get_user(user_id)
            if user['cash'] >= cost:
                await conn.execute("UPDATE users SET cash = cash - $1 WHERE user_id = $2", cost, user_id)
                await conn.execute("UPDATE businesses SET workers = workers + $1 WHERE user_id = $2", amount, user_id)
                return True, cost
        return False, 0

async def collect_business(user_id):
    async with pool.acquire() as conn:
        biz = await get_business(user_id)
        if biz:
            businesses = {
                1: {"income": 50}, 2: {"income": 50000}, 3: {"income": 500000},
                4: {"income": 750000}, 5: {"income": 25000000}
            }
            biz_data = businesses.get(biz['biz_id'], {"income": 100})
            profit = biz_data['income'] * (biz['workers'] + 1)
            await conn.execute("UPDATE businesses SET balance = balance + $1 WHERE user_id = $2", profit, user_id)
            return profit
        return 0

async def withdraw_business(user_id):
    async with pool.acquire() as conn:
        biz = await get_business(user_id)
        if biz and biz['balance'] > 0:
            await conn.execute("UPDATE users SET cash = cash + $1 WHERE user_id = $2", biz['balance'], user_id)
            await conn.execute("UPDATE businesses SET balance = 0 WHERE user_id = $1", user_id)
            return biz['balance']
        return 0

async def get_top_users():
    async with pool.acquire() as conn:
        return await conn.fetch("SELECT name, cash + bank as total FROM users ORDER BY total DESC LIMIT 10")
