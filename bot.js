const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация вебхука
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN || 'your-domain.onrender.com';
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `https://${DOMAIN.replace(/^https?:\/\//, '')}${WEBHOOK_PATH}`;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  }
});

// Создание таблиц
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_keyboards (
        user_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS chat_keyboards (
        chat_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        username TEXT,
        text TEXT NOT NULL,
        end_time BIGINT NOT NULL,
        unit TEXT NOT NULL
      )
    `);
    console.log('✅ Таблицы БД готовы');
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err);
  }
})();

// Хранилище временных клавиатур
const activeKeyboards = new Map();

// Функция для создания клавиатуры
function createSmartKeyboard(buttons) {
  const MAX_BUTTONS_PER_ROW = 3;
  const keyboard = [];
  
  for (let i = 0; i < buttons.length; i += MAX_BUTTONS_PER_ROW) {
    const row = buttons.slice(i, i + MAX_BUTTONS_PER_ROW);
    keyboard.push(row.map(text => Markup.button.text(text)));
  }

  return Markup.keyboard(keyboard)
    .resize()
    .persistent(); // Клавиатура не будет скрываться после нажатия
}

// Команда /start и /help остаются без изменений...

// Обработчик таймеров с русскими буквами
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || ctx.from.first_name;
  const [, amount, unit, text] = ctx.match;
  
  // Маппинг русских и английских букв
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()];

  if (!cleanUnit) {
    return ctx.reply('Неправильный формат времени. Используйте: /5с, /10м, /1ч, /2д');
  }

  const ms = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  const endTime = Date.now() + ms;

  try {
    await pool.query(
      'INSERT INTO reminders (user_id, username, text, end_time, unit) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, text, endTime, cleanUnit]
    );

    setTimeout(async () => {
      try {
        await ctx.reply(`🔔 Напоминание: ${text}`);
        await pool.query('DELETE FROM reminders WHERE user_id = $1 AND text = $2 AND end_time = $3', 
          [userId, text, endTime]);
      } catch (err) {
        console.error('Ошибка при отправке напоминания:', err);
      }
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Не удалось установить напоминание');
  }
});

// Обработчик нажатий на кнопки
bot.on('text', async (ctx) => {
  // Если это команда - пропускаем
  if (ctx.message.text.startsWith('/')) return;
  
  // Проверяем, есть ли активная клавиатура у пользователя
  if (activeKeyboards.has(ctx.from.id)) {
    const buttons = activeKeyboards.get(ctx.from.id);
    if (buttons.includes(ctx.message.text)) {
      // Кнопка нажата - клавиатура остается
      return ctx.reply(`Вы нажали: ${ctx.message.text}`, {
        reply_markup: createSmartKeyboard(buttons).reply_markup
      });
    }
  }
  
  // Проверяем персональную клавиатуру
  try {
    const res = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (res.rows.length > 0 && res.rows[0].buttons.includes(ctx.message.text)) {
      return ctx.reply(`Вы нажали: ${ctx.message.text}`, {
        reply_markup: createSmartKeyboard(res.rows[0].buttons).reply_markup
      });
    }
  } catch (err) {
    console.error('Ошибка БД:', err);
  }
});

// Все остальные команды (/set, /see, /open, /stop, /del, /timer, /cfg) остаются без изменений,
// но везде где создается клавиатура используем createSmartKeyboard()

// Настройка вебхука и запуск сервера
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res).catch(err => {
    console.error('Webhook error:', err);
    res.status(200).end();
  });
});

app.get('/', (req, res) => {
  res.send('Бот работает!');
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  try {
    await bot.telegram.deleteWebhook();
    await bot.telegram.setWebhook(WEBHOOK_URL);
    console.log(`✅ Вебхук установлен: ${WEBHOOK_URL}`);
  } catch (err) {
    console.error('❌ Ошибка вебхука:', err);
  }
});
