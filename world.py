import random
import asyncio
from datetime import datetime, timedelta
from database import pool

# Текущее состояние мира
world_state = {
    "tension": 30,      # Напряжение (-100 до 100)
    "inflation": 20,    # Инфляция
    "legality": 50,     # Законность
    "trust": 40,        # Доверие
    "development": 30,  # Развитие
    "chaos": 10,        # Хаос
    "active_event": None,
    "event_end_time": None,
    "event_history": []
}

# Влияние действий на факторы
action_impacts = {
    "robbery_success": {"tension": 2, "legality": -3, "chaos": 1},
    "robbery_fail": {"tension": 1, "legality": -1},
    "work": {"development": 1, "inflation": -1},
    "donate": {"trust": 2, "development": 1},
    "marry": {"trust": 3, "chaos": -1},
    "divorce": {"trust": -5, "chaos": 2},
    "buy_weapon": {"tension": 2, "inflation": 1},
    "buy_house": {"development": 1, "inflation": 2},
    "clan_war": {"tension": 5, "legality": -3, "chaos": 2},
    "clan_peace": {"trust": 4, "tension": -3},
    "bank_deposit": {"inflation": -1, "trust": 1},
    "bank_withdraw": {"inflation": 1},
    "game_win": {"chaos": 1, "inflation": -1},
    "game_lose": {"chaos": -1}
}

# Библиотека событий
events_library = {
    "tension": {
        70: {
            "name": "🌋 **УЛИЧНЫЕ ВОЙНЫ**",
            "desc": "На улицах неспокойно, банды делят территорию.",
            "effects": {"robbery_bonus": 50, "weapon_price": 50, "tax": 30},
            "duration_hours": 4
        },
        90: {
            "name": "💀 **ГОРОД-КРЕПОСТЬ**",
            "desc": "Город на военном положении. Вход и выход заблокированы.",
            "effects": {"lockdown": True, "energy_regen": -50, "tax": 50},
            "duration_hours": 6
        }
    },
    "inflation": {
        70: {
            "name": "💰 **КРИЗИС ЦЕН**",
            "desc": "Деньги обесцениваются, цены взлетают до небес.",
            "effects": {"shop_price": 100, "work_reward": -30},
            "duration_hours": 3
        },
        -60: {
            "name": "📉 **ДЕФЛЯЦИЯ**",
            "desc": "Рынок рухнул, товары продают за бесценок.",
            "effects": {"shop_price": -50, "bank_interest": -50},
            "duration_hours": 4
        }
    },
    "legality": {
        -60: {
            "name": "🔫 **ДИКИЙ ЗАПАД**",
            "desc": "Закон спит. Грабить можно всех и везде.",
            "effects": {"robbery_no_cooldown": True, "police_ineffective": True},
            "duration_hours": 3
        },
        80: {
            "name": "⚖️ **ТОТАЛЬНЫЙ КОНТРОЛЬ**",
            "desc": "Полиция на каждом углу. Преступность под корень.",
            "effects": {"robbery_chance": -70, "fine_multiplier": 3},
            "duration_hours": 5
        }
    },
    "trust": {
        80: {
            "name": "🤝 **ВЕЛИКОЕ ЕДИНСТВО**",
            "desc": "Люди доверяют друг другу. Кланы объединяются.",
            "effects": {"clan_exp_bonus": 50, "marry_cost": -80},
            "duration_hours": 4
        },
        -50: {
            "name": "👺 **ЭПИДЕМИЯ ПРЕДАТЕЛЬСТВ**",
            "desc": "Никому нельзя верить. Даже членам клана.",
            "effects": {"clan_damage": 30, "divorce_chance": 50},
            "duration_hours": 3
        }
    },
    "development": {
        80: {
            "name": "✨ **ЗОЛОТОЙ ВЕК**",
            "desc": "Технологии расцветают. Работа приносит баснословные доходы.",
            "effects": {"work_reward": 100, "new_jobs": True},
            "duration_hours": 6
        },
        -40: {
            "name": "🕯️ **ТЁМНЫЕ ВЕКА**",
            "desc": "Знания утеряны. Даже простые профессии стали сложными.",
            "effects": {"work_reward": -50, "exp_gain": -50},
            "duration_hours": 4
        }
    },
    "chaos": {
        70: {
            "name": "🌀 **ХАОС И АНОМАЛИИ**",
            "desc": "Реальность искажается. Никто не знает, что ждать.",
            "effects": {"random_events_chance": 100, "teleport_random": True},
            "duration_hours": 2
        },
        90: {
            "name": "💢 **ВРЕМЕННАЯ ПЕТЛЯ**",
            "desc": "Время зациклилось. Каждый час повторяется.",
            "effects": {"time_loop": True, "energy_drain": 10},
            "duration_hours": 3
        }
    }
}

