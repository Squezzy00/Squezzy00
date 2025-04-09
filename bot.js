const { Telegraf } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблицы при запуске
(async () => {
  try {
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
    console.log('✅ Таблица reminders готова');
  } catch (err) {
    console.error('❌ Ошибка создания таблицы:', err);
  }
})();

// Команда /start
bot.command('start', (ctx) => {
  ctx.reply(`
⏰ <b>Доступные команды:</b>
/5с Текст - напомнить через 5 секунд
/10м Текст - через 10 минут
/1ч Текст - через 1 час
/2д Текст - через 2 дня
/таймеры - показать активные напоминания
  `, { parse_mode: 'HTML' });
});

// Команда /таймеры (ИСПРАВЛЕННАЯ)
bot.command('таймеры', async (ctx) => {
  const userId = ctx.from.id;
  
  try {
    const res = await pool.query(
      `SELECT text, unit, 
       (end_time - EXTRACT(EPOCH FROM NOW())*1000) AS ms_left
       FROM reminders 
       WHERE user_id = $1 AND end_time > EXTRACT(EPOCH FROM NOW())*1000`,
      [userId]
    );

    if (res.rows.length === 0) {
      return ctx.reply('У вас нет активных напоминаний ⏳');
    }

    const timerList = res.rows.map(row => {
      const timeLeft = Math.ceil(row.ms_left / 1000);
      const units = { 'с': 'сек', 'м': 'мин', 'ч': 'час', 'д': 'дн' };
      return `⏱ ${row.text} (осталось: ${timeLeft}${units[row.unit] || '?'})`;
    }).join('\n');

    ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Произошла ошибка при загрузке напоминаний 😢');
  }
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const username = ctx.from.username || 'пользователь';
  const [, amount, unit, text] = ctx.match;
  
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()];

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
      await ctx.reply(`@${username}, напоминание: ${text}`);
      await pool.query('DELETE FROM reminders WHERE user_id = $1 AND text = $2', [userId, text]);
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Не удалось установить напоминание');
  }
});

// Вебхук
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body)
    .then(() => res.status(200).end())
    .catch(err => {
      console.error('Ошибка обработки:', err);
      res.status(200).end();
    });
});

const PORT = 10000;
app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
