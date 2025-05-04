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
        if (/^\d{2}\.\d{2}\.\d{4} \d{2}:\d{2}$/.test(input)) {
            const [datePart, timePart] = input.split(' ');
            const [day, month, year] = datePart.split('.').map(Number);
            const [hours, minutes] = timePart.split(':').map(Number);
            
            const date = new Date(Date.UTC(year, month - 1, day, hours - 3, minutes));
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date;
        }
        // Формат "DD.MM HH:mm"
        else if (/^\d{2}\.\d{2} \d{2}:\d{2}$/.test(input)) {
            const [datePart, timePart] = input.split(' ');
            const [day, month] = datePart.split('.').map(Number);
            const year = new Date().getFullYear();
            const [hours, minutes] = timePart.split(':').map(Number);
            
            const date = new Date(Date.UTC(year, month - 1, day, hours - 3, minutes));
            if (isNaN(date.getTime())) throw new Error('Invalid date');
            return date;
        }
        // Формат "HH:mm"
        else if (/^\d{2}:\d{2}$/.test(input)) {
            const [hours, minutes] = input.split(':').map(Number);
            const now = new Date();
            let date = new Date(Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate(),
                hours - 3,
                minutes
            ));
            
            if (date <= now) {
                date = new Date(Date.UTC(
                    now.getUTCFullYear(),
                    now.getUTCMonth(),
                    now.getUTCDate() + 1,
                    hours - 3,
                    minutes
                ));
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
    return date.toLocaleString('ru-RU', {
        timeZone: 'Europe/Moscow',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).replace(',', '');
}

// Стартовое сообщение
bot.start((ctx) => {
    const username = ctx.from.username ? `@${ctx.from.username}` : ctx.from.first_name;
    ctx.reply(
        `🕰️ Привет, ${username}, я бот-напоминалка!\n\n` +
        `⏰ Установка таймеров:\n` +
        `/timer 04.05.2025 22:00 Текст\n` +
        `/timer 10.05 15:30 Текст\n` +
        `/timer 18:00 Текст\n\n` +
        `⏱ Быстрые таймеры:\n` +
        `/5с Текст\n` +
        `/10м Текст\n` +
        `/2ч Текст\n` +
        `/3д Текст\n\n` +
        `🛠 Другие команды:\n` +
        `/see Кнопка1, Кнопка2\n` +
        `/stop\n` +
        `/cancel ID_таймера`
    );
});

// Команда /timer
bot.command('timer', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (args.length < 2) {
        return ctx.reply('❌ Формат: /timer дата_время напоминание\nПримеры:\n/timer 04.05.2025 22:00 Привет\n/timer 10.05 15:30 Обед\n/timer 18:00 Ужин');
    }

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

    const timer = setTimeout(() => {
        ctx.reply(`🔔 Напоминание!\n📌 ${text}\n⏰ Запланировано на ${formatDate(datetime)}`);
        activeTimers.delete(timerId);
    }, timeout);

    activeTimers.set(timerId, { timer, userId: ctx.from.id, text, datetime });
    ctx.reply(
        `⏳ Таймер №${timerId} установлен!\n` +
        `📌 ${text}\n` +
        `⏰ ${formatDate(datetime)}\n` +
        `🆔 Для отмены: /cancel ${timerId}`
    );
});

// Команда /cancel
bot.command('cancel', (ctx) => {
    const args = ctx.message.text.split(' ').slice(1);
    if (!args.length) return ctx.reply('❌ Укажите ID таймера (/cancel 123)');

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
    ctx.reply(`✅ Таймер №${timerId} отменен:\n"${timer.text}"`);
});

// Быстрые таймеры (5с, 10м и т.д.)
bot.hears(/^\/(\d+)(с|м|ч|д)\s+(.+)$/, (ctx) => {
    const amount = parseInt(ctx.match[1]);
    const unit = ctx.match[2];
    const text = ctx.match[3];
    const timerId = timerCounter++;

    let milliseconds = 0;
    switch (unit) {
        case 'с': milliseconds = amount * 1000; break;
        case 'м': milliseconds = amount * 60 * 1000; break;
        case 'ч': milliseconds = amount * 60 * 60 * 1000; break;
        case 'д': milliseconds = amount * 24 * 60 * 60 * 1000; break;
    }

    const datetime = new Date(Date.now() + milliseconds);
    const timer = setTimeout(() => {
        ctx.reply(`🔔 Напоминание!\n📌 ${text}`);
        activeTimers.delete(timerId);
    }, milliseconds);

    activeTimers.set(timerId, { timer, userId: ctx.from.id, text, datetime });
    ctx.reply(
        `⏳ Таймер №${timerId} установлен!\n` +
        `📌 ${text}\n` +
        `⏱ Через ${amount}${unit}\n` +
        `🆔 Для отмены: /cancel ${timerId}`
    );
});

// Клавиатуры (/see и /stop)
bot.command('see', (ctx) => {
    const buttons = ctx.message.text.split(' ').slice(1).join(' ').split(',');
    if (!buttons.length) {
        return ctx.reply('❌ Укажите кнопки через запятую (/see Кнопка1, Кнопка2)');
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
