const { Telegraf, Markup } = require('telegraf');
require('dotenv').config();

// Хранилище клавиатур для пользователей (в памяти)
const userKeyboards = new Map();

const bot = new Telegraf(process.env.BOT_TOKEN);

// Команда /test
bot.command('test', (ctx) => {
  ctx.reply('Тестовая команда работает! ✅');
});

// Команда /see - создает клавиатуру
bot.command('see', (ctx) => {
  const buttonsText = ctx.message.text.split(' ').slice(1).join(' ').split(', ');
  
  if (buttonsText.length === 0 || buttonsText[0] === '') {
    return ctx.reply('Используйте: /see Кнопка1, Кнопка2, Кнопка3');
  }

  // Сохраняем клавиатуру для пользователя
  userKeyboards.set(ctx.from.id, buttonsText);

  const keyboard = Markup.keyboard(
    buttonsText.map(btn => Markup.button.text(btn.trim()))
    .resize()
    .persistent(); // Клавиатура не скрывается после нажатия

  ctx.reply('Клавиатура активирована. Используйте /stop чтобы убрать.', keyboard);
});

// Команда /stop - удаляет клавиатуру
bot.command('stop', (ctx) => {
  userKeyboards.delete(ctx.from.id);
  ctx.reply(
    'Клавиатура удалена',
    Markup.removeKeyboard()
  );
});

// Обработка нажатий кнопок
bot.on('text', (ctx) => {
  if (ctx.message.text.startsWith('/')) return;

  const userButtons = userKeyboards.get(ctx.from.id);
  if (userButtons && userButtons.includes(ctx.message.text)) {
    ctx.reply(`Вы нажали: "${ctx.message.text}"`);
  }
});

// Запуск бота
bot.launch()
  .then(() => console.log('Бот запущен!'))
  .catch(err => console.error('Ошибка запуска:', err));

// Остановка бота
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
