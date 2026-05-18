const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');

// ТВОЙ ТОКЕН
const token = '8635475470:AAFbgm_XpPDoWJUTUG-V7QR1EB9YhR1ev8g';
const bot = new TelegramBot(token, { polling: true });

// АДМИН ID
const ADMIN_ID = 5005387093;

// НАСТРОЙКИ
let config = {
    ownerid: "5005387093",
    promolimit: 0,
    promotip: "balance",
    promovalue: 1000
};

// ЗАГРУЗКА НАСТРОЕК
try {
    const cfg = JSON.parse(fs.readFileSync('./database/settings.json', 'utf8'));
    config = cfg;
} catch(e) {}

// ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ
let users = [];
try {
    users = JSON.parse(fs.readFileSync('./database/users.json', 'utf8'));
} catch(e) {}

// СОХРАНЕНИЕ
function saveUsers() {
    fs.writeFileSync('./database/users.json', JSON.stringify(users, null, '\t'));
}

function saveConfig() {
    fs.writeFileSync('./database/settings.json', JSON.stringify(config, null, '\t'));
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'трлн';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'млрд';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'млн';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'тыс';
    return num.toString();
}

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ДАННЫЕ (как в оригинале)
const cars = [
    { name: 'Самокат', cost: 500, id: 1 },
    { name: 'Велосипед', cost: 2500, id: 2 },
    { name: 'Гироскутер', cost: 5000, id: 3 },
    { name: 'Сегвей', cost: 7500, id: 4 },
    { name: 'Мопед', cost: 25000, id: 5 },
    { name: 'Мотоцикл', cost: 50000, id: 6 },
    { name: 'ВАЗ 2109', cost: 75000, id: 7 },
    { name: 'Квадроцикл', cost: 80000, id: 8 },
    { name: 'Багги', cost: 135000, id: 9 },
    { name: 'Вездеход', cost: 200000, id: 10 },
    { name: 'Лада Xray', cost: 350000, id: 11 },
    { name: 'Audi Q7', cost: 750000, id: 12 },
    { name: 'BMW X6', cost: 1000000, id: 13 },
    { name: 'Toyota FT-HS', cost: 1750000, id: 14 },
    { name: 'BMW Z4 M', cost: 2500000, id: 15 },
    { name: 'Subaru WRX STI', cost: 2750000, id: 16 },
    { name: 'Lamborghini Veneno', cost: 3000000, id: 17 },
    { name: 'Tesla Roadster', cost: 4500000, id: 18 },
    { name: 'Yamaha YZF R6', cost: 5000000, id: 19 },
    { name: 'Bugatti Chiron', cost: 6500000, id: 20 },
    { name: 'Thrust SSC', cost: 35000000, id: 21 },
    { name: 'Ferrari LaFerrari', cost: 39000000, id: 22 },
    { name: 'Koenigsegg Regera', cost: 50000000, id: 23 },
    { name: 'Tesla Semi', cost: 75000000, id: 24 },
    { name: 'Venom GT', cost: 125000000, id: 25 },
    { name: 'Rolls-Royce', cost: 200000000, id: 26 }
];

const yachts = [
    { name: 'Ванна', cost: 10000, id: 1 },
    { name: 'Nauticat 331', cost: 10000000, id: 2 },
    { name: 'Nordhavn 56 MS', cost: 15000000, id: 3 },
    { name: 'Princess 60', cost: 25000000, id: 4 },
    { name: 'Azimut 70', cost: 35000000, id: 5 },
    { name: 'Dominator 40M', cost: 50000000, id: 6 },
    { name: 'Moonen 124', cost: 60000000, id: 7 },
    { name: 'Wider 150', cost: 65000000, id: 8 },
    { name: 'Palmer Johnson 42M SuperSport', cost: 80000000, id: 9 },
    { name: 'Wider 165', cost: 85000000, id: 10 },
    { name: 'Eclipse', cost: 150000000, id: 11 },
    { name: 'Dubai', cost: 300000000, id: 12 },
    { name: 'Streets of Monaco', cost: 750000000, id: 13 }
];

const airplanes = [
    { name: 'Параплан', cost: 100000, id: 1 },
    { name: 'АН-2', cost: 350000, id: 2 },
    { name: 'Cessna-172E', cost: 700000, id: 3 },
    { name: 'Supermarine Spitfire', cost: 1000000, id: 4 },
    { name: 'BRM NG-5', cost: 1400000, id: 5 },
    { name: 'Cessna T210', cost: 2600000, id: 6 },
    { name: 'Beechcraft 1900D', cost: 5500000, id: 7 },
    { name: 'Cessna 550', cost: 8000000, id: 8 },
    { name: 'Hawker 4000', cost: 22400000, id: 9 },
    { name: 'Learjet 31', cost: 45000000, id: 10 },
    { name: 'Airbus A318', cost: 85000000, id: 11 },
    { name: 'F-35A', cost: 160000000, id: 12 },
    { name: 'Boeing 747-430 Custom', cost: 225000000, id: 13 },
    { name: 'C-17A Globemaster III', cost: 350000000, id: 14 },
    { name: 'F-22 Raptor', cost: 400000000, id: 15 },
    { name: 'Airbus 380 Custom', cost: 600000000, id: 16 },
    { name: 'B-2 Spirit Stealth Bomber', cost: 1359000000, id: 17 }
];

