require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();

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

// Обработчик команды /see
bot.command('see', (ctx) => {
    const userId = ctx.from.id;
    const args = ctx.message.text.split(' ').slice(1).join(' ').split(',');

    if (args.length === 0 || args[0].trim() === '') {
        return ctx.replyWithMarkdownV2(
            '❌ *Неверный формат команды*\n' +
            '✨ *Используйте:* `/see Кнопка1, Кнопка2, Кнопка3`\n' +
            '🔹 *Пример:* `/see Да, Нет, Возможно`'
        );
    }

    const buttons = args.map(btn => btn.trim()).filter(btn => btn !== '');
    const keyboard = Markup.keyboard(buttons.map(btn => [btn])).resize();

    activeKeyboards.set(userId, keyboard);

    ctx.reply('Выберите вариант:', {
        reply_markup: keyboard.reply_markup,
        reply_to_message_id: ctx.message.message_id
    });
});

// Обработчик команды /stop
bot.command('stop', (ctx) => {
    const userId = ctx.from.id;

    if (activeKeyboards.has(userId)) {
        activeKeyboards.delete(userId);
        ctx.reply('Клавиатура скрыта', {
            reply_markup: { remove_keyboard: true },
            reply_to_message_id: ctx.message.message_id
        });
    } else {
        ctx.reply('У вас нет активной клавиатуры', {
            reply_to_message_id: ctx.message.message_id
        });
    }
});

// Обработчик напоминаний
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const userId = ctx.message.from.id;
    const chatId = ctx.message.chat.id;
    const username = ctx.message.from.username ? `@${ctx.message.from.username}` : escapeMarkdown(ctx.message.from.first_name);
    const currentTimerNumber = timerCounter++;

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    if (milliseconds > 0) {
        const timeString = getTimeString(amount, unit);
        await ctx.replyWithMarkdownV2(
            `⏳ *${escapeMarkdown(username)}, Таймер №${currentTimerNumber} установлен\\!*\n` +
            `🔹 *Текст:* ${escapeMarkdown(text)}\n` +
            `⏱️ *Сработает через:* ${escapeMarkdown(timeString)}\n` +
            `🆔 *ID таймера:* ${currentTimerNumber}`
        );

        setTimeout(async () => {
            try {
                await ctx.telegram.sendMessage(
                    chatId,
                    `🔔 *${escapeMarkdown(username)}, Таймер №${currentTimerNumber}\\!*\n` +
                    `📌 *Напоминание:* ${escapeMarkdown(text)}\n` +
                    `🎉 Время пришло\\!`,
                    { parse_mode: 'MarkdownV2' }
                );
            } catch (error) {
                console.error('Ошибка при отправке напоминания:', error);
            }
        }, milliseconds);
    } else {
        await ctx.reply('❌ Неверный формат времени. Используйте /1с, /5м, /2ч или /3д');
    }
});

// Обработчик текстовых сообщений (только для кнопок)
bot.on('text', (ctx) => {
    // Пропускаем если это команда
    if (ctx.message.text.startsWith('/')) return;

    const userId = ctx.from.id;
    const text = ctx.message.text;

    if (activeKeyboards.has(userId)) {
        ctx.reply(`Вы выбрали: ${text}`, {
            reply_markup: activeKeyboards.get(userId).reply_markup,
            reply_to_message_id: ctx.message.message_id
        });
    }
});

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
        "📝 *Пример:* `/10м Проверить почту`\n\n" +
        "🆕 *Новые команды:*\n" +
        "`/see Кнопка1, Кнопка2` \\- показать клавиатуру\n" +
        "`/stop` \\- скрыть клавиатуру"
    );
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Запуск бота
if (process.env.RENDER) {
    const PORT = process.env.PORT || 3000;
    bot.launch({
        webhook: {
            domain: process.env.WEBHOOK_URL,
            port: PORT
        }
    }).then(() => console.log('Бот запущен через webhook'));
} else {
    bot.launch().then(() => console.log('Бот запущен локально'));
}

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
