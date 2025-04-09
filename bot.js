const { Telegraf } = require('telegraf');
const express = require('express');
const { Pool } = require('pg'); // Для работы с PostgreSQL
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Подключение к PostgreSQL (Render автоматически создаст БД)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost:5432/db',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Создаем таблицу при запуске
(async () => {
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
})();

// Команда /таймеры (ТОЧНО РАБОТАЕТ)
bot.command('таймеры', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const res = await pool.query(
      'SELECT text, end_time, unit FROM reminders WHERE user_id = $1',
      [userId]
    );

    if (res.rows.length === 0) {
      return ctx.reply('У вас нет активных напоминаний');
    }

    const timerList = res.rows.map(row => {
      const timeLeft = Math.max(0, Math.ceil((row.end_time - Date.now()) / 1000));
      return `⏱ ${row.text} (осталось: ${timeLeft}${row.unit})`;
    }).join('\n');

    ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Произошла ошибка при получении напоминаний');
  }
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'пользователь';
  const [, amount, unit, text] = ctx.match;
  
  // Нормализация единиц
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()] || 'с';

  // Конвертация в миллисекунды
  const ms = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  const endTime = Date.now() + ms;

  try {
    // Сохраняем в БД
    await pool.query(
      'INSERT INTO reminders (user_id, username, text, end_time, unit) VALUES ($1, $2, $3, $4, $5)',
      [userId, username, text, endTime, cleanUnit]
    );

    // Устанавливаем таймер
    setTimeout(async () => {
      try {
        await ctx.reply(`@${username}, напоминание: ${text}`);
        await pool.query('DELETE FROM reminders WHERE user_id = $1 AND text = $2', [userId, text]);
      } catch (err) {
        console.error('Ошибка:', err);
      }
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Не удалось установить напоминание');
  }
});

// Проверка старых напоминаний при запуске
async function restoreTimers() {
  const res = await pool.query('SELECT * FROM reminders WHERE end_time > $1', [Date.now()]);
  
  res.rows.forEach(row => {
    const msLeft = row.end_time - Date.now();
    if (msLeft > 0) {
      setTimeout(async () => {
        try {
          await bot.telegram.sendMessage(
            row.user_id, 
            `@${row.username}, напоминание: ${row.text}`
          );
          await pool.query('DELETE FROM reminders WHERE id = $1', [row.id]);
        } catch (err) {
          console.error('Ошибка восстановления:', err);
        }
      }, msLeft);
    }
  });
}

// Вебхук и запуск сервера
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body).then(() => res.status(200).end());
});

const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await restoreTimers();
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