const helicopters = [
    { name: 'Шарик с пропеллером', cost: 2, id: 1 },
    { name: 'RotorWay Exec 162F', cost: 300000, id: 2 },
    { name: 'Robinson R44', cost: 450000, id: 3 },
    { name: 'Hiller UH-12C', cost: 1300000, id: 4 },
    { name: 'AW119 Koala', cost: 2500000, id: 5 },
    { name: 'MBB BK 117', cost: 4000000, id: 6 },
    { name: 'Eurocopter EC130', cost: 7500000, id: 7 },
    { name: 'Leonardo AW109 Power', cost: 10000000, id: 8 },
    { name: 'Sikorsky S-76', cost: 15000000, id: 9 },
    { name: 'Bell 429WLG', cost: 19000000, id: 10 },
    { name: 'NHI NH90', cost: 35000000, id: 11 },
    { name: 'Kazan Mi-35M', cost: 60000000, id: 12 },
    { name: 'Bell V-22 Osprey', cost: 135000000, id: 13 }
];

const homes = [
    { name: 'Коробка из-под холодильника', cost: 250, id: 1 },
    { name: 'Подвал', cost: 3000, id: 2 },
    { name: 'Палатка', cost: 3500, id: 3 },
    { name: 'Домик на дереве', cost: 5000, id: 4 },
    { name: 'Полуразрушенный дом', cost: 10000, id: 5 },
    { name: 'Дом в лесу', cost: 25000, id: 6 },
    { name: 'Деревянный дом', cost: 37500, id: 7 },
    { name: 'Дача', cost: 125000, id: 8 },
    { name: 'Кирпичный дом', cost: 80000, id: 9 },
    { name: 'Коттедж', cost: 450000, id: 10 },
    { name: 'Особняк', cost: 1250000, id: 11 },
    { name: 'Дом на Рублёвке', cost: 5000000, id: 12 },
    { name: 'Личный небоскрёб', cost: 7000000, id: 13 },
    { name: 'Остров с особняком', cost: 12500000, id: 14 },
    { name: 'Белый дом', cost: 20000000, id: 15 }
];

const apartments = [
    { name: 'Чердак', cost: 15000, id: 1 },
    { name: 'Квартира в общежитии', cost: 55000, id: 2 },
    { name: 'Однокомнатная квартира', cost: 175000, id: 3 },
    { name: 'Двухкомнатная квартира', cost: 260000, id: 4 },
    { name: 'Четырехкомнатная квартира', cost: 500000, id: 5 },
    { name: 'Квартира в центре Москвы', cost: 1600000, id: 6 },
    { name: 'Двухуровневая квартира', cost: 4000000, id: 7 },
    { name: 'Квартира с Евроремонтом', cost: 6000000, id: 8 }
];

const phones = [
    { name: 'Nokia 108', cost: 250, id: 1 },
    { name: 'Nokia 3310 (2017)', cost: 500, id: 2 },
    { name: 'ASUS ZenFone 4', cost: 2000, id: 3 },
    { name: 'BQ Aquaris X', cost: 10000, id: 4 },
    { name: 'Sony Xperia XA', cost: 15000, id: 5 },
    { name: 'Samsung Galaxy S8', cost: 30000, id: 6 },
    { name: 'Xiaomi Mi Mix', cost: 50000, id: 7 },
    { name: 'Torex FS1', cost: 75000, id: 8 },
    { name: 'iPhone X', cost: 100000, id: 9 },
    { name: 'Мегафон С1', cost: 250000, id: 10 }
];

const pets = [
    { name: 'Улитка', cost: 1000, id: 1, upgradeCost: 2000 },
    { name: 'Лягушка', cost: 25000, id: 2, upgradeCost: 50000 },
    { name: 'Заяц', cost: 500000, id: 3, upgradeCost: 1000000 },
    { name: 'Свинья', cost: 300000000, id: 4, upgradeCost: 600000000 },
    { name: 'Лиса', cost: 1250000000, id: 5, upgradeCost: 2500000000 },
    { name: 'Собака', cost: 5000000000, id: 6, upgradeCost: 10000000000 },
    { name: 'Панда', cost: 30000000000, id: 7, upgradeCost: 60000000000 },
    { name: 'Горилла', cost: 180000000000, id: 8, upgradeCost: 360000000000 }
];

const farms = [
    { name: '6U Nvidia', cost: 20500000, earn: 2, id: 1 },
    { name: 'AntminerS9', cost: 100000000, earn: 10, id: 2 },
    { name: 'FM2018-BT200', cost: 900000000, earn: 100, id: 3 }
];

const businesses = [
    { name: 'Шаурмичная', cost: 50000, earn: 400, id: 1, icon: '🥖' },
    { name: 'Ларёк', cost: 100000, earn: 700, id: 2, icon: '🏪' },
    { name: 'Ресторан', cost: 300000, earn: 2500, id: 3, icon: '🍷' },
    { name: 'Магазин', cost: 500000, earn: 3800, id: 4, icon: '🏫' },
    { name: 'Завод', cost: 1500000, earn: 8000, id: 5, icon: '🏭' },
    { name: 'Шахта', cost: 25000000, earn: 70000, id: 6, icon: '⛏️' },
    { name: 'Офис', cost: 80000000, earn: 220000, id: 7, icon: '🏢' },
    { name: 'Разработка игр', cost: 150000000, earn: 300000, id: 8, icon: '🎮' },
    { name: 'Нефтевышка', cost: 500000000, earn: 700000, id: 9, icon: '🛢️' },
    { name: 'Атомная электростанция', cost: 800000000, earn: 1000000, id: 10, icon: '⚡' },
    { name: 'Космическое агентство', cost: 50000000000, earn: 50000000, id: 11, icon: '🚀' }
];

