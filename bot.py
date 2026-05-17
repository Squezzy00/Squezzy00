import asyncio
import random
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message
from config import BOT_TOKEN, ADMIN_ID
from database import init_db, get_user, create_user, update_balance, update_energy, update_work_time, get_top_users
from keyboards import main_keyboard, games_keyboard, back_keyboard

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# ========== СТАРТ ==========
@dp.message(Command("start"))
async def cmd_start(message: Message):
    user_id = message.from_user.id
    name = message.from_user.full_name
    await create_user(user_id, name)
    await message.answer(
        f"🎮 Добро пожаловать в YumaBot, {name}!\n\n"
        f"Используй кнопки ниже для навигации 👇",
        reply_markup=main_keyboard()
    )

# ========== ПРОФИЛЬ ==========
@dp.message(lambda message: message.text == "👤 Мой профиль")
async def profile(message: Message):
    user = await get_user(message.from_user.id)
    if user:
        text = (f"🎮 {user['name']}, твой профиль:\n\n"
                f"🆔 ID: {user['user_id']}\n"
                f"💰 Наличка: {user['cash']:,}€\n"
                f"🏦 В банке: {user['bank']:,}€\n"
                f"⚡ Энергия: {user['energy']}/100\n"
                f"🏆 Опыт: {user['exp']:,}\n"
                f"📊 Уровень: {user['level']}\n"
                f"💎 Статус: {user['status']}")
        await message.answer(text)
    else:
        await message.answer("❌ Ты не зарегистрирован. Напиши /start")

# ========== БАЛАНС ==========
@dp.message(lambda message: message.text == "💰 Мой баланс")
async def balance(message: Message):
    user = await get_user(message.from_user.id)
    await message.answer(f"💰 Твой баланс:\n\n💵 Наличка: {user['cash']:,}€\n🏦 В банке: {user['bank']:,}€")

# ========== ЭНЕРГИЯ ==========
@dp.message(lambda message: message.text == "⚡ Моя энергия")
async def energy(message: Message):
    user = await get_user(message.from_user.id)
    await message.answer(f"⚡ Твоя энергия: {user['energy']}/100\n\nВосстанавливается на 5 каждые 30 минут")

# ========== РАБОТА ==========
@dp.message(lambda message: message.text == "💼 Работать")
async def work(message: Message):
    user = await get_user(message.from_user.id)
    
    if user['energy'] < 10:
        await message.answer("❌ Недостаточно энергии! Отдохни, энергия восстанавливается каждые 30 минут.")
        return
    
    reward = random.randint(30000, 80000) + user['level'] * 5000
    exp_gain = random.randint(50, 150)
    
    await update_balance(message.from_user.id, reward, 'cash')
    await update_energy(message.from_user.id, -10)
    
    new_exp = user['exp'] + exp_gain
    new_level = user['level']
    level_up = False
    
    if new_exp >= user['level'] * 1000:
        new_level = user['level'] + 1
        level_up = True
        from database import pool
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET exp = $1, level = $2 WHERE user_id = $3", new_exp, new_level, message.from_user.id)
    else:
        from database import pool
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET exp = $1 WHERE user_id = $2", new_exp, message.from_user.id)
    
    await update_work_time(message.from_user.id)
    
    result = f"✅ Ты отработал смену и получил:\n💰 {reward:,}€\n⭐️ +{exp_gain} опыта\n⚡ -10 энергии"
    if level_up:
        result += f"\n\n🎉 ПОЗДРАВЛЯЮ! Ты повысил уровень до {new_level}! 🎉"
    
    await message.answer(result)

# ========== БАНК ==========
@dp.message(lambda message: message.text == "🏦 Положить в банк")
async def bank_deposit_prompt(message: Message):
    await message.answer("💰 Введи команду: банк положить [сумма]\n\nПример: банк положить 50000")

@dp.message(lambda message: message.text == "🏦 Снять с банка")
async def bank_withdraw_prompt(message: Message):
    await message.answer("💰 Введи команду: банк снять [сумма]\n\nПример: банк снять 50000")

@dp.message(lambda message: message.text.startswith("банк положить"))
async def bank_deposit(message: Message):
    try:
        amount = int(message.text.split()[2])
        user = await get_user(message.from_user.id)
        
        if amount <= 0:
            await message.answer("❌ Сумма должна быть больше 0")
        elif user['cash'] >= amount:
            await update_balance(message.from_user.id, -amount, 'cash')
            await update_balance(message.from_user.id, amount, 'bank')
            await message.answer(f"✅ {amount:,}€ положено в банк")
        else:
            await message.answer(f"❌ Недостаточно налички. У тебя {user['cash']:,}€")
    except:
        await message.answer("❌ Пример: банк положить 50000")

@dp.message(lambda message: message.text.startswith("банк снять"))
async def bank_withdraw(message: Message):
    try:
        amount = int(message.text.split()[2])
        user = await get_user(message.from_user.id)
        
        if amount <= 0:
            await message.answer("❌ Сумма должна быть больше 0")
        elif user['bank'] >= amount:
            await update_balance(message.from_user.id, amount, 'cash')
            await update_balance(message.from_user.id, -amount, 'bank')
            await message.answer(f"✅ {amount:,}€ снято с банка")
        else:
            await message.answer(f"❌ Недостаточно в банке. У тебя {user['bank']:,}€")
    except:
        await message.answer("❌ Пример: банк снять 50000")

