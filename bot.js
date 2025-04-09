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
const disabledCommands = new Set();
const userStates = new Map();

// Подключение к PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Инициализация БД
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS disabled_commands (
        command TEXT PRIMARY KEY
      )
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS user_keyboards (
        user_id BIGINT PRIMARY KEY,
        buttons TEXT[] NOT NULL DEFAULT '{}',
        keyboard_hidden BOOLEAN DEFAULT FALSE
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
    
    // Загружаем отключенные команды
    const res = await pool.query('SELECT command FROM disabled_commands');
    res.rows.forEach(row => disabledCommands.add(row.command));
    console.log('✅ БД готова');
  } catch (err) {
    console.error('❌ Ошибка БД:', err);
  }
})();

// ==================== ОСНОВНЫЕ ФУНКЦИИ ====================

// Проверка админа
function isAdmin(ctx) {
  return ADMINS.includes(ctx.from.id);
}

// Управление командами
async function disableCommand(command) {
  disabledCommands.add(command);
  await pool.query(
    'INSERT INTO disabled_commands (command) VALUES ($1) ON CONFLICT (command) DO NOTHING',
    [command]
  );
}

async function enableCommand(command) {
  disabledCommands.delete(command);
  await pool.query('DELETE FROM disabled_commands WHERE command = $1', [command]);
}

// Состояние клавиатуры
async function getKeyboardState(userId) {
  const res = await pool.query(
    'SELECT buttons, keyboard_hidden FROM user_keyboards WHERE user_id = $1', 
    [userId]
  );
  return res.rows[0] || { buttons: [], keyboard_hidden: false };
}

async function updateKeyboardState(userId, hidden) {
  await pool.query(
    'UPDATE user_keyboards SET keyboard_hidden = $1 WHERE user_id = $2',
    [hidden, userId]
  );
}

function createKeyboard(buttons, isHidden) {
  if (isHidden) {
    return Markup.keyboard([
      [Markup.button.text('📋 Показать клавиатуру')]
    ]).resize();
  }

  const keyboard = [];
  const rowSize = Math.min(4, buttons.length);
  
  for (let i = 0; i < buttons.length; i += rowSize) {
    keyboard.push(buttons.slice(i, i + rowSize));
  }
  keyboard.push(['📋 Скрыть клавиатуру']);
  
  return Markup.keyboard(keyboard).resize();
}

// ==================== КОМАНДЫ ====================

// Обработчик для всех команд
function commandHandler(command, handler) {
  bot.command(command, async (ctx) => {
    if (disabledCommands.has(command) && !isAdmin(ctx)) {
      return ctx.reply(`❌ Команда /${command} отключена`);
    }
    return handler(ctx);
  });
}

// Управление командами (только для админа)
commandHandler('cmd', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  if (args.length < 2) {
    return ctx.reply('Использование: /cmd [enable|disable] [команда]\nПример: /cmd disable timer');
  }

  const [action, cmd] = args;
  const command = cmd.replace(/^\//, '').toLowerCase();

  if (action === 'disable') {
    await disableCommand(command);
    ctx.reply(`✅ /${command} отключена`);
  } else if (action === 'enable') {
    await enableCommand(command);
    ctx.reply(`✅ /${command} включена`);
  } else {
    ctx.reply('❌ Используйте enable или disable');
  }
});

// Основные команды
commandHandler('start', (ctx) => {
  ctx.replyWithHTML(`👋 <b>Привет, ${ctx.from.first_name}!</b>\nИспользуй /help для списка команд`);
});

commandHandler('help', (ctx) => {
  ctx.replyWithHTML(`
<b>📋 Команды:</b>
/set кнопка1,кнопка2 - установить клавиатуру
/see кнопка1,кнопка2 - временная клавиатура
/open - показать клавиатуру
/stop - убрать клавиатуру
/5с текст - напомнить через 5 секунд
/timer - активные напоминания
${isAdmin(ctx) ? '\n<b>👑 Админ-команды:</b>\n/cmd [enable|disable] [команда]' : ''}
  `);
});