const worksList = [
    { name: 'Дворник', requiredLevel: 1, min: 2000, max: 2500, id: 1 },
    { name: 'Сантехник', requiredLevel: 3, min: 3750, max: 4000, id: 2 },
    { name: 'Электрик', requiredLevel: 5, min: 4000, max: 4500, id: 3 },
    { name: 'Слесарь', requiredLevel: 8, min: 5000, max: 5500, id: 4 },
    { name: 'Юрист', requiredLevel: 10, min: 7500, max: 8000, id: 5 },
    { name: 'Бухгалтер', requiredLevel: 14, min: 9000, max: 9489, id: 6 },
    { name: 'Бармен', requiredLevel: 22, min: 10000, max: 12500, id: 7 },
    { name: 'Администратор', requiredLevel: 25, min: 12500, max: 13500, id: 8 },
    { name: 'Программист', requiredLevel: 49, min: 16000, max: 17500, id: 9 }
];

let btcPrice = 6000;
let promoUsed = 0;

// ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ
function getUser(userId) {
    return users.find(u => u.id == userId);
}

// СОЗДАНИЕ ПОЛЬЗОВАТЕЛЯ
async function createUser(userId, tag) {
    const date = new Date();
    users.push({
        id: userId,
        uid: users.length,
        balance: 5000,
        bank: 0,
        btc: 0,
        farm_btc: 0,
        farms: 0,
        farmslimit: 200,
        energy: 10,
        opit: 0,
        biz: 0,
        zhelezo: 0,
        zoloto: 0,
        almaz: 0,
        bizlvl: 0,
        rating: 0,
        regDate: `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`,
        mention: true,
        ban: false,
        tag: tag,
        work: 0,
        business: 0,
        notifications: true,
        exp: 1,
        level: 1,
        referal: null,
        promo: false,
        transport: { car: 0, yacht: 0, airplane: 0, helicopter: 0 },
        realty: { home: 0, apartment: 0 },
        misc: { phone: 0, farm: 0, pet: 0 },
        settings: { firstmsg: true, adm: 0, trade: true, old: false, limit: 1000000 },
        pet: { lvl: 0, poterl: false },
        marriage: { partner: 0, requests: [] },
        timers: { hasWorked: false, bonus: false, poxod: false, poxod2: false, kopat: false, hack: false }
    });
    saveUsers();
    return getUser(userId);
}

// КУРС БИТКОИНА
async function updateBtcPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        btcPrice = Math.floor(data.bitcoin.usd);
    } catch(e) {}
}

setInterval(updateBtcPrice, 60000);
updateBtcPrice();

// ФОНОВЫЕ ЗАДАЧИ
setInterval(() => {
    for (const user of users) {
        // Восстановление энергии
        if (user.energy < 10) user.energy++;
        
        // Доход с бизнеса
        if (user.business) {
            const biz = businesses.find(b => b.id === user.business);
            if (biz) user.biz += biz.earn * (user.bizlvl + 1);
        }
        
        // Доход с ферм
        if (user.farms > 0 && user.misc.farm) {
            const farm = farms.find(f => f.id === user.misc.farm);
            if (farm) user.farm_btc += user.farms * farm.earn;
        }
    }
    saveUsers();
}, 3600000);

// ========== ОБРАБОТЧИКИ КОМАНД ==========

// СТАРТ
bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id;
    const tag = msg.from.first_name;
    
    let user = getUser(userId);
    if (!user) {
        await createUser(userId, tag);
        user = getUser(userId);
    }
    
    if (user.settings.firstmsg) {
        bot.sendMessage(userId, 
            `🤖 Добро пожаловать в YumaBot, ${tag}!\n\n` +
            `📚 Отправь "помощь" чтобы узнать все команды.\n` +
            `💰 Твой стартовый баланс: 5000$`,
            {
                reply_markup: {
                    keyboard: [
                        [{ text: '🔑 Бонус' }, { text: '📚 Помощь' }, { text: '💰 Профиль' }],
                        [{ text: '💼 Работа' }, { text: '🏪 Бизнес' }, { text: '🔋 Ферма' }]
                    ],
                    resize_keyboard: true
                }
            }
        );
        user.settings.firstmsg = false;
        saveUsers();
    } else {
        bot.sendMessage(userId, `С возвращением, ${tag}!`, {
            reply_markup: {
                keyboard: [
                    [{ text: '💰 Профиль' }, { text: '💎 Баланс' }],
                    [{ text: '💼 Работа' }, { text: '🏪 Бизнес' }, { text: '🔋 Ферма' }],
                    [{ text: '🛒 Магазин' }, { text: '🏆 Топ' }, { text: '📚 Помощь' }]
                ],
                resize_keyboard: true
            }
        });
    }
});

// ПОМОЩЬ
bot.onText(/помощь/i, async (msg) => {
    const userId = msg.from.id;
    bot.sendMessage(userId,
        `📚 **YUMA BOT - КОМАНДЫ**\n\n` +
        `👤 **Профиль** - твоя статистика\n` +
        `💰 **Баланс** - твои деньги\n` +
        `💼 **Работа** - заработать\n` +
        `🏪 **Бизнес** - управление бизнесом\n` +
        `🔋 **Ферма** - биткоин ферма\n` +
        `🛒 **Магазин** - купить имущество\n` +
        `🏆 **Топ** - лучшие игроки\n` +
        `🔑 **Бонус** - ежедневный бонус\n` +
        `💽 **Курс** - курс биткоина\n\n` +
        `💸 **Банк [сумма]** - положить деньги\n` +
        `💸 **Банк снять [сумма]** - снять деньги\n` +
        `🤝 **Передать [id] [сумма]** - перевести деньги\n` +
        `✏️ **Ник [ник]** - сменить имя`
    );
});