# ========== ИГРЫ ==========
@dp.message(lambda message: message.text == "🎮 Игры")
async def games_menu(message: Message):
    await message.answer("🎲 Выбери игру:", reply_markup=games_keyboard())

@dp.message(lambda message: message.text == "◀️ Назад")
async def back_to_menu(message: Message):
    await message.answer("📋 Главное меню:", reply_markup=main_keyboard())

@dp.message(lambda message: message.text.startswith("кости"))
async def dice_game(message: Message):
    try:
        parts = message.text.split()
        if len(parts) != 2:
            await message.answer("❌ Пример: кости 5000")
            return
        
        bet = int(parts[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,}€")
            return
        
        user_roll = random.randint(1, 6)
        bot_roll = random.randint(1, 6)
        
        if user_roll > bot_roll:
            win = bet
            await update_balance(message.from_user.id, win, 'cash')
            await message.answer(f"🎲 Твой бросок: {user_roll}\n🤖 Бросок бота: {bot_roll}\n\n✅ Ты выиграл {win:,}€!")
        elif user_roll < bot_roll:
            await update_balance(message.from_user.id, -bet, 'cash')
            await message.answer(f"🎲 Твой бросок: {user_roll}\n🤖 Бросок бота: {bot_roll}\n\n❌ Ты проиграл {bet:,}€")
        else:
            await message.answer(f"🎲 Твой бросок: {user_roll}\n🤖 Бросок бота: {bot_roll}\n\n🤝 Ничья! Ставка возвращена")
    except ValueError:
        await message.answer("❌ Введи число. Пример: кости 5000")

@dp.message(lambda message: message.text.startswith("слоты"))
async def slots_game(message: Message):
    try:
        parts = message.text.split()
        if len(parts) != 2:
            await message.answer("❌ Пример: слоты 5000")
            return
        
        bet = int(parts[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,}€")
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
            await message.answer(f"🎰 {reel1} | {reel2} | {reel3}\n\n✅ Ты выиграл {win:,}€!")
        else:
            await update_balance(message.from_user.id, -bet, 'cash')
            await message.answer(f"🎰 {reel1} | {reel2} | {reel3}\n\n❌ Ты проиграл {bet:,}€")
    except ValueError:
        await message.answer("❌ Пример: слоты 5000")

@dp.message(lambda message: message.text.startswith("монетка"))
async def coin_game(message: Message):
    try:
        parts = message.text.split()
        if len(parts) != 2:
            await message.answer("❌ Пример: монетка 5000")
            return
        
        bet = int(parts[1])
        user = await get_user(message.from_user.id)
        
        if bet <= 0:
            await message.answer("❌ Ставка должна быть больше 0")
            return
        if user['cash'] < bet:
            await message.answer(f"❌ Недостаточно денег! У тебя {user['cash']:,}€")
            return
        
        result = random.choice(['Орёл', 'Решка'])
        user_choice = random.choice(['Орёл', 'Решка'])
        
        if result == user_choice:
            win = bet * 2
            await update_balance(message.from_user.id, win, 'cash')
            await message.answer(f"🪙 Выпал: {result}\n🎲 Твоя ставка: {user_choice}\n\n✅ Ты выиграл {win:,}€!")
        else:
            await update_balance(message.from_user.id, -bet, 'cash')
            await message.answer(f"🪙 Выпал: {result}\n🎲 Твоя ставка: {user_choice}\n\n❌ Ты проиграл {bet:,}€")
    except ValueError:
        await message.answer("❌ Пример: монетка 5000")

# ========== ТОП ==========
@dp.message(lambda message: message.text == "🏆 Топ игроков")
async def top(message: Message):
    top_users = await get_top_users(10)
    if not top_users:
        await message.answer("❌ Топ пуст")
        return
    
    text = "🏆 ТОП-10 БОГАЧЕЙ 🏆\n\n"
    for i, user in enumerate(top_users, 1):
        text += f"{i}. {user['name']} — {user['total']:,}€\n"
    await message.answer(text)

# ========== ПОМОЩЬ ==========
@dp.message(lambda message: message.text == "❓ Помощь")
async def help_cmd(message: Message):
    await message.answer(
        "🎮 **YumaBot - Помощь** 🎮\n\n"
        "👤 Мой профиль - информация о тебе\n"
        "💰 Мой баланс - твои деньги\n"
        "💼 Работать - заработать деньги и опыт\n"
        "🏦 Положить в банк - сохранить деньги\n"
        "🏦 Снять с банка - забрать деньги\n"
        "⚡ Моя энергия - текущий уровень энергии\n"
        "🎮 Игры - казино и азарт\n"
        "  • кости [сумма] - игра в кости\n"
        "  • слоты [сумма] - слоты\n"
        "  • монетка [сумма] - орёл/решка\n"
        "🏆 Топ игроков - таблица лидеров\n\n"
        "⚡ Энергия восстанавливается на 5 каждые 30 минут"
    )

# ========== АДМИН КОМАНДЫ (ТОЛЬКО ТЫ) ==========
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
        await message.answer(f"✅ Выдано {amount:,}€ пользователю {user_id}")
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
        await asyncio.sleep(1800)  # 30 минут
        from database import pool
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET energy = LEAST(energy + 5, 100)")

# ========== ЗАПУСК ==========
async def main():
    await init_db()
    asyncio.create_task(restore_energy_background())
    print("🚀 YumaBot запущен! Все команды на русском, без слешей")
    print(f"👑 Админ: {ADMIN_ID}")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())