commandHandler('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (buttons.length === 0) return ctx.reply('Укажите кнопки через запятую');

  try {
    await pool.query(
      `INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    await updateKeyboardState(ctx.from.id, false);
    ctx.reply('✅ Клавиатура сохранена', createKeyboard(buttons, false));
  } catch (err) {
    ctx.reply('❌ Ошибка сохранения');
  }
});

commandHandler('see', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  if (buttons.length === 0) return ctx.reply('Укажите кнопки через запятую');

  userStates.set(ctx.from.id, { buttons, keyboardHidden: false });
  ctx.reply('⌛ Временная клавиатура', createKeyboard(buttons, false));
});

commandHandler('open', async (ctx) => {
  const { buttons, keyboard_hidden } = await getKeyboardState(ctx.from.id);
  if (buttons.length === 0) return ctx.reply('❌ Нет сохранённой клавиатуры');
  ctx.reply('Ваша клавиатура', createKeyboard(buttons, keyboard_hidden));
});

commandHandler('stop', (ctx) => {
  ctx.reply('🗑 Клавиатура удалена', Markup.removeKeyboard());
});

commandHandler('timer', async (ctx) => {
  try {
    const res = await pool.query(
      `SELECT text, unit, (end_time - $1) / 1000 AS seconds_left
       FROM reminders WHERE user_id = $2 AND end_time > $1`,
      [Date.now(), ctx.from.id]
    );
    
    if (res.rows.length === 0) return ctx.reply('⏳ Нет активных напоминаний');
    
    const list = res.rows.map(r => 
      `⏱ ${r.text} (осталось: ${Math.ceil(r.seconds_left)}${r.unit})`
    ).join('\n');
    ctx.reply(`📋 Ваши напоминания:\n${list}`);
  } catch (err) {
    ctx.reply('❌ Ошибка загрузки');
  }
});

// Обработчик таймеров (/5с, /10м и т.д.)
bot.hears(/^\/(\d+)([сcмmчhдd])\s(.+)$/i, async (ctx) => {
  if (disabledCommands.has('reminder') && !isAdmin(ctx)) {
    return ctx.reply('❌ Напоминания отключены');
  }

  const [, amount, unit, text] = ctx.match;
  const unitMap = { 'с':'с', 'c':'с', 'м':'м', 'm':'м', 'ч':'ч', 'h':'ч', 'д':'д', 'd':'д' };
  const cleanUnit = unitMap[unit.toLowerCase()] || 'с';

  const ms = {
    'с': amount * 1000,
    'м': amount * 60 * 1000,
    'ч': amount * 60 * 60 * 1000,
    'д': amount * 24 * 60 * 60 * 1000
  }[cleanUnit];

  try {
    await pool.query(
      `INSERT INTO reminders (user_id, chat_id, message_id, text, end_time, unit)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [ctx.from.id, ctx.chat.id, ctx.message.message_id, text, Date.now() + ms, cleanUnit]
    );

    setTimeout(async () => {
      await ctx.reply(`🔔 Напоминание: ${text}`);
      await pool.query(
        'DELETE FROM reminders WHERE message_id = $1',
        [ctx.message.message_id]
      );
    }, ms);

    ctx.reply(`⏳ Напоминание через ${amount}${cleanUnit}: "${text}"`);
  } catch (err) {
    ctx.reply('❌ Ошибка создания напоминания');
  }
});

// Управление клавиатурой
bot.hears(['📋 Скрыть клавиатуру', '📋 Показать клавиатуру'], async (ctx) => {
  const userId = ctx.from.id;
  let buttons = [];
  
  const kbState = await getKeyboardState(userId);
  const newState = !kbState.keyboard_hidden;
  
  if (userStates.has(userId)) {
    buttons = userStates.get(userId).buttons;
  } else if (kbState.buttons) {
    buttons = kbState.buttons;
  }

  await updateKeyboardState(userId, newState);
  ctx.reply(
    newState ? 'Клавиатура скрыта' : 'Клавиатура активна',
    createKeyboard(buttons, newState)
  );
});

// ==================== ЗАПУСК ====================
app.use(express.json());
app.post(WEBHOOK_PATH, (req, res) => {
  bot.handleUpdate(req.body, res);
});

app.listen(PORT, async () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  await bot.telegram.deleteWebhook();
  await bot.telegram.setWebhook(WEBHOOK_URL);
  console.log(`✅ Вебхук: ${WEBHOOK_URL}`);
});