// ПРОФИЛЬ
bot.onText(/профиль/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return bot.sendMessage(userId, '❌ Ты не зарегистрирован. Напиши /start');
    
    let text = `🔎 **ТВОЙ ПРОФИЛЬ**\n\n`;
    text += `🆔 ID: ${user.uid}\n`;
    text += `📛 Ник: ${user.tag}\n`;
    text += `💰 Денег: ${user.balance.toLocaleString()}$\n`;
    text += `💳 В банке: ${user.bank.toLocaleString()}$\n`;
    text += `💽 Биткоинов: ${user.btc}₿\n`;
    text += `👑 Рейтинг: ${user.rating}\n`;
    text += `🌟 Уровень: ${user.level} (${user.opit}/24 опыта)\n`;
    text += `⚡ Энергия: ${user.energy}/10\n`;
    text += `📅 Регистрация: ${user.regDate}\n\n`;
    
    text += `🔐 **Имущество:**\n`;
    if (user.transport.car) text += `🚗 Машина: ${cars.find(c => c.id === user.transport.car)?.name || 'Нет'}\n`;
    if (user.transport.yacht) text += `🛥 Яхта: ${yachts.find(y => y.id === user.transport.yacht)?.name || 'Нет'}\n`;
    if (user.transport.airplane) text += `🛩 Самолёт: ${airplanes.find(a => a.id === user.transport.airplane)?.name || 'Нет'}\n`;
    if (user.transport.helicopter) text += `🚁 Вертолёт: ${helicopters.find(h => h.id === user.transport.helicopter)?.name || 'Нет'}\n`;
    if (user.realty.home) text += `🏠 Дом: ${homes.find(h => h.id === user.realty.home)?.name || 'Нет'}\n`;
    if (user.realty.apartment) text += `🏢 Квартира: ${apartments.find(a => a.id === user.realty.apartment)?.name || 'Нет'}\n`;
    if (user.misc.phone) text += `📱 Телефон: ${phones.find(p => p.id === user.misc.phone)?.name || 'Нет'}\n`;
    if (user.misc.pet) text += `🐼 Питомец: ${pets.find(p => p.id === user.misc.pet)?.name || 'Нет'} (ур. ${user.pet.lvl})\n`;
    if (user.misc.farm) text += `🔋 Ферма: ${farms.find(f => f.id === user.misc.farm)?.name || 'Нет'} x${user.farms}\n`;
    if (user.business) text += `🏪 Бизнес: ${businesses.find(b => b.id === user.business)?.name || 'Нет'}\n`;
    
    bot.sendMessage(userId, text);
});

// БАЛАНС
bot.onText(/баланс/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    bot.sendMessage(userId,
        `💰 **ТВОЙ БАЛАНС**\n\n` +
        `💵 Наличные: ${user.balance.toLocaleString()}$\n` +
        `🏦 В банке: ${user.bank.toLocaleString()}$\n` +
        `💽 Биткоины: ${user.btc}₿`
    );
});

// РАБОТА
bot.onText(/работа/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (!user.work) {
        let text = `📋 **ДОСТУПНЫЕ ПРОФЕССИИ**\n\n`;
        for (const w of worksList) {
            const unlocked = user.level >= w.requiredLevel;
            text += `${unlocked ? '✅' : '🔒'} ${w.id}. ${w.name} — ${w.min.toLocaleString()}-${w.max.toLocaleString()}$ (${unlocked ? 'доступна' : `требуется ${w.requiredLevel} уровень`})\n`;
        }
        text += `\n📝 Напиши "работа [номер]" чтобы устроиться`;
        bot.sendMessage(userId, text);
        return;
    }
    
    if (user.timers.hasWorked) {
        bot.sendMessage(userId, `⏳ Ты уже работал в последние 10 минут! Отдохни.`);
        return;
    }
    
    const work = worksList.find(w => w.id === user.work);
    if (!work) return;
    
    const earn = randomInt(work.min, work.max);
    user.balance += earn;
    user.opit += 1;
    user.timers.hasWorked = true;
    
    setTimeout(() => { user.timers.hasWorked = false; saveUsers(); }, 600000);
    saveUsers();
    
    if (user.opit >= 24) {
        user.level++;
        user.opit = 0;
        bot.sendMessage(userId, `🎉 **ПОЗДРАВЛЯЮ!** Ты повысил уровень до ${user.level}! 🎉`);
    }
    
    bot.sendMessage(userId,
        `✅ **РАБОЧАЯ СМЕНА ЗАКОНЧЕНА**\n\n` +
        `📋 Профессия: ${work.name}\n` +
        `💵 Заработано: ${earn.toLocaleString()}$\n` +
        `⭐ Опыт: +1\n` +
        `⚡ Энергия: ${user.energy-1}/10\n\n` +
        `💰 Баланс: ${user.balance.toLocaleString()}$`
    );
});

// УСТРОЙСТВО НА РАБОТУ
bot.onText(/работа (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const workId = parseInt(match[1]);
    const work = worksList.find(w => w.id === workId);
    if (!work) return bot.sendMessage(userId, '❌ Неверный номер профессии');
    
    if (user.level < work.requiredLevel) {
        return bot.sendMessage(userId, `❌ Тебе нужно достичь ${work.requiredLevel} уровня, чтобы работать ${work.name}`);
    }
    
    user.work = workId;
    saveUsers();
    bot.sendMessage(userId, `✅ Ты устроился на работу "${work.name}"!\n\n💼 Теперь работай командой "работа"`);
});