# Аномалии (редкие события)
anomalies = [
    {
        "name": "🃏 **ДЖОКЕР**",
        "desc": "Кто-то перевернул правила. Всё работает наоборот.",
        "effects": {"reverse_everything": True},
        "duration_hours": 2
    },
    {
        "name": "🎭 **ВЕЛИКИЙ ПЕРЕРОЖДЕНИЕ**",
        "desc": "Все игроки меняются ID на 24 часа. Хаос неизбежен.",
        "effects": {"swap_ids": True},
        "duration_hours": 24
    },
    {
        "name": "💸 **ДЕНЬ БЕЗУМИЯ**",
        "desc": "Опыт и деньги поменялись местами.",
        "effects": {"swap_exp_cash": True},
        "duration_hours": 3
    },
    {
        "name": "👻 **ПРОКЛЯТИЕ ОДИНОЧЕСТВА**",
        "desc": "Все браки расторгнуты. Жениться нельзя 24 часа.",
        "effects": {"no_marriage": True, "divorce_all": True},
        "duration_hours": 24
    }
]

async def apply_action_impact(action):
    """Применяет влияние действия на мир"""
    if action not in action_impacts:
        return
    
    impacts = action_impacts[action]
    for factor, delta in impacts.items():
        world_state[factor] = max(-100, min(100, world_state[factor] + delta))
    
    # Сохраняем в БД
    async with pool.acquire() as conn:
        await conn.execute("""
            UPDATE world_state SET 
                tension = $1, inflation = $2, legality = $3,
                trust = $4, development = $5, chaos = $6
        """, world_state["tension"], world_state["inflation"], 
        world_state["legality"], world_state["trust"], 
        world_state["development"], world_state["chaos"])

async def check_for_event():
    """Проверяет, нужно ли запустить событие"""
    # Проверяем аномалию (5% шанс)
    if random.random() < 0.05 and not world_state["active_event"]:
        anomaly = random.choice(anomalies)
        await start_event(anomaly["name"], anomaly["desc"], anomaly["effects"], anomaly["duration_hours"], is_anomaly=True)
        return
    
    # Проверяем факторы
    for factor, value in world_state.items():
        if factor not in events_library:
            continue
        
        thresholds = sorted(events_library[factor].keys())
        for threshold in thresholds:
            if (threshold > 0 and value >= threshold) or (threshold < 0 and value <= threshold):
                if not world_state["active_event"]:
                    event = events_library[factor][threshold]
                    await start_event(event["name"], event["desc"], event["effects"], event["duration_hours"])
                break

async def start_event(name, desc, effects, duration_hours, is_anomaly=False):
    """Запускает событие"""
    world_state["active_event"] = {
        "name": name,
        "desc": desc,
        "effects": effects,
        "is_anomaly": is_anomaly
    }
    world_state["event_end_time"] = datetime.now() + timedelta(hours=duration_hours)
    world_state["event_history"].append({
        "name": name,
        "time": datetime.now().isoformat()
    })
    
    # Шлём уведомление в чат
    from bot import bot
    chat_id = -1001234567890  # ID твоего чата @YumaBotchat
    
    text = (
        "🌍 **СОБЫТИЕ МИРА** 🌍\n"
        "╔══════════════════════════════════════╗\n"
        f"║  {name}\n"
        "║ ──────────────────────────────────── ║\n"
        f"║  {desc}\n"
        "╚══════════════════════════════════════╝\n\n"
        "⚡ Эффекты активированы на {duration_hours} часов"
    )
    
    try:
        await bot.send_message(chat_id, text)
    except:
        pass

async def end_event():
    """Завершает активное событие"""
    world_state["active_event"] = None
    world_state["event_end_time"] = None

async def world_loop():
    """Фоновый процесс мира"""
    while True:
        await asyncio.sleep(3600)  # Проверка раз в час
        
        # Обновляем факторы (естественная динамика)
        world_state["tension"] = max(-100, min(100, world_state["tension"] + random.randint(-3, 3)))
        world_state["inflation"] = max(-100, min(100, world_state["inflation"] + random.randint(-2, 4)))
        world_state["legality"] = max(-100, min(100, world_state["legality"] + random.randint(-2, 2)))
        world_state["trust"] = max(-100, min(100, world_state["trust"] + random.randint(-3, 3)))
        world_state["development"] = max(-100, min(100, world_state["development"] + random.randint(-1, 5)))
        world_state["chaos"] = max(-100, min(100, world_state["chaos"] + random.randint(-5, 5)))
        
        # Проверяем активное событие
        if world_state["active_event"] and world_state["event_end_time"] and datetime.now() >= world_state["event_end_time"]:
            await end_event()
        
        # Проверяем запуск нового события
        await check_for_event()

async def init_world():
    """Инициализация мира из БД"""
    async with pool.acquire() as conn:
        # Создаём таблицу если нет
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS world_state (
                id INT PRIMARY KEY DEFAULT 1,
                tension INT DEFAULT 30,
                inflation INT DEFAULT 20,
                legality INT DEFAULT 50,
                trust INT DEFAULT 40,
                development INT DEFAULT 30,
                chaos INT DEFAULT 10,
                active_event TEXT,
                event_end TIMESTAMP
            )
        """)
        
        # Загружаем состояние
        row = await conn.fetchrow("SELECT * FROM world_state WHERE id = 1")
        if row:
            world_state["tension"] = row["tension"]
            world_state["inflation"] = row["inflation"]
            world_state["legality"] = row["legality"]
            world_state["trust"] = row["trust"]
            world_state["development"] = row["development"]
            world_state["chaos"] = row["chaos"]
