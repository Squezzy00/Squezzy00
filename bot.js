require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Low, JSONFile } = require('lowdb');
const fs = require('fs');
const _ = require('lodash');

// Инициализация БД
const adapter = new JSONFile('db.json');
const db = new Low(adapter);

// Инициализация структуры БД
async function initDB() {
  await db.read();
  db.data ||= { 
    users: {},
    stats: {
      totalTimers: 0,
      activeTimers: 0
    }
  };
  await db.write();
}

const bot = new Telegraf(process.env.BOT_TOKEN);
const OWNER_ID = parseInt(process.env.OWNER_ID);

// Функция для экранирования MarkdownV2
function escapeMarkdown(text) {
  if (!text) return '';
  return text.toString()
    .replace(/\_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\~/g, '\\~')
    .replace(/\`/g, '\\`')
    .replace(/\>/g, '\\>')
    .replace(/\#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/\-/g, '\\-')
    .replace(/\=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
}

// Функция для форматирования времени
function getTimeString(amount, unit) {
  const units = {
    'с': ['секунду', 'секунды', 'секунд'],
    'м': ['минуту', 'минуты', 'минут'],
    'ч': ['час', 'часа', 'часов'],
    'д': ['день', 'дня', 'дней']
  };

  let word;
  if (amount % 10 === 1 && amount % 100 !== 11) {
    word = units[unit][0];
  } else if ([2, 3, 4].includes(amount % 10) && ![12, 13, 14].includes(amount % 100)) {
    word = units[unit][1];
  } else {
    word = units[unit][2];
  }

  return `${amount} ${word}`;
}

// Обработчик команд напоминаний
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
  await initDB();
  
  const userId = ctx.message.from.id;
  const chatId = ctx.message.chat.id;
  const username = ctx.message.from.username ? `@${ctx.message.from.username}` : escapeMarkdown(ctx.message.from.first_name);
  const amount = parseInt(ctx.match[1]);
  const unit = ctx.match[2];
  const text = ctx.match[3];

  let milliseconds = 0;
  switch (unit) {
    case 'с': milliseconds = amount * 1000; break;
    case 'м': milliseconds = amount * 60 * 1000; break;
    case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
    case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
  }

  if (milliseconds > 0) {
    const timerId = _.get(db.data, `users.${userId}.lastTimerId`, 0) + 1;
    const timeString = getTimeString(amount, unit);
    const expiresAt = Date.now() + milliseconds;

    // Сохраняем таймер в БД
    _.set(db.data, `users.${userId}.timers.${timerId}`, {
      text,
      expiresAt,
      chatId,
      unit,
      amount
    });
    _.set(db.data, `users.${userId}.lastTimerId`, timerId);

    // Обновляем статистику
    db.data.stats.activeTimers++;
    db.data.stats.totalTimers++;
    await db.write();

    await ctx.replyWithMarkdownV2(
      `⏳ *${escapeMarkdown(username)}, Таймер №${timerId} установлен\\!*\n` +
      `🔹 *Текст:* ${escapeMarkdown(text)}\n` +
      `⏱️ *Сработает через:* ${escapeMarkdown(timeString)}\n` +
      `🆔 *ID таймера:* ${timerId}`
    );

    const timer = setTimeout(async () => {
      try {
        await ctx.telegram.sendMessage(
          chatId,
          `🔔 *${escapeMarkdown(username)}, Таймер №${timerId}\\!*\n` +
          `📌 *Напоминание:* ${escapeMarkdown(text)}\n` +
          `🎉 Время пришло\\!`,
          { parse_mode: 'MarkdownV2' }
        );

        _.unset(db.data, `users.${userId}.timers.${timerId}`);
        db.data.stats.activeTimers--;
        await db.write();
      } catch (error) {
        console.error('Ошибка при отправке напоминания:', error);
      }
    }, milliseconds);

    // Сохраняем timeout
    _.set(db.data, `users.${userId}.timers.${timerId}.timeout`, timer);
    await db.write();
  } else {
    await ctx.reply('❌ Неверный формат времени. Используйте /1с, /5м, /2ч или /3д');
  }
});

// Команда для просмотра активных таймеров
bot.command('таймеры', async (ctx) => {
  await initDB();
  
  const userId = ctx.message.from.id;
  const username = ctx.message.from.username ? `@${ctx.message.from.username}` : escapeMarkdown(ctx.message.from.first_name);
  const timers = _.get(db.data, `users.${userId}.timers`, {});

  if (Object.keys(timers).length === 0) {
    return ctx.replyWithMarkdownV2(
      `📭 *${escapeMarkdown(username)}, у вас нет активных таймеров\\!*`
    );
  }

  let message = `⏳ *${escapeMarkdown(username)}, ваши активные таймеры:*\n\n`;
  const now = Date.now();

  for (const [timerId, timer] of Object.entries(timers)) {
    if (timer.expiresAt && timer.expiresAt > now) {
      const timeLeft = timer.expiresAt - now;
      const timeString = getTimeString(timer.amount, timer.unit);
      message += `🔹 *Таймер №${timerId}*\n` +
                 `📝 *Текст:* ${escapeMarkdown(timer.text)}\n` +
                 `⏱️ *Осталось:* ${escapeMarkdown(timeString)}\n\n`;
    }
  }

  await ctx.replyWithMarkdownV2(message);
});

// Команда для удаления таймера
bot.command('clear', async (ctx) => {
  await initDB();
  
  const userId = ctx.message.from.id;
  const username = ctx.message.from.username ? `@${ctx.message.from.username}` : escapeMarkdown(ctx.message.from.first_name);
  const args = ctx.message.text.split(' ');
  
  if (args.length < 2) {
    return ctx.replyWithMarkdownV2(
      `❌ *${escapeMarkdown(username)}, укажите ID таймера для удаления\\!*\n` +
      `📌 *Пример:* \`/clear 1\``
    );
  }

  const timerId = parseInt(args[1]);
  const timer = _.get(db.data, `users.${userId}.timers.${timerId}`);

  if (!timer) {
    return ctx.replyWithMarkdownV2(
      `❌ *${escapeMarkdown(username)}, таймер №${timerId} не найден\\!*\n` +
      `📋 Используйте \`/таймеры\` д��я просмотра активных таймеров`
    );
  }

  // Отменяем таймаут
  if (timer.timeout) {
    clearTimeout(timer.timeout);
  }

  // Удаляем таймер из БД
  _.unset(db.data, `users.${userId}.timers.${timerId}`);
  db.data.stats.activeTimers--;
  await db.write();

  await ctx.replyWithMarkdownV2(
    `✅ *${escapeMarkdown(username)}, таймер №${timerId} успешно удалён\\!*\n` +
    `🗑️ *Текст напоминания:* ${escapeMarkdown(timer.text)}`
  );
});

// Команда статистики для владельца
bot.command('stats', async (ctx) => {
  await initDB();
  
  if (ctx.message.from.id !== OWNER_ID) {
    return ctx.reply('⛔ У вас нет прав для использования этой команды!');
  }

  await ctx.replyWithMarkdownV2(
    `📊 *Статистика бота:*\n\n` +
    `🔢 *Всего таймеров создано:* ${db.data.stats.totalTimers}\n` +
    `⏳ *Активных таймеров:* ${db.data.stats.activeTimers}\n` +
    `👥 *Пользователей с таймерами:* ${Object.keys(db.data.users).length}`
  );
});

// Восстановление таймеров при запуске
async function restoreTimers() {
  await initDB();
  
  const now = Date.now();
  for (const [userId, userData] of Object.entries(db.data.users)) {
    if (!userData.timers) continue;

    for (const [timerId, timer] of Object.entries(userData.timers)) {
      if (!timer.expiresAt) continue;
      
      const timeLeft = timer.expiresAt - now;
      if (timeLeft > 0) {
        const newTimeout = setTimeout(async () => {
          try {
            await bot.telegram.sendMessage(
              timer.chatId,
              `🔔 *Таймер №${escapeMarkdown(timerId)}\\!*\n` +
              `📌 *Напоминание:* ${escapeMarkdown(timer.text)}\n` +
              `🎉 Время пришло\\!`,
              { parse_mode: 'MarkdownV2' }
            );

            _.unset(db.data, `users.${userId}.timers.${timerId}`);
            db.data.stats.activeTimers--;
            await db.write();
          } catch (error) {
            console.error('Ошибка при восстановлении таймера:', error);
          }
        }, timeLeft);

        _.set(db.data, `users.${userId}.timers.${timerId}.timeout`, newTimeout);
      } else {
        _.unset(db.data, `users.${userId}.timers.${timerId}`);
        db.data.stats.activeTimers--;
      }
    }
  }
  await db.write();
}

// Стартовое сообщение
bot.start((ctx) => {
  const username = ctx.message.from.username ? `@${ctx.message.from.username}` : escapeMarkdown(ctx.message.from.first_name);
  ctx.replyWithMarkdownV2(
    `🕰️ *Привет, ${escapeMarkdown(username)}\\, Я бот\\-напоминалка\\!*\n\n` +
    `✨ *Как пользоваться:*\n` +
    "`/1с Напомни мне` \\- через 1 секунду\n" +
    "`/5м Позвонить другу` \\- через 5 минут\n" +
    "`/2ч Принять лекарство` \\- через 2 часа\n" +
    "`/3д Оплатить счёт` \\- через 3 дня\n\n" +
    "📋 *Другие команды:*\n" +
    "`/таймеры` \\- показать активные таймеры\n" +
    "`/clear 1` \\- удалить таймер №1\n\n" +
    "📝 *Пример:* `/10м Проверить почту`"
  );
});

// Обработка ошибок
bot.catch((err, ctx) => {
  console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Запуск бота
(async () => {
  await initDB();
  await restoreTimers();
  
  bot.launch()
    .then(() => console.log('Бот запущен'))
    .catch(err => console.error('Ошибка запуска бота:', err));

  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
})();