// УВОЛИТЬСЯ
bot.onText(/уволиться/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (!user.work) return bot.sendMessage(userId, '❌ Ты нигде не работаешь');
    
    user.work = 0;
    saveUsers();
    bot.sendMessage(userId, `✅ Ты уволился с работы`);
});

// БАНК
bot.onText(/банк$/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    bot.sendMessage(userId,
        `🏦 **БАНКОВСКИЙ СЧЁТ**\n\n` +
        `💰 На счету: ${user.bank.toLocaleString()}$\n` +
        `💵 Наличные: ${user.balance.toLocaleString()}$\n\n` +
        `📝 Команды:\n` +
        `"банк [сумма]" - положить деньги\n` +
        `"банк снять [сумма]" - снять деньги`
    );
});

bot.onText(/банк (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    let amount = parseInt(match[1]);
    if (isNaN(amount)) return;
    
    if (amount <= 0) return bot.sendMessage(userId, '❌ Сумма должна быть больше 0');
    if (amount > user.balance) return bot.sendMessage(userId, `❌ Недостаточно денег! У тебя ${user.balance.toLocaleString()}$`);
    
    user.balance -= amount;
    user.bank += amount;
    saveUsers();
    
    bot.sendMessage(userId,
        `✅ **ПОПОЛНЕНИЕ БАНКА**\n\n` +
        `💰 Внесено: ${amount.toLocaleString()}$\n` +
        `🏦 На счету: ${user.bank.toLocaleString()}$\n` +
        `💵 Осталось: ${user.balance.toLocaleString()}$`
    );
});

bot.onText(/банк снять (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    let amount = parseInt(match[1]);
    if (isNaN(amount)) return;
    
    if (amount <= 0) return bot.sendMessage(userId, '❌ Сумма должна быть больше 0');
    if (amount > user.bank) return bot.sendMessage(userId, `❌ Недостаточно в банке! У тебя ${user.bank.toLocaleString()}$`);
    
    user.bank -= amount;
    user.balance += amount;
    saveUsers();
    
    bot.sendMessage(userId,
        `✅ **СНЯТИЕ С БАНКА**\n\n` +
        `💰 Снято: ${amount.toLocaleString()}$\n` +
        `🏦 Осталось: ${user.bank.toLocaleString()}$\n` +
        `💵 Баланс: ${user.balance.toLocaleString()}$`
    );
});

// ПЕРЕДАТЬ ДЕНЬГИ
bot.onText(/передать (\d+) (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const targetUid = parseInt(match[1]);
    const amount = parseInt(match[2]);
    
    if (amount <= 0) return bot.sendMessage(userId, '❌ Сумма должна быть больше 0');
    if (amount > user.balance) return bot.sendMessage(userId, `❌ Недостаточно денег! У тебя ${user.balance.toLocaleString()}$`);
    
    const target = users.find(u => u.uid === targetUid);
    if (!target) return bot.sendMessage(userId, '❌ Игрок с таким ID не найден');
    
    user.balance -= amount;
    target.balance += amount;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты перевёл ${amount.toLocaleString()}$ игроку ${target.tag}`);
    if (target.notifications) {
        bot.sendMessage(target.id, `📩 Игрок ${user.tag} перевёл тебе ${amount.toLocaleString()}$`);
    }
});

// БИЗНЕС
bot.onText(/бизнес$/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (!user.business) {
        let text = `🏪 **ДОСТУПНЫЕ БИЗНЕСЫ**\n\n`;
        for (const b of businesses) {
            text += `${b.icon} ${b.id}. ${b.name} — ${b.cost.toLocaleString()}$ (прибыль ${b.earn.toLocaleString()}$/час)\n`;
        }
        text += `\n📝 "купить бизнес [номер]" - приобрести`;
        bot.sendMessage(userId, text);
    } else {
        const biz = businesses.find(b => b.id === user.business);
        const earn = biz.earn * (user.bizlvl + 1);
        bot.sendMessage(userId,
            `🏪 **${biz.icon} ${biz.name}**\n\n` +
            `💰 Прибыль: ${earn.toLocaleString()}$/час\n` +
            `💳 На счету: ${user.biz.toLocaleString()}$\n` +
            `🌟 Уровень: ${user.bizlvl}\n\n` +
            `📝 Команды:\n` +
            `"бизнес снять" - забрать прибыль\n` +
            `"бизнес улучшить" - прокачать бизнес`
        );
    }
});

bot.onText(/купить бизнес (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const bizId = parseInt(match[1]);
    const biz = businesses.find(b => b.id === bizId);
    if (!biz) return bot.sendMessage(userId, '❌ Неверный номер бизнеса');
    if (user.business) return bot.sendMessage(userId, '❌ У тебя уже есть бизнес! Продай его сначала');
    if (user.balance < biz.cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${biz.cost.toLocaleString()}$`);
    
    user.balance -= biz.cost;
    user.business = bizId;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты купил бизнес "${biz.name}" за ${biz.cost.toLocaleString()}$!`);
});

bot.onText(/бизнес снять/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.business) return bot.sendMessage(userId, '❌ У тебя нет бизнеса');
    if (user.biz <= 0) return bot.sendMessage(userId, '❌ На счету бизнеса нет денег');
    
    const amount = user.biz;
    user.balance += amount;
    user.biz = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты снял ${amount.toLocaleString()}$ с бизнеса`);
});

