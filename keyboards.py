from aiogram.types import ReplyKeyboardMarkup, KeyboardButton

def main_keyboard():
    buttons = [
        [KeyboardButton(text="👤 Мой профиль"), KeyboardButton(text="💰 Мой баланс")],
        [KeyboardButton(text="💼 Работать"), KeyboardButton(text="🏦 Положить в банк"), KeyboardButton(text="🏦 Снять с банка")],
        [KeyboardButton(text="🎮 Игры"), KeyboardButton(text="⚡ Моя энергия")],
        [KeyboardButton(text="🏆 Топ игроков"), KeyboardButton(text="❓ Помощь")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def games_keyboard():
    buttons = [
        [KeyboardButton(text="кости 5000"), KeyboardButton(text="слоты 5000"), KeyboardButton(text="монетка 5000")],
        [KeyboardButton(text="◀️ Назад")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def back_keyboard():
    buttons = [[KeyboardButton(text="◀️ Назад")]]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)