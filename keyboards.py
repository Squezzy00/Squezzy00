from aiogram.types import ReplyKeyboardMarkup, KeyboardButton, InlineKeyboardMarkup, InlineKeyboardButton

def main_keyboard():
    buttons = [
        [KeyboardButton(text="👤 Мой профиль"), KeyboardButton(text="💰 Мой баланс")],
        [KeyboardButton(text="💼 Работать"), KeyboardButton(text="🏦 Положить в банк"), KeyboardButton(text="🏦 Снять с банка")],
        [KeyboardButton(text="🎮 Игры"), KeyboardButton(text="⚡ Моя энергия")],
        [KeyboardButton(text="🏆 Топ игроков"), KeyboardButton(text="❓ Помощь")],
        [KeyboardButton(text="🌍 Состояние мира")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def games_keyboard():
    buttons = [
        [KeyboardButton(text="🎲 кости 5000"), KeyboardButton(text="🎰 слоты 5000"), KeyboardButton(text="🪙 монетка 5000")],
        [KeyboardButton(text="◀️ Назад")]
    ]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def back_keyboard():
    buttons = [[KeyboardButton(text="◀️ Назад")]]
    return ReplyKeyboardMarkup(keyboard=buttons, resize_keyboard=True)

def get_work_keyboard(round_num, action, button_text):
    buttons = [[InlineKeyboardButton(text=button_text, callback_data=f"work_{action}_{round_num}")]]
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_bank_keyboard():
    buttons = [
        [InlineKeyboardButton(text="➕ Положить", callback_data="bank_deposit")],
        [InlineKeyboardButton(text="➖ Снять", callback_data="bank_withdraw")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="bank_back")]
    ]
    return InlineKeyboardMarkup(inline_keyboard=buttons)