bot.onText(/бизнес улучшить/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.business) return bot.sendMessage(userId, '❌ У тебя нет бизнеса');
    
    const biz = businesses.find(b => b.id === user.business);
    const cost = biz.cost * (user.bizlvl + 1);
    
    if (user.balance < cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${cost.toLocaleString()}$`);
    
    user.balance -= cost;
    user.bizlvl++;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Бизнес улучшен до ${user.bizlvl} уровня за ${cost.toLocaleString()}$!`);
});

// ФЕРМА
bot.onText(/ферма/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (!user.misc.farm) {
        let text = `🔋 **МАЙНИНГ ФЕРМЫ**\n\n`;
        for (const f of farms) {
            text += `${f.id}. ${f.name} — ${f.cost.toLocaleString()}$ (${f.earn}₿/час)\n`;
        }
        text += `\n📝 "купить ферму [номер] [кол-во]" - приобрести`;
        bot.sendMessage(userId, text);
    } else {
        const farm = farms.find(f => f.id === user.misc.farm);
        bot.sendMessage(userId,
            `🔋 **${farm.name}**\n\n` +
            `📊 Количество: ${user.farms} шт.\n` +
            `💹 Доход: ${user.farms * farm.earn}₿/час\n` +
            `💽 На счету: ${user.farm_btc}₿\n\n` +
            `📝 "ферма собрать" - забрать биткоины`
        );
    }
});

bot.onText(/купить ферму (\d+)(?:\s+(\d+))?/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const farmId = parseInt(match[1]);
    let amount = match[2] ? parseInt(match[2]) : 1;
    
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return bot.sendMessage(userId, '❌ Неверный номер фермы');
    
    const totalCost = farm.cost * amount;
    if (user.balance < totalCost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${totalCost.toLocaleString()}$`);
    
    user.balance -= totalCost;
    if (user.misc.farm !== farmId) user.misc.farm = farmId;
    user.farms += amount;
    if (user.farms > user.farmslimit) user.farms = user.farmslimit;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Куплено ${amount} шт. ${farm.name} за ${totalCost.toLocaleString()}$!`);
});

