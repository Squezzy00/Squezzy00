require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map();

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

// Улучшенный парсер даты и времени
function parseDateTime(input) {
    // Формат "DD.MM.YYYY HH:mm"
    if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(input)) {
        const [datePart, timePart] = input.split(' ');
        const [day, month, year] = datePart.split('.').map(Number);
        const [hours, minutes] = timePart.split(':').map(Number);
        
        return new Date(year, month - 1, day, hours, minutes);
    }
    // Формат "DD.MM HH:mm"
    else if (/^\d{2}\.\d{2} \d{2}:\d{2}$/.test(input)) {
        const [datePart, timePart] = input.split(' ');
        const [day, month] = datePart.split('.').map(Number);
        const year = new Date().getFullYear();
        const [hours, minutes] = timePart.split(':').map(Number);
        
        return new Date(year, month - 1, day, hours, minutes);
    }
    // Формат "HH:mm"
    else if (/^\d{2}:\d{2}$/.test(input)) {
        const [hours, minutes] = input.split(':').map(Number);
        const now = new Date();
        const date = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hours,
            minutes
        );
        
        return date <= now ? new Date(date.setDate(date.getDate() + 1)) : date;
    }
    
    return null;
}

// Форматирование даты для вывода
function formatDate(date) {
    const pad = num => num.toString().padStart(2, '0');
    return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : escapeMarkdown(ctx.from.first_name);
    ctx.replyWithMarkdownV2(
        `🕰️ *Привет, ${username}, Я бот\\-напоминалка\\!*\n\n` +
        `✨ *Как пользоваться:*\n\n` +
        `⏰ *Установка таймеров:*\n` +
        `\`/timer 25\\.12\\.2023 20:00 Поздравить с Рождеством\`\n` +
        `\`/timer 15\\.08 12:00 Обед\`\n` +
        `\`/timer 18:00 Ужин\`\n\n` +
        `⏱ *Быстрые напоминания:*\n` +
        `\`/5с Напомни мне\`\n` +
        `\`/10м Позвонить другу\`\n` +
        `\`/2ч Принять лекарство\`\n` +
        `\`/3д Оплатить счёт\`\n\n` +
        `🛠 *Другие команды:*\n` +
        `\`/see Кнопка1, Кнопка2\`\n` +
        `\`/stop\`\n` +
        `\`/cancel ID_таймера\``,
        { parse_mode: 'MarkdownV2' }
    ).catch(e => console.error('Ошибка при отправке start:', e));
});

// Команда /timer
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.replyWithMarkdownV2(
            '❌ *Формат:* `\\/timer дата_время напоминание`\n\n' +
            '*Примеры:*\n' +
            '`/timer 04\\.05\\.2025 22:00 Привет`\n' +
            '`/timer 10\\.05 15:30 Обед`\n' +
            '`/timer 18:00 Ужин`',
            { parse_mode: 'MarkdownV2' }
        ).catch(e => console.error('Ошибка:', e));
    }

    const datetimeStr = args[0] + (args[1].includes(':') ? '' : ' ' + args[1]);
    const text = args.slice(args[1].includes(':') ? 2 : 3).join(' ');
    const datetime = parseDateTime(datetimeStr);
    
    if (!datetime || isNaN(datetime.getTime())) {
        return ctx.reply(
            '❌ Неверный формат даты. Используйте:\n' +
            '"DD.MM.YYYY HH:mm"\n' +
            '"DD.MM HH:mm"\n' +
            '"HH:mm"'
        ).catch(e => console.error('Ошибка:', e));
    }

    const now = new Date();
    if (datetime <= now) {
        return ctx.reply('❌ Указанное время уже прошло!').catch(e => console.error('Ошибка:', e));
    }

    const timerId = timerCounter++;
    const timeout = datetime.getTime() - now.getTime();
    const username = ctx.from.username ? `@${ctx.from.username}` : escapeMarkdown(ctx.from.first_name);

    const timer = setTimeout(async () => {
        try {
            await ctx.replyWithMarkdownV2(
                `🔔 *${username}, Таймер №${timerId}\\!*\n\n` +
                `📌 *Напоминание:* ${escapeMarkdown(text)}\n` +
                `🎉 Время пришло\\!`,
                { parse_mode: 'MarkdownV2' }
            );
            activeTimers.delete(timerId);
        } catch (error) {
            console.error('Ошибка при отправке напоминания:', error);
        }
    }, timeout);

    activeTimers.set(timerId, { timer, userId: ctx.from.id, text, datetime });
    ctx.replyWithMarkdownV2(
        `⏳ *${username}, Таймер №${timerId} установлен\\!*\n\n` +
        `🔹 *Текст:* ${escapeMarkdown(text)}\n` +
        `⏱ *Сработает:* ${formatDate(datetime)}\n` +
        `🆔 *ID таймера:* ${timerId}\n\n` +
        `Для отмены используйте: \\\`/cancel ${timerId}\\\``,
        { parse_mode: 'MarkdownV2' }
    ).catch(e => console.error('Ошибка при установке таймера:', e));
});

