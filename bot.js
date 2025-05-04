require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');

const bot = new Telegraf(process.env.BOT_TOKEN);
let timerCounter = 1;
const activeKeyboards = new Map();
const activeTimers = new Map();

// Улучшенный парсер даты и времени
function parseDateTime(input, ctx) {
    try {
        input = input.trim();
        
        // Формат "DD.MM.YYYY HH:mm"
        if (/^\d{1,2}\.\d{1,2}\.\d{4} \d{1,2}:\d{2}$/.test(input)) {
            const [datePart, timePart] = input.split(' ');
            const [day, month, year] = datePart.split('.').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            const date = new Date(year, month - 1, day, hours, minutes);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date;
        }
        // Формат "DD.MM HH:mm"
        else if (/^\d{1,2}\.\d{1,2} \d{1,2}:\d{2}$/.test(input)) {
            const [datePart, timePart] = input.split(' ');
            const [day, month] = datePart.split('.').map(Number);
            const year = new Date().getFullYear();
            const [hours, minutes] = timePart.split(':').map(Number);
            
            const date = new Date(year, month - 1, day, hours, minutes);
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date;
        }
        // Формат "HH:mm"
        else if (/^\d{1,2}:\d{2}$/.test(input)) {
            const [hours, minutes] = input.split(':').map(Number);
            const now = new Date();
            let date = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hours,
                minutes
            );
            
            if (date <= now) {
                date.setDate(date.getDate() + 1);
            }
            return date;
        }
        
        throw new Error('Invalid format');
    } catch (e) {
        console.error('Date parsing error:', e);
        ctx.reply('❌ Неверный формат даты. Используйте:\n"DD.MM.YYYY HH:mm"\n"DD.MM HH:mm"\n"HH:mm"');
        return null;
    }
}

// Форматирование даты для вывода
function formatDate(date) {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
}

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    ctx.reply(
        `🕰️ *Привет, ${username}, Я бот-напоминалка\\!*\n\n` +
        `✨ *Как пользоваться:*\n\n` +
        `⏰ *Установка таймеров:*\n` +
        "`/timer 25\\.12\\.2023 20:00 Поздравить с Рождеством`\n" +
        "`/timer 15\\.08 12:00 Обед`\n" +
        "`/timer 18:30 Звонок маме`\n\n" +
        `⏱ *Быстрые напоминания:*\n` +
        "`/5с Напомни мне`\n" +
        "`/10м Позвонить другу`\n" +
        "`/2ч Принять лекарство`\n" +
        "`/3д Оплатить счёт`\n\n" +
        `🛠 *Другие команды:*\n` +
        "`/see Кнопка1, Кнопка2`\n" +
        "`/stop`\n" +
        "`/cancel ID_таймера`",
        { parse_mode: 'MarkdownV2' }
    );
});

// Команда /timer
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.replyWithMarkdownV2(
            '❌ *Формат:* `/timer дата_время напоминание`\n\n' +
            '*Примеры:*\n' +
            '`/timer 04\\.05\\.2025 22:00 Привет`\n' +
            '`/timer 10\\.05 15:30 Обед`\n' +
            '`/timer 18:00 Ужин`',
            { parse_mode: 'MarkdownV2' }
        );
    }

    // Объединяем дату и время (на случай если дата и время разделены пробелом)
    const datetimeStr = args[0] + (args[1].includes(':') ? '' : ' ' + args[1]);
    const text = args.slice(args[1].includes(':') ? 2 : 3).join(' ');
    const datetime = parseDateTime(datetimeStr, ctx);
    
    if (!datetime) return;

    const now = new Date();
    if (datetime <= now) {
        return ctx.reply('❌ Указанное время уже прошло!');
    }

    const timerId = timerCounter++;
    const timeout = datetime.getTime() - now.getTime();
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

    const timer = setTimeout(async () => {
        try {
            await ctx.replyWithMarkdownV2(
                `🔔 *${username}, Напоминание\\!*\n\n` +
                `📌 *Текст:* ${text}\n` +
                `⏰ *Запланировано на:* ${formatDate(datetime)}`,
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
        `🔹 *Текст:* ${text}\n` +
        `⏱ *Сработает:* ${formatDate(datetime)}\n` +
        `🆔 *ID таймера:* ${timerId}\n\n` +
        `Для отмены используйте: \`/cancel ${timerId}\``,
        { parse_mode: 'MarkdownV2' }
    );
});

// Команда /cancel
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите ID таймера\nПример: `/cancel 123`',
            { parse_mode: 'MarkdownV2' }
        );
    }

    const timerId = parseInt(args[0]);
    if (!activeTimers.has(timerId)) {
        return ctx.reply('❌ Таймер не найден');
    }

    const timer = activeTimers.get(timerId);
    if (timer.userId !== ctx.from.id) {
        return ctx.reply('❌ Вы можете отменять только свои таймеры');
    }

    clearTimeout(timer.timer);
    activeTimers.delete(timerId);
    ctx.replyWithMarkdownV2(
        `✅ *Таймер №${timerId} отменён\\!*\n\n` +
        `📌 *Текст:* ${timer.text}`,
        { parse_mode: 'MarkdownV2' }
    );
});

// Быстрые таймеры (5с, 10м и т.д.)
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, async (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const timerId = timerCounter++;
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;

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
                `📌 *Напоминание:* ${text}\n` +
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
        `🔹 *Текст:* ${text}\n` +
        `⏱ *Через:* ${amount}${unit}\n` +
        `🕒 *Время срабатывания:* ${formatDate(datetime)}\n` +
        `🆔 *ID таймера:* ${timerId}\n\n` +
        `Для отмены используйте: \`/cancel ${timerId}\``,
        { parse_mode: 'MarkdownV2' }
    );
});

// Клавиатуры (/see и /stop)
bot.command('see', (ctx) => {
    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    if (!buttons.length) {
        return ctx.replyWithMarkdownV2(
            '❌ Укажите кнопки через запятую\nПример: `/see Кнопка1, Кнопка2`',
            { parse_mode: 'MarkdownV2' }
        );
    }

    const keyboard = Markup.keyboard(
        buttons.map(btn => [btn.trim()])
    ).resize().selective();

    activeKeyboards.set(ctx.from.id, keyboard);
    ctx.reply('Выберите действие:', keyboard);
});

bot.command('stop', (ctx) => {
    if (activeKeyboards.has(ctx.from.id)) {
        ctx.reply('Клавиатура скрыта', Markup.removeKeyboard());
        activeKeyboards.delete(ctx.from.id);
    } else {
        ctx.reply('Нет активной клавиатуры');
    }
});

// Обработка обычных сообщений
bot.on('text', (ctx) => {
    if (ctx.message.text.startsWith('/')) return;
    if (activeKeyboards.has(ctx.from.id)) {
        console.log(`Пользователь ${ctx.from.id} нажал: ${ctx.message.text}`);
    }
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
