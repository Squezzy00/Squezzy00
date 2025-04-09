const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация
const WEBHOOK_PATH = '/tg-webhook';
const DOMAIN = process.env.RENDER_EXTERNAL_URL || process.env.DOMAIN;
const PORT = process.env.PORT || 10000;
const WEBHOOK_URL = `https://${DOMAIN.replace(/^https?:\/\//, '')}${WEBHOOK_PATH}`;

// Настройки админа
const ADMINS = [5005387093]; // Ваш user_id
const disabledCommands = new Set(); // Хранилище отключенных команд

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
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_keyboards (
        user_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}'
      )
    `);
    console.log('✅ Таблицы БД готовы');
  } catch (err) {
    console.error('❌ Ошибка создания таблиц:', err);
  }
})();

// Хранилище клавиатур
const activeKeyboards = new Map();

// Функция для создания клавиатуры (4 кнопки в ряду)
function createKeyboard(buttons) {
  const keyboard = [];
  const buttonsPerRow = Math.min(4, buttons.length);
  
  for (let i = 0; i < buttons.length; i += buttonsPerRow) {
    keyboard.push(buttons.slice(i, i + buttonsPerRow).map(text => Markup.button.text(text)));
  }

  return Markup.keyboard(keyboard)
    .resize()
    .persistent();
}

// Проверка прав администратора по user_id
function isAdmin(ctx) {
  return ADMINS.includes(ctx.from.id);
}

// Команда управления командами (только для админа)
bot.command('cmd', async (ctx) => {
  if (!isAdmin(ctx)) {
    return ctx.reply('❌ Только админы могут использовать эту команду');
  }

  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('Использование: /cmd [enable|disable] [команда]\nПример: /cmd disable timer');
  }

  const [action, command] = args;
  const cleanCommand = command.replace(/^\//, '').toLowerCase();

  if (action === 'disable') {
    disabledCommands.add(cleanCommand);
    ctx.reply(`✅ Команда /${cleanCommand} отключена`);
  } else if (action === 'enable') {
    disabledCommands.delete(cleanCommand);
    ctx.reply(`✅ Команда /${cleanCommand} включена`);
  } else {
    ctx.reply('❌ Неверное действие. Используйте enable или disable');
  }
});

// Обработчик всех команд (проверка отключенных команд)
bot.use(async (ctx, next) => {
  if (ctx.message && ctx.message.text && ctx.message.text.startsWith('/')) {
    const command = ctx.message.text.split(' ')[0].slice(1).toLowerCase();
    
    if (disabledCommands.has(command) && !isAdmin(ctx)) {
      return ctx.reply(`❌ Команда /${command} временно отключена`);
    }
  }
  return next();
});

// Команда /start
bot.command('start', (ctx) => {
  ctx.replyWithHTML(`👋 <b>Привет, ${ctx.from.first_name}!</b>\n\nИспользуй /help для списка команд`);
});

// Команда /help
bot.command('help', (ctx) => {
  const helpText = `
<b>📋 Команды:</b>
/set кнопка1,кнопка2 - установить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру
/5с текст - напомнить через 5 секунд
/timer - активные напоминания
${isAdmin(ctx) ? '\n<b>👑 Админ-команды:</b>\n/cmd [enable|disable] [команда] - управление командами' : ''}
  `;
  ctx.replyWithHTML(helpText);
});

// Обработчик таймеров
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  const userId = ctx.from.id;
  const chatId = ctx.chat.id;
  const messageId = ctx.message.message_id;
  const [, amount, unit, text] = ctx.match;
  
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()];

  if (!cleanUnit) {
    return ctx.reply('Используйте: /5с, /10м, /1ч, /2д');
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
      `INSERT INTO reminders (user_id, chat_id, message_id, text, end_time, unit) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, chatId, messageId, text, endTime, cleanUnit]
    );

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

// Команда /timer
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

// Команда /set
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0) {
    return ctx.reply('Используйте: /set Кнопка1,Кнопка2');
  }

  try {
    await pool.query(
      `INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    ctx.reply('✅ Клавиатура сохранена', createKeyboard(buttons));
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения');
  }
});

// Команда /see
bot.command('see', (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0) {
    return ctx.reply('Используйте: /see Кнопка1,Кнопка2');
  }

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.reply('⌛ Временная клавиатура', createKeyboard(buttons));
});

// Команда /open
bot.command('open', async (ctx) => {
  try {
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      return ctx.reply('Ваша клавиатура', createKeyboard(buttons));
    }

    const res = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (res.rows.length > 0) {
      return ctx.reply('Ваша клавиатура', createKeyboard(res.rows[0].buttons));
    }

    ctx.reply('У вас нет сохранённой клавиатуры');
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Команда /stop
bot.command('stop', (ctx) => {
  activeKeyboards.delete(ctx.from.id);
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

// Обработчик нажатий кнопок (без сообщений)
bot.on('text', async (ctx) => {
  if (ctx.message.text.startsWith('/')) return;
  
  try {
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      if (buttons.includes(ctx.message.text)) {
        return;
      }
    }
    
    const res = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (res.rows.length > 0 && res.rows[0].buttons.includes(ctx.message.text)) {
      return;
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