// Быстрые таймеры (5с, 10м и т.д.)
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const timerId = timerCounter++;
    const username = ctx.from.username ? `@${ctx.from.username}` : escapeMarkdown(ctx.from.first_name);

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    const datetime = new Date(Date.now() + milliseconds);
    const timer = setTimeout(async () => {
        try {
            await ctx.replyWithMarkdownV2(
                `🔔 *${username}, Таймер №${timerId}\\!*\n\n` +
                `📌 *Напоминание:* ${escapeMarkdown(text)}\n` +
                `🎉 Время пришло\\!`,
                { parse_mode: 'MarkdownV2' }
            );
            activeTimers.delete(timerId);
        } catch (error) {
            console.error('Ошибка при отправке напоминания:', error);
        }
    }, milliseconds);

    activeTimers.set(timerId, { timer, userId: ctx.from.id, text, datetime });
    ctx.replyWithMarkdownV2(
        `⏳ *${username}, Таймер №${timerId} установлен\\!*\n\n` +
        `🔹 *Текст:* ${escapeMarkdown(text)}\n` +
        `⏱ *Через:* ${amount}${unit}\n` +
        `🆔 *ID таймера:* ${timerId}\n\n` +
        `Для отмены используйте: \\\`/cancel ${timerId}\\\``,
        { parse_mode: 'MarkdownV2' }
    ).catch(e => console.error('Ошибка при установке быстрого таймера:', e));
});

// Команда /cancel
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите ID таймера\nПример: `/cancel 123`',
            { parse_mode: 'MarkdownV2' }
        ).catch(e => console.error('Ошибка:', e));
    }

    const timerId = parseInt(args[0]);
    if (!activeTimers.has(timerId)) {
        return ctx.reply('❌ Таймер не найден').catch(e => console.error('Ошибка:', e));
    }

    const timer = activeTimers.get(timerId);
    if (timer.userId !== ctx.from.id) {
        return ctx.reply('❌ Вы можете отменять только свои таймеры').catch(e => console.error('Ошибка:', e));
    }

    clearTimeout(timer.timer);
    activeTimers.delete(timerId);
    ctx.replyWithMarkdownV2(
        `✅ *Таймер №${timerId} отменён\\!*\n\n` +
        `📌 *Текст:* ${escapeMarkdown(timer.text)}`,
        { parse_mode: 'MarkdownV2' }
    ).catch(e => console.error('Ошибка при отмене таймера:', e));
});

// Команда /see
bot.command('see', (ctx) => {
    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    if (!buttons.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите кнопки через запятую\nПример: `/see Кнопка1, Кнопка2`',
            { parse_mode: 'MarkdownV2' }
        ).catch(e => console.error('Ошибка:', e));
    }

    const keyboard = Markup.keyboard(
        buttons.map(btn => [btn.trim()])
    ).resize().selective();

    activeKeyboards.set(ctx.from.id, keyboard);
    ctx.reply('Выберите действие:', keyboard).catch(e => console.error('Ошибка при отправке клавиатуры:', e));
});

// Команда /stop
bot.command('stop', (ctx) => {
    if (activeKeyboards.has(ctx.from.id)) {
        ctx.reply('Клавиатура скрыта', Markup.removeKeyboard())
           .then(() => activeKeyboards.delete(ctx.from.id))
           .catch(e => console.error('Ошибка при скрытии клавиатуры:', e));
    } else {
        ctx.reply('Нет активной клавиатуры').catch(e => console.error('Ошибка:', e));
    }
});

// Обработка обычных сообщений
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    if (activeKeyboards.has(ctx.from.id)) {
        console.log(`Пользователь ${ctx.from.id} нажал: ${ctx.message.text}`);
    }
});

// Обработка ошибок
bot.catch((err, ctx) => {
    console.error(`Ошибка для ${ctx.updateType}`, err);
});

// Запуск бота
const PORT = process.env.PORT || 3000;
bot.launch({
    webhook: process.env.RENDER ? {
        domain: process.env.WEBHOOK_URL,
        port: PORT
    } : undefined
}).then(() => console.log('Бот запущен'));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
