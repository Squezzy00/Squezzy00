import asyncio
import random
from datetime import datetime
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command
from aiogram.types import Message
from config import BOT_TOKEN, ADMIN_ID
from database import *
from keyboards import *

bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# ========== СТАРТ ==========
@dp.message(Command("start"))
async def cmd_start(message: Message):
    user_id = message.from_user.id
    name = message.from_user.first_name
    if not await get_user(user_id):
        await create_user(user_id, name)
    await message.answer(
        f"🌟 Добро пожаловать в YumaBot, {name}!\n\n"
        f"🎮 Твой путь к величию начинается здесь.\n"
        f"👇 Используй кнопки ниже или пиши команды словами",
        reply_markup=main_keyboard()
    )

# ========== ПРОФИЛЬ (работает и по кнопке, и по тексту "профиль") ==========
@dp.message(lambda m: m.text and m.text.lower() in ["профиль", "👤 профиль", "мой профиль", "profile"])
async def profile(message: Message):
    user = await get_user(message.from_user.id)
    reg_num = await get_reg_number(message.from_user.id)
    
    # Если нет даты регистрации — ставим текущую
    reg_date = user.get('reg_date') if user.get('reg_date') else datetime.now().strftime("%d.%m.%Y, %H:%M:%S")
    
    status = "💎 Платиновый VIP" if user['level'] >= 50 else "⭐ Золотой VIP" if user['level'] >= 25 else "🌱 Обычный игрок"
    
    text = f"""
╔══════════════════════════════════════╗
║              🎮 YUMA BOT 🎮           ║
╠══════════════════════════════════════╣
║ 🆔 ID: {reg_num}
║ 📛 Ник: {user['name']}
║ 🏅 Статус: {status}
║ 📊 Уровень: {user['level']}
╠══════════════════════════════════════╣
║ 💰 Наличные: {user['cash']:,} €
║ 🏦 В банке: {user['bank']:,} €
║ 💎 Итого: {user['cash'] + user['bank']:,} €
╠══════════════════════════════════════╣
║ ⚡ Энергия: {user['energy']}/100
║ 🎖️ Опыт: {user['exp']:,}
║ 👑 Рейтинг: {user['level'] * 100 + user['exp'] // 1000}
╠══════════════════════════════════════╣
║ 🚗 Машина: В разработке
║ 🐼 Питомец: В разработке
║ 🏠 Дом: В разработке
║ 🏪 Бизнес: {'✅' if await get_business(user['user_id']) else '❌'}
║ 🪙 Ферма: {'✅' if await get_farm(user['user_id']) else '❌'}
╠══════════════════════════════════════╣
║ 📅 Регистрация: {reg_date}
╚══════════════════════════════════════╝
"""
    await message.answer(text)

# ========== БАЛАНС (работает и по кнопке, и по тексту "баланс") ==========
@dp.message(lambda m: m.text and m.text.lower() in ["баланс", "💎 баланс", "мой баланс", "balance"])
async def balance(message: Message):
    user = await get_user(message.from_user.id)
    await message.answer(f"""
╔════════════════════════╗
║        💎 БАЛАНС        ║
╠════════════════════════╣
║ 💰 Наличные: {user['cash']:,} €
║ 🏦 В банке: {user['bank']:,} €
║ 💎 Итого: {user['cash'] + user['bank']:,} €
╚════════════════════════╝
""")

