require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1; // Счетчик таймеров

// Обработчик команд напоминаний
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

// Функция для экранирования символов MarkdownV2
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

// Функция для красивого отображения времени
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
        "📝 *Пример:* `/10м Проверить почту`"
    );
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Запуск бота
bot.launch()
    .then(() => console.log('Бот запущен'))
    .catch(err => console.error('Ошибка запуска бота:', err));

// Обработка завершения процесса
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
