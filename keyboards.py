from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def main_keyboard():
    buttons = [
        [KeyboardButton(text="🎮 Профиль"), KeyboardButton(text="💎 Баланс")],
        [KeyboardButton(text="⚡ Работа"), KeyboardButton(text="🏦 Банк")],
        [KeyboardButton(text="🪙 Ферма"), KeyboardButton(text="📦 Бизнес")],
        [KeyboardButton(text="🔋 Энергия"), KeyboardButton(text="🏆 Топ игроков")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def farm_keyboard():
    buttons = [
        [KeyboardButton(text="🪙 Ферма инфо"), KeyboardButton(text="🪙 Купить 1")],
        [KeyboardButton(text="🪙 Продать 1"), KeyboardButton(text="🪙 Собрать")],
        [KeyboardButton(text="🪙 Вывести"), KeyboardButton(text="🔙 Назад")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def business_keyboard():
    buttons = [
        [KeyboardButton(text="📦 Бизнес инфо"), KeyboardButton(text="📦 Нанять 1")],
        [KeyboardButton(text="📦 Собрать"), KeyboardButton(text="📦 Вывести")],
        [KeyboardButton(text="🔙 Назад")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)
