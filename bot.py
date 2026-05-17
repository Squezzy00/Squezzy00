import asyncio
import random
from datetime import datetime
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message, CallbackQuery
from config import BOT_TOKEN, ADMIN_ID
from database import init_db, get_user, create_user, update_balance, update_energy, update_work_streak, update_last_work_hour, get_top_users, update_exp, update_level
from keyboards import main_keyboard, games_keyboard, get_work_keyboard, back_keyboard, get_bank_keyboard

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

active_works = {}

# ========== СТАРТ ==========
@dp.message(Command("start"))
async def cmd_start(message: Message):
    user_id = message.from_user.id
    name = message.from_user.full_name
    await create_user(user_id, name)
    
    text = (
        "🎴 **YUMA BOT** 🎴\n"
        "┏━━━━━━━━━━━━━━━━━━━━┓\n"
        f"┃  Добро пожаловать, {name}\n"
        "┃  Твой путь к величию начинается\n"
        "┃  здесь и сейчас.\n"
        "┗━━━━━━━━━━━━━━━━━━━━┛\n\n"
        "✨ **Используй кнопки ниже** ✨\n"
        "💫 Удачи в приключениях, воин!"
    )
    await message.answer(text, reply_markup=main_keyboard())

# ========== СОСТОЯНИЕ МИРА ==========
@dp.message(lambda message: message.text == "🌍 Состояние мира")
async def world_status(message: Message):
    from world import world_state
    
    # Визуальные шкалы
    def get_bar(value):
        filled = int((value + 100) / 200 * 10)
        return "█" * filled + "░" * (10 - filled)
    
    def get_status(value, high_good=False):
        if high_good:
            if value >= 70: return "🔴 ОПАСНО"
            if value >= 40: return "🟡 СРЕДНЕ"
            return "🟢 ХОРОШО"
        else:
            if value >= 70: return "🟢 ХОРОШО"
            if value >= 40: return "🟡 СРЕДНЕ"
            return "🔴 ПЛОХО"
    
    text = (
        "🌍 **YUMA WORLD** 🌍\n"
        "╔══════════════════════════════════════╗\n"
        f"║  🌡️ НАПРЯЖЕНИЕ    [{get_bar(world_state['tension'])}] {world_state['tension']}\n"
        f"║  💰 ИНФЛЯЦИЯ       [{get_bar(world_state['inflation'])}] {world_state['inflation']}\n"
        f"║  ⚖️ ЗАКОННОСТЬ     [{get_bar(world_state['legality'])}] {world_state['legality']}\n"
        f"║  🤝 ДОВЕРИЕ        [{get_bar(world_state['trust'])}] {world_state['trust']}\n"
        f"║  🌱 РАЗВИТИЕ       [{get_bar(world_state['development'])}] {world_state['development']}\n"
        f"║  🔮 ХАОС           [{get_bar(world_state['chaos'])}] {world_state['chaos']}\n"
        "╚══════════════════════════════════════╝\n"
    )
    
    # Активное событие
    if world_state.get("active_event"):
        event = world_state["active_event"]
        end_time = world_state.get("event_end_time")
        remaining = ""
        if end_time:
            remaining_delta = end_time - datetime.now()
            hours = int(remaining_delta.total_seconds() // 3600)
            minutes = int((remaining_delta.total_seconds() % 3600) // 60)
            remaining = f" Осталось: {hours}ч {minutes}м"
        
        text += (
            "\n⚡ **АКТИВНОЕ СОБЫТИЕ** ⚡\n"
            "╔══════════════════════════════════════╗\n"
            f"║  {event['name']}\n"
            "║ ──────────────────────────────────── ║\n"
            f"║  {event['desc']}\n"
            f"║{remaining}\n"
            "╚══════════════════════════════════════╝\n"
        )
    else:
        text += "\n✨ Мир спокоен. Наслаждайся затишьем ✨"
    
    # Добавляем прогноз
    text += "\n\n📈 **ПРОГНОЗ**\n"
    if world_state["tension"] > 60:
        text += "⚠️ Напряжение растёт — жди конфликтов\n"
    if world_state["chaos"] > 50:
        text += "🌀 Хаос нарастает — возможны аномалии\n"
    if world_state["development"] > 60:
        text += "✨ Развитие идёт полным ходом — работа будет прибыльной\n"
    
    await message.answer(text)
    
# ========== ПРОФИЛЬ ==========
@dp.message(lambda message: message.text == "👤 Мой профиль")
async def profile(message: Message):
    user = await get_user(message.from_user.id)
    
    if user['level'] >= 50:
        status_icon = "👑"
        status_text = "Легенда"
    elif user['level'] >= 25:
        status_icon = "💎"
        status_text = "Мастер"
    elif user['level'] >= 10:
        status_icon = "⭐"
        status_text = "Ветеран"
    elif user['level'] >= 5:
        status_icon = "🌟"
        status_text = "Боец"
    else:
        status_icon = "🌱"
        status_text = "Новичок"
    
    text = (
        f"🎴 **{user['name']}** 🎴\n"
        "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n"
        f"┃ 🆔 **ID** ━━━ {user['user_id']}\n"
        f"┃ {status_icon} **Статус** ━ {status_text}\n"
        f"┃ 📊 **Уровень** ━ {user['level']}\n"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃ 💰 **Наличка** ━ {user['cash']:,} €\n"
        f"┃ 🏦 **Банк** ━━━ {user['bank']:,} €\n"
        f"┃ 💰 **Всего** ━━ {user['cash'] + user['bank']:,} €\n"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃ ⚡ **Энергия** ━ {user['energy']}/100\n"
        f"┃ 🏆 **Опыт** ━━ {user['exp']:,} / {user['level'] * 1000}\n"
        "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
    )
    await message.answer(text)

# ========== БАЛАНС ==========
@dp.message(lambda message: message.text == "💰 Мой баланс")
async def balance(message: Message):
    user = await get_user(message.from_user.id)
    text = (
        "🏦 **БАЛАНС** 🏦\n"
        "╔════════════════════════╗\n"
        f"║ 💵 **Наличные** │ {user['cash']:,} €\n"
        "║ ────────────────────── ║\n"
        f"║ 🏦 **Банк**     │ {user['bank']:,} €\n"
        "║ ────────────────────── ║\n"
        f"║ 💰 **Итого**    │ {user['cash'] + user['bank']:,} €\n"
        "╚════════════════════════╝"
    )
    await message.answer(text)

# ========== ЭНЕРГИЯ ==========
@dp.message(lambda message: message.text == "⚡ Моя энергия")
async def energy(message: Message):
    user = await get_user(message.from_user.id)
    
    energy_bars = "█" * (user['energy'] // 10) + "░" * (10 - user['energy'] // 10)
    
    text = (
        "⚡ **ЭНЕРГИЯ** ⚡\n"
        "╔════════════════════════╗\n"
        f"║ [{energy_bars}]\n"
        f"║\n"
        f"║ 📊 **Текущий запас** │ {user['energy']} / 100\n"
        "║ ────────────────────── ║\n"
        "║ 🔄 **Восстановление** │ +5 / 30 мин\n"
        "║ 💪 **Работа требует** │ 10 энергии\n"
        "╚════════════════════════╝"
    )
    await message.answer(text)

# ========== РАБОТА ==========
@dp.message(lambda message: message.text == "💼 Работать")
async def start_work(message: Message):
    user_id = message.from_user.id
    user = await get_user(user_id)
    
    if user['energy'] < 10:
        text = (
            "❌ **НЕДОСТАТОЧНО ЭНЕРГИИ** ❌\n"
            "╔════════════════════════════╗\n"
            "║  Требуется энергии: 10     ║\n"
            f"║  Твоя энергия:     {user['energy']}        ║\n"
            "║ ───────────────────────── ║\n"
            "║  💤 Отдохни, энергия       ║\n"
            "║  восстанавливается каждые  ║\n"
            "║  30 минут.                 ║\n"
            "╚════════════════════════════╝"
        )
        await message.answer(text)
        return
    
    current_hour = datetime.now().hour
    if user['last_work_hour'] == current_hour and user['work_streak'] >= 3:
        text = (
            "⏰ **ЛИМИТ РАБОТЫ** ⏰\n"
            "╔════════════════════════════╗\n"
            "║  Ты уже отработал 3 смены  ║\n"
            "║  в этом часе.              ║\n"
            "║ ───────────────────────── ║\n"
            "║  🍵 Отдохни, следующая     ║\n"
            "║  смена через час!          ║\n"
            "╚════════════════════════════╝"
        )
        await message.answer(text)
        return
    
    scenes = [
        ("🧹 **УБОРЩИК ПАГОДЫ**", "лужа в коридоре", "🧽 Убрать", "clean"),
        ("🧹 **УБОРЩИК ПАГОДЫ**", "пятно на полу", "🧴 Средство", "spray"),
        ("🧹 **УБОРЩИК ПАГОДЫ**", "мокрый вход", "⚠️ Знак", "sign"),
        ("🍣 **ПОВАР СУШИ**", "заказ с тунцом", "🐟 Тунец", "tuna"),
        ("🍣 **ПОВАР СУШИ**", "заказ с лососем", "🐠 Лосось", "salmon"),
        ("⚔️ **ТРЕНИРОВКА**", "удар по мешку", "👊 Прямой удар", "punch"),
        ("⚔️ **ТРЕНИРОВКА**", "блок удара", "🛡️ Поставить блок", "block"),
        ("📦 **КЛАДОВЩИК**", "разгрузить товар", "📦 Взять коробку", "take"),
        ("📦 **КЛАДОВЩИК**", "отправить на склад", "🚛 Погрузить", "load"),
    ]
    
    random.shuffle(scenes)
    work_rounds = scenes[:3]
    
    active_works[user_id] = {
        "rounds": work_rounds,
        "current_round": 0,
        "streak": user['work_streak'] if user['last_work_hour'] == current_hour else 0,
        "hour": current_hour,
        "perfect": True
    }
    
    await next_work_round(message, user_id)

async def next_work_round(message: Message, user_id):
    work_data = active_works.get(user_id)
    if not work_data:
        return
    
    current = work_data["current_round"]
    rounds = work_data["rounds"]
    
    if current >= len(rounds):
        await finish_work(message, user_id)
        return
    
    job_title, situation, button_text, action = rounds[current]
    round_num = current + 1
    
    text = (
        f"🛠 **РАБОЧАЯ СМЕНА** 🛠\n"
        "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n"
        f"┃  {job_title}\n"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃  🔢 **раунд:** {round_num}/3\n"
        f"┃  📋 **ситуация:** {situation}\n"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃  🎯 **нажми:** {button_text}\n"
        "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\n"
        "👇 **выбери нужную кнопку**"
    )
    
    await message.answer(text, reply_markup=get_work_keyboard(round_num, action, button_text))

@dp.callback_query(lambda c: c.data.startswith("work_"))
async def handle_work_action(callback: CallbackQuery):
    user_id = callback.from_user.id
    work_data = active_works.get(user_id)
    
    if not work_data:
        await callback.answer("❌ Нет активной смены!", show_alert=True)
        return
    
    _, action, round_num = callback.data.split("_")
    round_num = int(round_num)
    
    if work_data["current_round"] + 1 != round_num:
        await callback.answer("❌ Не та кнопка!", show_alert=True)
        return
    
    _, _, _, expected_action = work_data["rounds"][work_data["current_round"]]
    
    if action != expected_action:
        work_data["perfect"] = False
        await callback.answer("⚠️ Неправильно! Но двигаемся дальше...", show_alert=True)
    else:
        await callback.answer("✅ Правильно!", show_alert=False)
    
    work_data["current_round"] += 1
    await callback.message.delete()
    await next_work_round(callback.message, user_id)

async def finish_work(message: Message, user_id):
    work_data = active_works.pop(user_id, {})
    user = await get_user(user_id)
    
    base_reward = random.randint(30000, 80000) + user['level'] * 5000
    exp_gain = random.randint(50, 150)
    perfect_bonus = 0
    perfect_text = ""
    
    if work_data.get("perfect", False):
        perfect_bonus = int(base_reward * 0.08)
        perfect_text = "\n║  🏆 **идеальная смена** │ +8%"
    
    total_reward = base_reward + perfect_bonus
    
    current_hour = datetime.now().hour
    new_streak = work_data.get("streak", 0) + 1
    await update_work_streak(user_id, new_streak)
    await update_last_work_hour(user_id, current_hour)
    
    await update_balance(user_id, total_reward, 'cash')
    await update_energy(user_id, -10)
    
    new_exp = user['exp'] + exp_gain
    new_level = user['level']
    level_up_text = ""
    
    if new_exp >= user['level'] * 1000:
        new_level = user['level'] + 1
        await update_level(user_id, new_level, new_exp)
        level_up_text = (
            "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            f"🎉 **LEVEL UP!** {user['level']} → {new_level} 🎉\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
    else:
        await update_exp(user_id, new_exp)
    
    text = (
        "✅ **СМЕНА ЗАВЕРШЕНА** ✅\n"
        "┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\n"
        f"┃  🔢 **шагов пройдено:** 3/3\n"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃  💴 **награда:** +{total_reward:,} €\n"
        f"┃  📈 **опыт:** +{exp_gain}\n"
        f"{perfect_text}"
        "┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┫\n"
        f"┃  🔥 **подряд смен:** {new_streak}\n"
        f"┃  ⏱ **за час:** {new_streak}/3\n"
        "┃  ⌛ **отдых:** 02м 00с\n"
        "┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛"
        f"{level_up_text}"
    )
    
    await message.answer(text)

# ========== БАНК ==========
@dp.message(lambda message: message.text == "🏦 Положить в банк")
async def bank_deposit_prompt(message: Message):
    text = (
        "🏦 **БАНК** 🏦\n"
        "╔════════════════════════════╗\n"
        "║  Введи команду:            ║\n"
        "║  💸 **положить [сумма]**    ║\n"
        "║  💸 **снять [сумма]**       ║\n"
        "║ ───────────────────────── ║\n"
        "║  📝 **Пример:**            ║\n"
        "║  положить 50000            ║\n"
        "║  снять 25000               ║\n"
        "╚════════════════════════════╝"
    )
    await message.answer(text)

@dp.message(lambda message: message.text.startswith("положить"))
async def bank_deposit(message: Message):
    try:
        amount = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        
        if amount <= 0:
            await message.answer("❌ Сумма должна быть больше 0")
        elif user['cash'] >= amount:
            await update_balance(message.from_user.id, -amount, 'cash')
            await update_balance(message.from_user.id, amount, 'bank')
            text = (
                "🏦 **ПОПОЛНЕНИЕ** 🏦\n"
                "╔════════════════════════════╗\n"
                f"║  ✅ {amount:,} € положено    ║\n"
                "║  в банк.                    ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        else:
            await message.answer(f"❌ Недостаточно налички! У тебя {user['cash']:,} €")
    except:
        await message.answer("❌ Пример: положить 50000")

@dp.message(lambda message: message.text.startswith("снять"))
async def bank_withdraw(message: Message):
    try:
        amount = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        
        if amount <= 0:
            await message.answer("❌ Сумма должна быть больше 0")
        elif user['bank'] >= amount:
            await update_balance(message.from_user.id, amount, 'cash')
            await update_balance(message.from_user.id, -amount, 'bank')
            text = (
                "🏦 **СНЯТИЕ** 🏦\n"
                "╔════════════════════════════╗\n"
                f"║  ✅ {amount:,} € снято       ║\n"
                "║  с банка.                   ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        else:
            await message.answer(f"❌ Недостаточно в банке! У тебя {user['bank']:,} €")
    except:
        await message.answer("❌ Пример: снять 50000")

# ========== ИГРЫ ==========
@dp.message(lambda message: message.text == "🎮 Игры")
async def games_menu(message: Message):
    text = (
        "🎲 **ИГРЫ** 🎲\n"
        "╔════════════════════════════╗\n"
        "║  🎲 **кости** [сумма]       ║\n"
        "║  🎰 **слоты** [сумма]       ║\n"
        "║  🪙 **монетка** [сумма]     ║\n"
        "╚════════════════════════════╝\n"
        "📝 **Пример:** кости 5000"
    )
    await message.answer(text, reply_markup=games_keyboard())

@dp.message(lambda message: message.text == "◀️ Назад")
async def back_to_menu(message: Message):
    await message.answer("📋 Главное меню:", reply_markup=main_keyboard())

@dp.message(lambda message: message.text.startswith("кости"))
async def dice_game(message: Message):
    try:
        bet = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,} €")
            return
        
        user_roll = random.randint(1, 6)
        bot_roll = random.randint(1, 6)
        
        if user_roll > bot_roll:
            win = bet
            await update_balance(message.from_user.id, win, 'cash')
            text = (
                "🎲 **КОСТИ** 🎲\n"
                "╔════════════════════════════╗\n"
                f"║  🎲 Твой бросок: {user_roll}         ║\n"
                f"║  🤖 Бросок бота: {bot_roll}         ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ✅ Ты выиграл {win:,} €!      ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        elif user_roll < bot_roll:
            await update_balance(message.from_user.id, -bet, 'cash')
            text = (
                "🎲 **КОСТИ** 🎲\n"
                "╔════════════════════════════╗\n"
                f"║  🎲 Твой бросок: {user_roll}         ║\n"
                f"║  🤖 Бросок бота: {bot_roll}         ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ❌ Ты проиграл {bet:,} €       ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        else:
            text = (
                "🎲 **КОСТИ** 🎲\n"
                "╔════════════════════════════╗\n"
                f"║  🎲 Твой бросок: {user_roll}         ║\n"
                f"║  🤖 Бросок бота: {bot_roll}         ║\n"
                "║ ───────────────────────── ║\n"
                "║  🤝 Ничья! Ставка возвращена ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
    except:
        await message.answer("❌ Пример: кости 5000")

@dp.message(lambda message: message.text.startswith("слоты"))
async def slots_game(message: Message):
    try:
        bet = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,} €")
            return
        
        symbols = ['🍒', '🍋', '🍊', '💎', '7️⃣', '🎰']
        reel1 = random.choice(symbols)
        reel2 = random.choice(symbols)
        reel3 = random.choice(symbols)
        
        win = 0
        if reel1 == reel2 == reel3:
            if reel1 == '7️⃣':
                win = bet * 10
            elif reel1 == '💎':
                win = bet * 5
            else:
                win = bet * 3
        elif reel1 == reel2 or reel2 == reel3 or reel1 == reel3:
            win = bet * 2
        
        if win > 0:
            await update_balance(message.from_user.id, win, 'cash')
            text = (
                "🎰 **СЛОТЫ** 🎰\n"
                "╔════════════════════════════╗\n"
                f"║  {reel1} │ {reel2} │ {reel3}              ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ✅ Ты выиграл {win:,} €!       ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        else:
            await update_balance(message.from_user.id, -bet, 'cash')
            text = (
                "🎰 **СЛОТЫ** 🎰\n"
                "╔════════════════════════════╗\n"
                f"║  {reel1} │ {reel2} │ {reel3}              ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ❌ Ты проиграл {bet:,} €        ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
    except:
        await message.answer("❌ Пример: слоты 5000")

@dp.message(lambda message: message.text.startswith("монетка"))
async def coin_game(message: Message):
    try:
        bet = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,} €")
            return
        
        result = random.choice(['Орёл', 'Решка'])
        user_choice = random.choice(['Орёл', 'Решка'])
        
        if result == user_choice:
            win = bet * 2
            await update_balance(message.from_user.id, win, 'cash')
            text = (
                "🪙 **МОНЕТКА** 🪙\n"
                "╔════════════════════════════╗\n"
                f"║  🪙 Выпал: {result}           ║\n"
                f"║  🎲 Твоя ставка: {user_choice}    ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ✅ Ты выиграл {win:,} €!       ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
        else:
            await update_balance(message.from_user.id, -bet, 'cash')
            text = (
                "🪙 **МОНЕТКА** 🪙\n"
                "╔════════════════════════════╗\n"
                f"║  🪙 Выпал: {result}           ║\n"
                f"║  🎲 Твоя ставка: {user_choice}    ║\n"
                "║ ───────────────────────── ║\n"
                f"║  ❌ Ты проиграл {bet:,} €        ║\n"
                "╚════════════════════════════╝"
            )
            await message.answer(text)
    except:
        await message.answer("❌ Пример: монетка 5000")

# ========== ТОП ==========
@dp.message(lambda message: message.text == "🏆 Топ игроков")
async def top(message: Message):
    top_users = await get_top_users(10)
    if not top_users:
        await message.answer("❌ Топ пуст")
        return
    
    text = "🏆 **ТОП-10 БОГАЧЕЙ** 🏆\n╔════════════════════════════╗\n"
    for i, user in enumerate(top_users, 1):
        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else "📌"
        text += f"║ {medal} {i}. {user['name'][:15]} │ {user['total']:,} €\n"
    text += "╚════════════════════════════╝"
    await message.answer(text)

# ========== ПОМОЩЬ ==========
@dp.message(lambda message: message.text == "❓ Помощь")
async def help_cmd(message: Message):
    text = (
        "🎮 **YUMA BOT - ПОМОЩЬ** 🎮\n"
        "╔══════════════════════════════════════╗\n"
        "║  👤 **Мой профиль** — твоя статистика  ║\n"
        "║  💰 **Мой баланс** — твои деньги       ║\n"
        "║  💼 **Работать** — заработать деньги   ║\n"
        "║  🏦 **Банк** — сохранить/забрать       ║\n"
        "║  ⚡ **Моя энергия** — запас сил        ║\n"
        "║  🎮 **Игры** — испытать удачу          ║\n"
        "║  🏆 **Топ игроков** — лучшие игроки    ║\n"
        "╠══════════════════════════════════════╣\n"
        "║  📝 **Команды:**                        ║\n"
        "║  • кости [сумма] — игра в кости        ║\n"
        "║  • слоты [сумма] — слоты               ║\n"
        "║  • монетка [сумма] — орёл/решка        ║\n"
        "║  • положить [сумма] — в банк           ║\n"
        "║  • снять [сумма] — из банка            ║\n"
        "╚══════════════════════════════════════╝\n"
        "⚡ Энергия восстанавливается на 5 каждые 30 минут"
    )
    await message.answer(text)

# ========== АДМИН ==========
@dp.message(lambda message: message.text.startswith("выдать") and message.from_user.id == ADMIN_ID)
async def admin_give(message: Message):
    try:
        parts = message.text.split()
        if len(parts) != 3:
            await message.answer("❌ Пример: выдать 5005387093 50000")
            return
        
        user_id = int(parts[1])
        amount = int(parts[2])
        await update_balance(user_id, amount, 'cash')
        await message.answer(f"✅ Выдано {amount:,} € пользователю {user_id}")
    except:
        await message.answer("❌ Ошибка. Пример: выдать ID сумма")

@dp.message(lambda message: message.text.startswith("дать энергию") and message.from_user.id == ADMIN_ID)
async def admin_energy(message: Message):
    try:
        parts = message.text.split()
        if len(parts) != 3:
            await message.answer("❌ Пример: дать энергию 5005387093 50")
            return
        
        user_id = int(parts[1])
        energy_amount = int(parts[2])
        from database import pool
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET energy = LEAST(energy + $1, 100) WHERE user_id = $2", energy_amount, user_id)
        await message.answer(f"✅ Добавлено {energy_amount} энергии пользователю {user_id}")
    except:
        await message.answer("❌ Ошибка. Пример: дать энергию ID 50")

# ========== ФОНОВОЕ ВОССТАНОВЛЕНИЕ ==========
async def restore_energy_background():
    while True:
        await asyncio.sleep(1800)
        from database import pool
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET energy = LEAST(energy + 5, 100)")

# ========== ЗАПУСК ==========
async def main():
    await init_db()
    asyncio.create_task(restore_energy_background())
    print("🚀 YUMA BOT ЗАПУЩЕН!")
    print(f"👑 АДМИН: {ADMIN_ID}")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