# ========== ЭНЕРГИЯ (работает и по кнопке, и по тексту "энергия") ==========
@dp.message(lambda m: m.text and m.text.lower() in ["энергия", "⚡ энергия", "моя энергия", "energy"])
async def energy(message: Message):
    user = await get_user(message.from_user.id)
    bars = "█" * (user['energy'] // 10) + "░" * (10 - user['energy'] // 10)
    await message.answer(f"""
╔════════════════════════╗
║        ⚡ ЭНЕРГИЯ       ║
╠════════════════════════╣
║ [{bars}]
║ 📊 {user['energy']}/100
║ 🔄 +5 каждые 30 минут
╚════════════════════════╝
""")

# ========== РАБОТА (работает и по кнопке, и по тексту "работа") ==========
@dp.message(lambda m: m.text and m.text.lower() in ["работа", "⚡ работа", "работать", "work"])
async def work(message: Message):
    user = await get_user(message.from_user.id)
    if user['energy'] < 10:
        await message.answer("❌ Недостаточно энергии! Нужно 10.")
        return
    reward = random.randint(25000, 60000) + user['level'] * 5000
    exp_gain = random.randint(40, 120)
    await update_cash(user['user_id'], reward)
    await update_energy(user['user_id'], -10)
    await update_exp(user['user_id'], exp_gain)
    await message.answer(f"""
╔════════════════════════════╗
║        ✅ РАБОТА           ║
╠════════════════════════════╣
║ 💰 Награда: +{reward:,} €
║ 🎖️ Опыт: +{exp_gain}
║ ⚡ Энергия: -10
╚════════════════════════════╝
""")

# ========== БАНК (команды: банк, положить, снять) ==========
@dp.message(lambda m: m.text and m.text.lower() in ["банк", "🏦 банк", "bank"])
async def bank_help(message: Message):
    await message.answer("""
╔════════════════════════════╗
║          🏦 БАНК           ║
╠════════════════════════════╣
║ 📝 Команды:
║   положить [сумма]
║   снять [сумма]
║
║ 📌 Пример:
║   положить 50000
║   снять 25000
╚════════════════════════════╝
""")

@dp.message(lambda m: m.text and m.text.lower().startswith("положить"))
async def bank_deposit(message: Message):
    try:
        amount = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        if user['cash'] >= amount:
            await update_cash(user['user_id'], -amount)
            await update_bank(user['user_id'], amount)
            await message.answer(f"✅ {amount:,} € положено в банк")
        else:
            await message.answer("❌ Недостаточно наличных")
    except:
        await message.answer("❌ Пример: положить 50000")

@dp.message(lambda m: m.text and m.text.lower().startswith("снять"))
async def bank_withdraw(message: Message):
    try:
        amount = int(message.text.split()[1])
        user = await get_user(message.from_user.id)
        if user['bank'] >= amount:
            await update_cash(user['user_id'], amount)
            await update_bank(user['user_id'], -amount)
            await message.answer(f"✅ {amount:,} € снято с банка")
        else:
            await message.answer("❌ Недостаточно в банке")
    except:
        await message.answer("❌ Пример: снять 50000")

# ========== ФЕРМА ==========
@dp.message(lambda m: m.text and m.text.lower() in ["ферма", "🪙 ферма", "криптоферма"])
async def farm_menu(message: Message):
    await message.answer("🪙 Криптоферма", reply_markup=farm_keyboard())

@dp.message(lambda m: m.text and m.text.lower() in ["ферма инфо", "ферма информация", "моя ферма"])
async def farm_info(message: Message):
    farm = await get_farm(message.from_user.id)
    if not farm:
        await create_farm(message.from_user.id)
        farm = await get_farm(message.from_user.id)
    await message.answer(f"""
╔════════════════════════════╗
║       🪙 КРИПТОФЕРМА       ║
╠════════════════════════════╣
║ 📛 Название: {farm['name']}
║ 💻 Видеокарт: {farm['cards']} шт.
║ 💰 Доход/час: {farm['cards']} BTC
║ 💳 На счету: {farm['balance']} BTC
╚════════════════════════════╝
""")

@dp.message(lambda m: m.text and m.text.lower().startswith("купить") and "ферма" not in m.text.lower())
async def farm_buy(message: Message):
    try:
        amount = int(message.text.split()[1])
        success, price = await buy_cards(message.from_user.id, amount)
        if success:
            await message.answer(f"✅ Куплено {amount} видеокарт за {price:,} €")
        else:
            await message.answer(f"❌ Не хватает {price:,} €")
    except:
        await message.answer("❌ Используй: купить 1")

@dp.message(lambda m: m.text and m.text.lower().startswith("продать"))
async def farm_sell(message: Message):
    try:
        amount = int(message.text.split()[1])
        success, price = await sell_cards(message.from_user.id, amount)
        if success:
            await message.answer(f"✅ Продано {amount} видеокарт за {price:,} €")
        else:
            await message.answer("❌ Недостаточно видеокарт")
    except:
        await message.answer("❌ Используй: продать 1")

@dp.message(lambda m: m.text and m.text.lower() in ["собрать", "ферма собрать", "собрать ферму"])
async def farm_collect(message: Message):
    profit = await collect_farm(message.from_user.id)
    await message.answer(f"💰 Собрано {profit} BTC с фермы")

@dp.message(lambda m: m.text and m.text.lower() in ["вывести", "ферма вывести", "вывести ферму"])
async def farm_withdraw(message: Message):
    cash = await withdraw_farm(message.from_user.id)
    if cash > 0:
        await message.answer(f"💳 Выведено {cash:,} € с фермы")
    else:
        await message.answer("❌ На счету фермы нет BTC")

# ========== БИЗНЕС ==========
@dp.message(lambda m: m.text and m.text.lower() in ["бизнес", "📦 бизнес", "мой бизнес"])
async def business_menu(message: Message):
    await message.answer("📦 Бизнес", reply_markup=business_keyboard())

@dp.message(lambda m: m.text and m.text.lower() in ["бизнес инфо", "бизнес информация"])
async def business_info(message: Message):
    biz = await get_business(message.from_user.id)
    businesses_data = {
        1: {"name": "Маленькая пекарня", "price": 100, "income": 50},
        2: {"name": "Ларьки по городу", "price": 2000000, "income": 50000},
        3: {"name": "Производство ракет", "price": 50000000, "income": 500000},
        4: {"name": "Корпорация Юма", "price": 75000000, "income": 750000},
        5: {"name": "Империя Юма", "price": 2500000000, "income": 25000000}
    }
    if not biz:
        text = "📋 Доступные бизнесы:\n\n"
        for i, b in businesses_data.items():
            text += f"{i}. {b['name']} — {b['price']:,} €\n"
        text += "\n📝 Купить бизнес [номер]\nПример: купить бизнес 1"
        await message.answer(text)
    else:
        biz_data = businesses_data[biz['biz_id']]
        await message.answer(f"""
╔════════════════════════════╗
║        📦 БИЗНЕС           ║
╠════════════════════════════╣
║ 📛 {biz['name']}
║ 📊 Уровень: {biz['level']}
║ 👥 Сотрудники: {biz['workers']}
║ 💰 Доход/час: {biz_data['income'] * (biz['workers'] + 1):,} €
║ 💳 На счету: {biz['balance']:,} €
╚════════════════════════════╝
""")

@dp.message(lambda m: m.text and m.text.lower().startswith("нанять"))
async def business_hire(message: Message):
    try:
        amount = int(message.text.split()[1])
        success, cost = await hire_workers(message.from_user.id, amount)
        if success:
            await message.answer(f"✅ Нанято {amount} сотрудников за {cost:,} €")
        else:
            await message.answer("❌ Недостаточно денег или нет бизнеса")
    except:
        await message.answer("❌ Используй: нанять 1")

@dp.message(lambda m: m.text and m.text.lower() in ["бизнес собрать", "собрать бизнес"])
async def business_collect(message: Message):
    profit = await collect_business(message.from_user.id)
    if profit > 0:
        await message.answer(f"💰 Собрано {profit:,} € с бизнеса")
    else:
        await message.answer("❌ У вас нет бизнеса")

@dp.message(lambda m: m.text and m.text.lower() in ["бизнес вывести", "вывести бизнес"])
async def business_withdraw(message: Message):
    cash = await withdraw_business(message.from_user.id)
    if cash > 0:
        await message.answer(f"💳 Выведено {cash:,} € с бизнеса")
    else:
        await message.answer("❌ На счету бизнеса нет денег")

@dp.message(lambda m: m.text and m.text.lower().startswith("купить бизнес"))
async def business_buy(message: Message):
    try:
        biz_id = int(message.text.split()[2])
        businesses_data = {
            1: {"name": "Маленькая пекарня", "price": 100},
            2: {"name": "Ларьки по городу", "price": 2000000},
            3: {"name": "Производство ракет", "price": 50000000},
            4: {"name": "Корпорация Юма", "price": 75000000},
            5: {"name": "Империя Юма", "price": 2500000000}
        }
        if biz_id in businesses_data:
            success = await buy_business(
                message.from_user.id, 
                biz_id, 
                businesses_data[biz_id]["name"], 
                businesses_data[biz_id]["price"]
            )
            if success:
                await message.answer(f"✅ Куплен бизнес «{businesses_data[biz_id]['name']}»")
            else:
                await message.answer("❌ Недостаточно денег")
        else:
            await message.answer("❌ Неверный номер бизнеса")
    except:
        await message.answer("❌ Пример: купить бизнес 1")

# ========== ТОП (работает и по кнопке, и по тексту "топ") ==========
@dp.message(lambda m: m.text and m.text.lower() in ["топ", "🏆 топ", "топ игроков", "топ игроки", "top"])
async def top(message: Message):
    top_users = await get_top_users()
    text = "🏆 ТОП-10 ИГРОКОВ 🏆\n\n"
    for i, user in enumerate(top_users, 1):
        medal = "🥇" if i == 1 else "🥈" if i == 2 else "🥉" if i == 3 else "📌"
        text += f"{medal} {i}. {user['name']} — {user['total']:,} €\n"
    await message.answer(text)

# ========== ПОМОЩЬ ==========
@dp.message(lambda m: m.text and m.text.lower() in ["помощь", "help", "команды", "❓ помощь"])
async def help_cmd(message: Message):
    await message.answer("""
╔══════════════════════════════════════╗
║           📚 КОМАНДЫ YUMABOT         ║
╠══════════════════════════════════════╣
║ 📝 Основные команды:                 ║
║   • профиль — твоя статистика        ║
║   • баланс — твои деньги             ║
║   • работа — заработать деньги       ║
║   • банк — информация о банке        ║
║   • положить [сумма] — в банк        ║
║   • снять [сумма] — из банка         ║
║   • энергия — запас сил              ║
║   • топ — лучшие игроки              ║
╠══════════════════════════════════════╣
║ 🪙 Ферма:                            ║
║   • ферма — главное меню             ║
║   • купить [кол-во] — видеокарты     ║
║   • продать [кол-во] — видеокарты    ║
║   • собрать — доход с фермы          ║
║   • вывести — вывести деньги         ║
╠══════════════════════════════════════╣
║ 📦 Бизнес:                           ║
║   • бизнес — главное меню            ║
║   • купить бизнес [номер]            ║
║   • нанять [кол-во] — сотрудников    ║
║   • собрать — доход с бизнеса        ║
║   • вывести — вывести деньги         ║
╚══════════════════════════════════════╝
""")

# ========== НАЗАД ==========
@dp.message(lambda m: m.text and m.text.lower() in ["назад", "🔙 назад", "back"])
async def back(message: Message):
    await message.answer("📋 Главное меню", reply_markup=main_keyboard())

# ========== ВОССТАНОВЛЕНИЕ ЭНЕРГИИ ==========
async def restore_energy():
    while True:
        await asyncio.sleep(1800)
        async with pool.acquire() as conn:
            await conn.execute("UPDATE users SET energy = LEAST(energy + 5, 100)")

# ========== ЗАПУСК ==========
async def main():
    await init_db()
    asyncio.create_task(restore_energy())
    print("🚀 YumaBot запущен!")
    print(f"👑 Админ: {ADMIN_ID}")
    await dp.start_polling(bot)

if __name__ == "__main__":
    asyncio.run(main())
