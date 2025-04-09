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
        chat_id BIGINT NOT NULL,
        message_id BIGINT,
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

// Хранилище клавиатур
const activeKeyboards = new Map();

// Функция для создания клавиатуры
function createKeyboard(buttons) {
  const keyboard = [];
  const buttonsPerRow = buttons.length <= 3 ? buttons.length : 3;
  
  for (let i = 0; i < buttons.length; i += buttonsPerRow) {
    keyboard.push(buttons.slice(i, i + buttonsPerRow).map(text => Markup.button.text(text)));
  }

  return Markup.keyboard(keyboard)
    .resize()
    .persistent(); // Клавиатура не будет скрываться
}

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  const [, amount, unit, text] = ctx.match;
  
  // Маппинг единиц времени
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
      `INSERT INTO reminders (user_id, chat_id, message_id, text, end_time, unit) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, chatId, messageId, text, endTime, cleanUnit]
    );

    setTimeout(async () => {
      try {
        await ctx.telegram.sendMessage(
          chatId, 
          `🔔 @${ctx.from.username || ctx.from.first_name}, напоминание: ${text}`,
          { reply_to_message_id: messageId }
        );
        await pool.query(
          'DELETE FROM reminders WHERE user_id = $1 AND chat_id = $2 AND message_id = $3',
          [userId, chatId, messageId]
        );
      } catch (err) {
        console.error('Ошибка напоминания:', err);
      }
    }, ms);

    ctx.reply(`⏳ Напоминание установлено через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    console.error('Ошибка БД:', err);
    ctx.reply('Не удалось установить напоминание');
  }
});

// Обработчик команд клавиатуры
bot.command(['start', 'help', 'set', 'see', 'open', 'stop', 'del', 'timer', 'cfg'], async (ctx) => {
  const command = ctx.message.text.split(' ')[0].slice(1);
  
  try {
    switch(command) {
      case 'start':
        await ctx.replyWithHTML(`👋 <b>Привет, ${ctx.from.first_name}!</b>\n\nИспользуй /help для списка команд`);
        break;
        
      case 'help':
        await ctx.replyWithHTML(`
<b>📋 Команды:</b>
/set кнопка1,кнопка2 - установить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру
/5с текст - напомнить через 5 секунд
/timer - активные напоминания
        `);
        break;
        
      case 'set':
        const setButtons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
        if (setButtons.length === 0) throw new Error('Нет кнопок');
        
        await pool.query(
          `INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
          [ctx.from.id, setButtons]
        );
        await ctx.reply('✅ Клавиатура сохранена', createKeyboard(setButtons));
        break;
        
      case 'see':
        const seeButtons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
        if (seeButtons.length === 0) throw new Error('Нет кнопок');
        
        activeKeyboards.set(ctx.from.id, seeButtons);
        await ctx.reply('⌛ Временная клавиатура', createKeyboard(seeButtons));
        break;
        
      case 'open':
        if (activeKeyboards.has(ctx.from.id)) {
          return ctx.reply('Ваша клавиатура', createKeyboard(activeKeyboards.get(ctx.from.id)));
        }
        
        const res = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
        if (res.rows.length > 0) {
          return ctx.reply('Ваша клавиатура', createKeyboard(res.rows[0].buttons));
        }
        
        await ctx.reply('У вас нет сохранённой клавиатуры');
        break;
        
      case 'stop':
        activeKeyboards.delete(ctx.from.id);
        await ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
        break;
        
      case 'timer':
        const reminders = await pool.query(
          `SELECT text, unit, 
           (end_time - EXTRACT(EPOCH FROM NOW())*1000 AS ms_left
           FROM reminders 
           WHERE user_id = $1 AND end_time > EXTRACT(EPOCH FROM NOW())*1000`,
          [ctx.from.id]
        );
        
        if (reminders.rows.length === 0) {
          return ctx.reply('Нет активных напоминаний');
        }
        
        const list = reminders.rows.map(r => 
          `⏱ ${r.text} (осталось: ${Math.ceil(r.ms_left/1000)}${r.unit})`
        ).join('\n');
        
        await ctx.reply(`📋 Напоминания:\n${list}`);
        break;
        
      default:
        await ctx.reply('Неизвестная команда');
    }
  } catch (err) {
    console.error(`Ошибка команды /${command}:`, err);
    await ctx.reply(`Ошибка выполнения: ${err.message}`);
  }
});

// Обработчик нажатий кнопок
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  
  try {
    // Проверяем активную клавиатуру
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      if (buttons.includes(ctx.message.text)) {
        return ctx.reply(`Вы нажали: ${ctx.message.text}`, createKeyboard(buttons));
      }
    }
    
    // Проверяем сохранённую клавиатуру
    const res = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (res.rows.length > 0 && res.rows[0].buttons.includes(ctx.message.text)) {
      return ctx.reply(`Вы нажали: ${ctx.message.text}`, createKeyboard(res.rows[0].buttons));
    }
  } catch (err) {
    console.error('Ошибка обработки кнопки:', err);
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