bot.onText(/ферма собрать/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.misc.farm) return bot.sendMessage(userId, '❌ У тебя нет ферм');
    if (user.farm_btc <= 0) return bot.sendMessage(userId, '❌ На фермах нет биткоинов');
    
    const btcAmount = user.farm_btc;
    user.btc += btcAmount;
    user.farm_btc = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты собрал ${btcAmount}₿ с ферм!`);
});

// МАГАЗИН
bot.onText(/магазин/i, async (msg) => {
    const userId = msg.from.id;
    bot.sendMessage(userId,
        `🛒 **МАГАЗИН**\n\n` +
        `🚗 **Транспорт:**\n` +
        `  машины - список машин\n` +
        `  яхты - список яхт\n` +
        `  самолеты - список самолётов\n` +
        `  вертолеты - список вертолётов\n\n` +
        `🏘 **Недвижимость:**\n` +
        `  дома - список домов\n` +
        `  квартиры - список квартир\n\n` +
        `📌 **Остальное:**\n` +
        `  телефоны - список телефонов\n` +
        `  питомцы - список питомцев\n` +
        `  фермы - список ферм\n` +
        `  рейтинг [кол-во] - купить рейтинг (250 млн$ за 1)\n` +
        `  биткоин [кол-во] - купить биткоин`
    );
});

// МАШИНЫ
bot.onText(/машины/i, async (msg) => {
    const userId = msg.from.id;
    let text = `🚗 **СПИСОК МАШИН**\n\n`;
    for (const c of cars) {
        text += `${c.id}. ${c.name} — ${c.cost.toLocaleString()}$\n`;
    }
    text += `\n📝 "купить машину [номер]"`;
    bot.sendMessage(userId, text);
});

bot.onText(/купить машину (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const carId = parseInt(match[1]);
    const car = cars.find(c => c.id === carId);
    if (!car) return bot.sendMessage(userId, '❌ Неверный номер');
    if (user.transport.car) return bot.sendMessage(userId, '❌ У тебя уже есть машина! Продай её сначала');
    if (user.balance < car.cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${car.cost.toLocaleString()}$`);
    
    user.balance -= car.cost;
    user.transport.car = carId;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты купил "${car.name}" за ${car.cost.toLocaleString()}$!`);
});

// ПИТОМЦЫ
bot.onText(/питомцы/i, async (msg) => {
    const userId = msg.from.id;
    let text = `🐼 **СПИСОК ПИТОМЦЕВ**\n\n`;
    for (const p of pets) {
        text += `${p.id}. ${p.name} — ${p.cost.toLocaleString()}$\n`;
    }
    text += `\n📝 "купить питомца [номер]" - приобрести\n`;
    text += `"питомец поход" - отправить в поход\n`;
    text += `"питомец улучшить" - прокачать уровень`;
    bot.sendMessage(userId, text);
});

bot.onText(/купить питомца (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    const petId = parseInt(match[1]);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return bot.sendMessage(userId, '❌ Неверный номер');
    if (user.misc.pet) return bot.sendMessage(userId, '❌ У тебя уже есть питомец! Продай его сначала');
    if (user.balance < pet.cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${pet.cost.toLocaleString()}$`);
    
    user.balance -= pet.cost;
    user.misc.pet = petId;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты купил питомца "${pet.name}" за ${pet.cost.toLocaleString()}$!`);
});

bot.onText(/питомец поход/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.misc.pet) return bot.sendMessage(userId, '❌ У тебя нет питомца');
    if (user.timers.poxod) return bot.sendMessage(userId, '⏳ Питомец устал! Отдохни 60 минут');
    
    const findCash = randomInt(736, 2879);
    user.balance += findCash;
    user.timers.poxod = true;
    saveUsers();
    
    setTimeout(() => { user.timers.poxod = false; saveUsers(); }, 3600000);
    
    bot.sendMessage(userId, `✅ Твой питомец нашёл в походе ${findCash.toLocaleString()}$!`);
});

bot.onText(/питомец улучшить/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.misc.pet) return bot.sendMessage(userId, '❌ У тебя нет питомца');
    
    const pet = pets.find(p => p.id === user.misc.pet);
    const cost = pet.upgradeCost * (user.pet.lvl + 1);
    
    if (user.balance < cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${cost.toLocaleString()}$`);
    
    user.balance -= cost;
    user.pet.lvl++;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Питомец улучшен до ${user.pet.lvl} уровня за ${cost.toLocaleString()}$!`);
});

// ТОП
bot.onText(/топ/i, async (msg) => {
    const sorted = [...users].sort((a,b) => b.rating - a.rating).slice(0,10);
    let text = `🏆 **ТОП-10 ИГРОКОВ** 🏆\n\n`;
    for (let i = 0; i < sorted.length; i++) {
        const u = sorted[i];
        text += `${i+1}. ${u.tag} — 👑${u.rating} | 💰${u.balance.toLocaleString()}$\n`;
    }
    bot.sendMessage(msg.from.id, text);
});

// БОНУС
bot.onText(/бонус/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (user.timers.bonus) {
        bot.sendMessage(userId, '⏳ Бонус можно получить раз в 24 часа!');
        return;
    }
    
    const prizes = [
        { text: '50.000$', add: () => user.balance += 50000 },
        { text: '1.000₿', add: () => user.btc += 1000 },
        { text: '5 рейтинга', add: () => user.rating += 5 },
        { text: '1 рейтинг', add: () => user.rating += 1 },
        { text: '10 рейтинга', add: () => user.rating += 10 },
        { text: '2 рейтинга', add: () => user.rating += 2 },
        { text: '3 рейтинга', add: () => user.rating += 3 },
        { text: '4 рейтинга', add: () => user.rating += 4 },
        { text: '1.000.000$ в банк', add: () => user.bank += 1000000 },
        { text: '5.000.000$ в банк', add: () => user.bank += 5000000 },
        { text: '10.000.000$ в банк', add: () => user.bank += 10000000 },
        { text: '50.000.000$ в банк', add: () => user.bank += 50000000 }
    ];
    
    const prize = randomPick(prizes);
    prize.add();
    user.timers.bonus = true;
    saveUsers();
    
    setTimeout(() => { user.timers.bonus = false; saveUsers(); }, 86400000);
    
    bot.sendMessage(userId, `🎁 **ЕЖЕДНЕВНЫЙ БОНУС**\n\n✅ Ты получил ${prize.text}!`);
});

// КУРС
bot.onText(/курс/i, async (msg) => {
    bot.sendMessage(msg.from.id, `💽 **КУРС БИТКОИНА**\n\n1₿ = ${btcPrice.toLocaleString()}$`);
});

// КУПИТЬ БИТКОИН
bot.onText(/биткоин (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    let amount = parseInt(match[1]);
    const cost = amount * btcPrice;
    
    if (user.balance < cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${cost.toLocaleString()}$`);
    
    user.balance -= cost;
    user.btc += amount;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Куплено ${amount}₿ за ${cost.toLocaleString()}$!`);
});

// КУПИТЬ РЕЙТИНГ
bot.onText(/рейтинг (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    let amount = parseInt(match[1]);
    const cost = amount * 250000000;
    
    if (user.balance < cost) return bot.sendMessage(userId, `❌ Недостаточно денег! Нужно ${cost.toLocaleString()}$`);
    
    user.balance -= cost;
    user.rating += amount;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Куплено ${amount} рейтинга за ${cost.toLocaleString()}$!`);
});

// ПРОДАЖА
bot.onText(/продать машину/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.transport.car) return bot.sendMessage(userId, '❌ У тебя нет машины');
    
    const car = cars.find(c => c.id === user.transport.car);
    const sellPrice = Math.floor(car.cost * 0.85);
    user.balance += sellPrice;
    user.transport.car = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты продал машину "${car.name}" за ${sellPrice.toLocaleString()}$`);
});

bot.onText(/продать питомца/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.misc.pet) return bot.sendMessage(userId, '❌ У тебя нет питомца');
    
    const pet = pets.find(p => p.id === user.misc.pet);
    const sellPrice = Math.floor(pet.cost * 0.85);
    user.balance += sellPrice;
    user.misc.pet = 0;
    user.pet.lvl = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты продал питомца "${pet.name}" за ${sellPrice.toLocaleString()}$`);
});

