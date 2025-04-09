const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN;
const PORT = process.env.PORT || 3000;
const WEBHOOK_URL = `https://${DOMAIN.replace(/^https?:\/\//, '')}${WEBHOOK_PATH}`;

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Создание таблиц
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS reminders (
        id SERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        chat_id BIGINT NOT NULL,
        message_id BIGINT,
        text TEXT NOT NULL,
        end_time BIGINT NOT NULL,
        unit TEXT NOT NULL
      )
    `);
    console.log('✅ Таблица напоминаний готова');
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err);
  }
})();

// Обработчик таймеров (полностью переработанный)
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  const [, amount, unit, text] = ctx.match;
  
  // Маппинг единиц времени
  const unitMap = {
    'с': 'с', 'c': 'с',
    'м': 'м', 'm': 'м',
    'ч': 'ч', 'h': 'ч',
    'д': 'д', 'd': 'д'
  };
  
  const cleanUnit = unitMap[unit.toLowerCase()];
  if (!cleanUnit) {
    return ctx.reply('Используйте: /5с, /10м, /1ч, /2д');
  }

  // Проверка допустимости значения
  const numAmount = parseInt(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return ctx.reply('Укажите положительное число (например /5с)');
  }

  // Расчет времени в миллисекундах
  let ms;
  switch(cleanUnit) {
    case 'с': ms = numAmount * 1000; break;
    case 'м': ms = numAmount * 60 * 1000; break;
    case 'ч': ms = numAmount * 60 * 60 * 1000; break;
    case 'д': ms = numAmount * 24 * 60 * 60 * 1000; break;
    default: return ctx.reply('Неизвестная единица времени');
  }

  const endTime = Date.now() + ms;

  try {
    // Сохраняем напоминание в БД
    await pool.query(
      `INSERT INTO reminders 
       (user_id, chat_id, message_id, text, end_time, unit) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, chatId, messageId, text, endTime, cleanUnit]
    );

    // Устанавливаем таймер
    setTimeout(async () => {
      try {
        const userTag = ctx.from.username 
          ? `@${ctx.from.username}` 
          : `${ctx.from.first_name}`;
        
        await ctx.telegram.sendMessage(
          chatId, 
          `🔔 ${userTag}, напоминание: ${text}`,
          { reply_to_message_id: messageId }
        );
        
        // Удаляем выполненное напоминание
        await pool.query(
          'DELETE FROM reminders WHERE user_id = $1 AND chat_id = $2 AND message_id = $3',
          [userId, chatId, messageId]
        );
      } catch (err) {
        console.error('Ошибка при отправке напоминания:', err);
      }
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка установки напоминания:', err);
    ctx.reply('Не удалось установить напоминание. Попробуйте снова.');
  }
});

// Команда /timer (исправленная)
bot.command('timer', async (ctx) => {
  try {
    const res = await pool.query(
      `SELECT text, unit, 
       (end_time - $1) / 1000 AS seconds_left
       FROM reminders 
       WHERE user_id = $2 AND end_time > $1`,
      [Date.now(), ctx.from.id]
    );
    
    if (res.rows.length === 0) {
      return ctx.reply('Нет активных напоминаний ⏳');
    }
    
    const timerList = res.rows.map(row => {
      const timeLeft = Math.ceil(row.seconds_left);
      const units = { 'с': 'сек', 'м': 'мин', 'ч': 'час', 'д': 'дн' };
      return `⏱ ${row.text} (осталось: ${timeLeft}${units[row.unit] || '?'})`;
    }).join('\n');
    
    ctx.reply(`📋 Ваши напоминания:\n${timerList}`);
  } catch (err) {
    console.error('Ошибка /timer:', err);
    ctx.reply('Произошла ошибка при загрузке напоминаний');
  }
});

// Настройка вебхука
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.get('/', (req, res) => {
  res.send('Бот работает!');
});

// Запуск сервера
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
