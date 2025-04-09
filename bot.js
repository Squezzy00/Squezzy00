const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Конфигурация вебхука и БД остается без изменений...

// Функция для создания клавиатуры с оптимальным расположением кнопок
function createSmartKeyboard(buttons) {
  // Определяем оптимальное количество кнопок в ряду (2-5)
  const buttonsPerRow = Math.min(
    Math.max(
      Math.floor(Math.sqrt(buttons.length)), 
      2
    ), 
    5
  );

  // Разбиваем кнопки на ряды
  const keyboard = [];
  for (let i = 0; i < buttons.length; i += buttonsPerRow) {
    const row = buttons.slice(i, i + buttonsPerRow);
    keyboard.push(row.map(text => Markup.button.text(text)));
  }

  return Markup.keyboard(keyboard).resize().oneTime();
}

// Измененные команды для работы с клавиатурой:

// Команда /set
bot.command('set', async (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /set Кнопка1, Кнопка2', { reply_markup: { remove_keyboard: true } });
  }

  try {
    await pool.query(
      `INSERT INTO user_keyboards (user_id, buttons) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET buttons = $2`,
      [ctx.from.id, buttons]
    );
    ctx.replyWithMarkdown(
      `✅ *Постоянная клавиатура сохранена!*\nИспользуйте /open\n\n` +
      `Разработчик: @squezzy00`,
      createSmartKeyboard(buttons)
    );
  } catch (err) {
    console.error('Ошибка /set:', err);
    ctx.reply('❌ Ошибка сохранения', { reply_markup: { remove_keyboard: true } });
  }
});

// Команда /see
bot.command('see', (ctx) => {
  const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
  
  if (buttons.length === 0 || buttons[0] === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2', { reply_markup: { remove_keyboard: true } });
  }

  activeKeyboards.set(ctx.from.id, buttons);
  ctx.replyWithMarkdown(
    `⌛ *Временная клавиатура активирована*\nИспользуйте /stop\n\n` +
    `Разработчик: @squezzy00`,
    createSmartKeyboard(buttons)
  );
});

// Команда /open
bot.command('open', async (ctx) => {
  try {
    // 1. Проверка временной клавиатуры
    if (activeKeyboards.has(ctx.from.id)) {
      const buttons = activeKeyboards.get(ctx.from.id);
      return ctx.replyWithMarkdown(
        `⌛ *Временная клавиатура*\n\nРазработчик: @squezzy00`,
        createSmartKeyboard(buttons)
      );
    }

    // 2. Проверка личной клавиатуры
    const userKb = await pool.query('SELECT buttons FROM user_keyboards WHERE user_id = $1', [ctx.from.id]);
    if (userKb.rows.length > 0) {
      return ctx.replyWithMarkdown(
        `✅ *Ваша клавиатура*\n\nРазработчик: @squezzy00`,
        createSmartKeyboard(userKb.rows[0].buttons)
      );
    }

    // 3. Проверка клавиатуры чата
    if (ctx.chat.type !== 'private') {
      const chatKb = await pool.query('SELECT buttons FROM chat_keyboards WHERE chat_id = $1', [ctx.chat.id]);
      if (chatKb.rows.length > 0) {
        return ctx.replyWithMarkdown(
          `👥 *Клавиатура чата*\n\nРазработчик: @squezzy00`,
          createSmartKeyboard(chatKb.rows[0].buttons)
        );
      }
    }

    ctx.reply('ℹ️ Нет сохраненных клавиатур', { reply_markup: { remove_keyboard: true } });
  } catch (err) {
    console.error('Ошибка /open:', err);
    ctx.reply('❌ Ошибка загрузки', { reply_markup: { remove_keyboard: true } });
  }
});

// Команда /cfg
bot.command('cfg', async (ctx) => {
  if (ctx.chat.type === 'private') {
    return ctx.reply('Только для чатов!', { reply_markup: { remove_keyboard: true } });
  }
  
  try {
    const admins = await ctx.getChatAdministrators();
    const isAdmin = admins.some(a => a.user.id === ctx.from.id);
    if (!isAdmin) return ctx.reply('❌ Только для админов!', { reply_markup: { remove_keyboard: true } });

    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',').map(b => b.trim());
    if (buttons.length === 0) {
      return ctx.reply('Используйте: /cfg Кнопка1, Кнопка2', { reply_markup: { remove_keyboard: true } });
    }

    await pool.query(
      `INSERT INTO chat_keyboards (chat_id, buttons) VALUES ($1, $2)
       ON CONFLICT (chat_id) DO UPDATE SET buttons = $2`,
      [ctx.chat.id, buttons]
    );
    ctx.reply('✅ Клавиатура чата сохранена!', { reply_markup: { remove_keyboard: true } });
  } catch (err) {
    console.error('Ошибка /cfg:', err);
    ctx.reply('❌ Ошибка сохранения', { reply_markup: { remove_keyboard: true } });
  }
});

// Остальной код остается без изменений...