bot.onText(/продать бизнес/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.business) return bot.sendMessage(userId, '❌ У тебя нет бизнеса');
    
    const biz = businesses.find(b => b.id === user.business);
    const sellPrice = Math.floor(biz.cost * 0.85);
    user.balance += sellPrice;
    user.business = 0;
    user.bizlvl = 0;
    user.biz = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты продал бизнес "${biz.name}" за ${sellPrice.toLocaleString()}$`);
});

bot.onText(/продать ферму/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (!user.misc.farm) return bot.sendMessage(userId, '❌ У тебя нет ферм');
    
    const farm = farms.find(f => f.id === user.misc.farm);
    const sellPrice = Math.floor(farm.cost * 0.85) * user.farms;
    user.balance += sellPrice;
    user.misc.farm = 0;
    user.farms = 0;
    user.farm_btc = 0;
    saveUsers();
    
    bot.sendMessage(userId, `✅ Ты продал фермы за ${sellPrice.toLocaleString()}$`);
});

// СМЕНА НИКА
bot.onText(/ник (.+)/i, async (msg, match) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    let newNick = match[1].trim();
    if (newNick.length > 16) return bot.sendMessage(userId, '❌ Ник не может быть длиннее 16 символов');
    
    user.tag = newNick;
    saveUsers();
    bot.sendMessage(userId, `✅ Твой ник изменён на "${newNick}"`);
});

// АДМИН КОМАНДЫ
bot.onText(/выдать (\d+) (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    if (userId != ADMIN_ID) return;
    
    const targetUid = parseInt(match[1]);
    const amount = parseInt(match[2]);
    
    const target = users.find(u => u.uid === targetUid);
    if (!target) return bot.sendMessage(userId, '❌ Игрок не найден');
    
    target.balance += amount;
    saveUsers();
    bot.sendMessage(userId, `✅ Выдано ${amount.toLocaleString()}$ игроку ${target.tag}`);
    bot.sendMessage(target.id, `📩 Администратор выдал тебе ${amount.toLocaleString()}$`);
});

bot.onText(/бан (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    if (userId != ADMIN_ID) return;
    
    const targetUid = parseInt(match[1]);
    const target = users.find(u => u.uid === targetUid);
    if (!target) return bot.sendMessage(userId, '❌ Игрок не найден');
    
    target.ban = true;
    saveUsers();
    bot.sendMessage(userId, `✅ Игрок ${target.tag} забанен`);
    bot.sendMessage(target.id, `⛔ Твой аккаунт заблокирован!`);
});

bot.onText(/разбан (\d+)/i, async (msg, match) => {
    const userId = msg.from.id;
    if (userId != ADMIN_ID) return;
    
    const targetUid = parseInt(match[1]);
    const target = users.find(u => u.uid === targetUid);
    if (!target) return bot.sendMessage(userId, '❌ Игрок не найден');
    
    target.ban = false;
    saveUsers();
    bot.sendMessage(userId, `✅ Игрок ${target.tag} разбанен`);
    bot.sendMessage(target.id, `✅ Твой аккаунт разблокирован!`);
});

// ПРОДАЖА РЕСУРСОВ (из оригинального бота)
bot.onText(/продать железо/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (user.zhelezo <= 0) return bot.sendMessage(userId, '❌ У тебя нет железа');
    
    const amount = user.zhelezo * 15000;
    user.balance += amount;
    user.zhelezo = 0;
    saveUsers();
    bot.sendMessage(userId, `✅ Ты продал железо за ${amount.toLocaleString()}$`);
});

bot.onText(/продать золото/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (user.zoloto <= 0) return bot.sendMessage(userId, '❌ У тебя нет золота');
    
    const amount = user.zoloto * 50000;
    user.balance += amount;
    user.zoloto = 0;
    saveUsers();
    bot.sendMessage(userId, `✅ Ты продал золото за ${amount.toLocaleString()}$`);
});

bot.onText(/продать алмазы/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    if (user.almaz <= 0) return bot.sendMessage(userId, '❌ У тебя нет алмазов');
    
    const amount = user.almaz * 100000;
    user.balance += amount;
    user.almaz = 0;
    saveUsers();
    bot.sendMessage(userId, `✅ Ты продал алмазы за ${amount.toLocaleString()}$`);
});

// ПОХОД (команда из оригинального бота)
bot.onText(/поход/i, async (msg) => {
    const userId = msg.from.id;
    let user = getUser(userId);
    if (!user) return;
    
    if (user.timers.poxod2) return bot.sendMessage(userId, '⏳ Ты уже был в походе сегодня!');
    
    const prizes = [
        { text: '50.000$', add: () => user.balance += 50000 },
        { text: '1.000₿', add: () => user.btc += 1000 },
        { text: '5 рейтинга', add: () => user.rating += 5 },
        { text: '1 рейтинг', add: () => user.rating += 1 },
        { text: '10 рейтинга', add: () => user.rating += 10 },
        { text: '2 рейтинга', add: () => user.rating += 2 },
        { text: '3 рейтинга', add: () => user.rating += 3 },
        { text: '4 рейтинга', add: () => user.rating += 4 }
    ];
    
    const prize = randomPick(prizes);
    prize.add();
    user.timers.poxod2 = true;
    saveUsers();
    
    setTimeout(() => { user.timers.poxod2 = false; saveUsers(); }, 86400000);
    
    bot.sendMessage(userId, `🏕️ **ПОХОД**\n\nНаходясь в походе, ты нашёл ${prize.text}!`);
});

// АНЕКДОТ
bot.onText(/анекдот/i, async (msg) => {
    const jokes = [
        'Разговаривают два американца:\n— У этих русских не только душа другая. Они и устроены по-другому.\n— ?\n— Я сам слышал как один сказал другому — Одень ты на х@й шапку, а то уши замерзнут.',
        'Бывает, борешься за что-то, борешься, а потом в один прекрасный момент понимаешь: «А пошло оно все на х@й!» И жить становится намного проще.',
        '"А это точно поможет?", — недоверчиво спрашивала царевна Несмеяна, поднося к губам какую-то самокрутку.',
        'Если Патриарх Кирилл верит в Бога, то почему он ездит в бронированном Мерседесе под охраной ФСО?'
    ];
    bot.sendMessage(msg.from.id, `📖 АНЕКДОТ\n\n${randomPick(jokes)}`);
});

// ЗАПУСК
console.log('🤖 YumaBot запущен!');
console.log('📋 Команды: /start');
