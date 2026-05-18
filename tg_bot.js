const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');

const token = '8635475470:AAFbgm_XpPDoWJUTUG-V7QR1EB9YhR1ev8g';
const bot = new TelegramBot(token, { polling: true });

const ADMIN_IDS = [5005387093];

const USERS_FILE = path.join(__dirname, 'database', 'users.json');
const SETTINGS_FILE = path.join(__dirname, 'database', 'settings.json');

if (!fs.existsSync(path.join(__dirname, 'database'))) {
    fs.mkdirSync(path.join(__dirname, 'database'));
}

let users = [];
try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    users = JSON.parse(data);
    console.log(`✅ Загружено ${users.length} игроков`);
} catch(e) {
    console.log('📁 Создан новый файл users.json');
    fs.writeFileSync(USERS_FILE, JSON.stringify([], null, '\t'));
}

let config = {
    ownerid: "5005387093",
    promolimit: 0,
    promotip: "balance",
    promovalue: 1000
};
try {
    const cfg = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
    config = cfg;
} catch(e) {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(config, null, '\t'));
}

function saveUsers() {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, '\t'));
    console.log(`💾 Сохранено ${users.length} игроков`);
}
function saveConfig() { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(config, null, '\t')); }

const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200);
    res.end('YumaBot is running!');
});
const PORT = process.env.PORT || 10000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Health check server running on port ${PORT}`);
});

function formatNumber(num) {
    if (num >= 1e12) return (num / 1e12).toFixed(1) + 'трлн';
    if (num >= 1e9) return (num / 1e9).toFixed(1) + 'млрд';
    if (num >= 1e6) return (num / 1e6).toFixed(1) + 'млн';
    if (num >= 1e3) return (num / 1e3).toFixed(1) + 'тыс';
    return num.toString();
}
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomPick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function isAdmin(userId) { return ADMIN_IDS.includes(userId); }

const cars = [
    { name: 'Самокат', cost: 500, id: 1 }, { name: 'Велосипед', cost: 2500, id: 2 },
    { name: 'Гироскутер', cost: 5000, id: 3 }, { name: 'Сегвей', cost: 7500, id: 4 },
    { name: 'Мопед', cost: 25000, id: 5 }, { name: 'Мотоцикл', cost: 50000, id: 6 },
    { name: 'ВАЗ 2109', cost: 75000, id: 7 }, { name: 'Квадроцикл', cost: 80000, id: 8 },
    { name: 'Багги', cost: 135000, id: 9 }, { name: 'Вездеход', cost: 200000, id: 10 },
    { name: 'Лада Xray', cost: 350000, id: 11 }, { name: 'Audi Q7', cost: 750000, id: 12 },
    { name: 'BMW X6', cost: 1000000, id: 13 }, { name: 'Toyota FT-HS', cost: 1750000, id: 14 },
    { name: 'BMW Z4 M', cost: 2500000, id: 15 }, { name: 'Subaru WRX STI', cost: 2750000, id: 16 },
    { name: 'Lamborghini Veneno', cost: 3000000, id: 17 }, { name: 'Tesla Roadster', cost: 4500000, id: 18 },
    { name: 'Yamaha YZF R6', cost: 5000000, id: 19 }, { name: 'Bugatti Chiron', cost: 6500000, id: 20 },
    { name: 'Thrust SSC', cost: 35000000, id: 21 }, { name: 'Ferrari LaFerrari', cost: 39000000, id: 22 },
    { name: 'Koenigsegg Regera', cost: 50000000, id: 23 }, { name: 'Tesla Semi', cost: 75000000, id: 24 },
    { name: 'Venom GT', cost: 125000000, id: 25 }, { name: 'Rolls-Royce', cost: 200000000, id: 26 }
];
const yachts = [
    { name: 'Ванна', cost: 10000, id: 1 }, { name: 'Nauticat 331', cost: 10000000, id: 2 },
    { name: 'Nordhavn 56 MS', cost: 15000000, id: 3 }, { name: 'Princess 60', cost: 25000000, id: 4 },
    { name: 'Azimut 70', cost: 35000000, id: 5 }, { name: 'Dominator 40M', cost: 50000000, id: 6 },
    { name: 'Moonen 124', cost: 60000000, id: 7 }, { name: 'Wider 150', cost: 65000000, id: 8 },
    { name: 'Palmer Johnson 42M SuperSport', cost: 80000000, id: 9 }, { name: 'Wider 165', cost: 85000000, id: 10 },
    { name: 'Eclipse', cost: 150000000, id: 11 }, { name: 'Dubai', cost: 300000000, id: 12 },
    { name: 'Streets of Monaco', cost: 750000000, id: 13 }
];
const airplanes = [
    { name: 'Параплан', cost: 100000, id: 1 }, { name: 'АН-2', cost: 350000, id: 2 },
    { name: 'Cessna-172E', cost: 700000, id: 3 }, { name: 'Supermarine Spitfire', cost: 1000000, id: 4 },
    { name: 'BRM NG-5', cost: 1400000, id: 5 }, { name: 'Cessna T210', cost: 2600000, id: 6 },
    { name: 'Beechcraft 1900D', cost: 5500000, id: 7 }, { name: 'Cessna 550', cost: 8000000, id: 8 },
    { name: 'Hawker 4000', cost: 22400000, id: 9 }, { name: 'Learjet 31', cost: 45000000, id: 10 },
    { name: 'Airbus A318', cost: 85000000, id: 11 }, { name: 'F-35A', cost: 160000000, id: 12 },
    { name: 'Boeing 747-430 Custom', cost: 225000000, id: 13 }, { name: 'C-17A Globemaster III', cost: 350000000, id: 14 },
    { name: 'F-22 Raptor', cost: 400000000, id: 15 }, { name: 'Airbus 380 Custom', cost: 600000000, id: 16 },
    { name: 'B-2 Spirit Stealth Bomber', cost: 1359000000, id: 17 }
];
const helicopters = [
    { name: 'Шарик с пропеллером', cost: 2, id: 1 }, { name: 'RotorWay Exec 162F', cost: 300000, id: 2 },
    { name: 'Robinson R44', cost: 450000, id: 3 }, { name: 'Hiller UH-12C', cost: 1300000, id: 4 },
    { name: 'AW119 Koala', cost: 2500000, id: 5 }, { name: 'MBB BK 117', cost: 4000000, id: 6 },
    { name: 'Eurocopter EC130', cost: 7500000, id: 7 }, { name: 'Leonardo AW109 Power', cost: 10000000, id: 8 },
    { name: 'Sikorsky S-76', cost: 15000000, id: 9 }, { name: 'Bell 429WLG', cost: 19000000, id: 10 },
    { name: 'NHI NH90', cost: 35000000, id: 11 }, { name: 'Kazan Mi-35M', cost: 60000000, id: 12 },
    { name: 'Bell V-22 Osprey', cost: 135000000, id: 13 }
];
const homes = [
    { name: 'Коробка из-под холодильника', cost: 250, id: 1 }, { name: 'Подвал', cost: 3000, id: 2 },
    { name: 'Палатка', cost: 3500, id: 3 }, { name: 'Домик на дереве', cost: 5000, id: 4 },
    { name: 'Полуразрушенный дом', cost: 10000, id: 5 }, { name: 'Дом в лесу', cost: 25000, id: 6 },
    { name: 'Деревянный дом', cost: 37500, id: 7 }, { name: 'Дача', cost: 125000, id: 8 },
    { name: 'Кирпичный дом', cost: 80000, id: 9 }, { name: 'Коттедж', cost: 450000, id: 10 },
    { name: 'Особняк', cost: 1250000, id: 11 }, { name: 'Дом на Рублёвке', cost: 5000000, id: 12 },
    { name: 'Личный небоскрёб', cost: 7000000, id: 13 }, { name: 'Остров с особняком', cost: 12500000, id: 14 },
    { name: 'Белый дом', cost: 20000000, id: 15 }
];
const apartments = [
    { name: 'Чердак', cost: 15000, id: 1 }, { name: 'Квартира в общежитии', cost: 55000, id: 2 },
    { name: 'Однокомнатная квартира', cost: 175000, id: 3 }, { name: 'Двухкомнатная квартира', cost: 260000, id: 4 },
    { name: 'Четырехкомнатная квартира', cost: 500000, id: 5 }, { name: 'Квартира в центре Москвы', cost: 1600000, id: 6 },
    { name: 'Двухуровневая квартира', cost: 4000000, id: 7 }, { name: 'Квартира с Евроремонтом', cost: 6000000, id: 8 }
];
const phones = [
    { name: 'Nokia 108', cost: 250, id: 1 }, { name: 'Nokia 3310 (2017)', cost: 500, id: 2 },
    { name: 'ASUS ZenFone 4', cost: 2000, id: 3 }, { name: 'BQ Aquaris X', cost: 10000, id: 4 },
    { name: 'Sony Xperia XA', cost: 15000, id: 5 }, { name: 'Samsung Galaxy S8', cost: 30000, id: 6 },
    { name: 'Xiaomi Mi Mix', cost: 50000, id: 7 }, { name: 'Torex FS1', cost: 75000, id: 8 },
    { name: 'iPhone X', cost: 100000, id: 9 }, { name: 'Мегафон С1', cost: 250000, id: 10 }
];
const pets = [
    { name: 'Улитка', cost: 1000, upgradeCost: 2000, id: 1 }, { name: 'Лягушка', cost: 25000, upgradeCost: 50000, id: 2 },
    { name: 'Заяц', cost: 500000, upgradeCost: 1000000, id: 3 }, { name: 'Свинья', cost: 300000000, upgradeCost: 600000000, id: 4 },
    { name: 'Лиса', cost: 1250000000, upgradeCost: 2500000000, id: 5 }, { name: 'Собака', cost: 5000000000, upgradeCost: 10000000000, id: 6 },
    { name: 'Панда', cost: 30000000000, upgradeCost: 60000000000, id: 7 }, { name: 'Горилла', cost: 180000000000, upgradeCost: 360000000000, id: 8 }
];
const farms = [
    { name: '6U Nvidia', cost: 20500000, earn: 2, id: 1 }, { name: 'AntminerS9', cost: 100000000, earn: 10, id: 2 },
    { name: 'FM2018-BT200', cost: 900000000, earn: 100, id: 3 }
];
const businesses = [
    { name: 'Шаурмичная', cost: 50000, earn: 400, id: 1, icon: '🥖' }, { name: 'Ларёк', cost: 100000, earn: 700, id: 2, icon: '🏪' },
    { name: 'Ресторан', cost: 300000, earn: 2500, id: 3, icon: '🍷' }, { name: 'Магазин', cost: 500000, earn: 3800, id: 4, icon: '🏫' },
    { name: 'Завод', cost: 1500000, earn: 8000, id: 5, icon: '🏭' }, { name: 'Шахта', cost: 25000000, earn: 70000, id: 6, icon: '⛏️' },
    { name: 'Офис', cost: 80000000, earn: 220000, id: 7, icon: '🏢' }, { name: 'Разработка игр', cost: 150000000, earn: 300000, id: 8, icon: '🎮' },
    { name: 'Нефтевышка', cost: 500000000, earn: 700000, id: 9, icon: '🛢️' }, { name: 'Атомная электростанция', cost: 800000000, earn: 1000000, id: 10, icon: '⚡' },
    { name: 'Космическое агентство', cost: 50000000000, earn: 50000000, id: 11, icon: '🚀' }
];
const worksList = [
    { name: 'Дворник', requiredLevel: 1, min: 2000, max: 2500, id: 1 }, { name: 'Сантехник', requiredLevel: 3, min: 3750, max: 4000, id: 2 },
    { name: 'Электрик', requiredLevel: 5, min: 4000, max: 4500, id: 3 }, { name: 'Слесарь', requiredLevel: 8, min: 5000, max: 5500, id: 4 },
    { name: 'Юрист', requiredLevel: 10, min: 7500, max: 8000, id: 5 }, { name: 'Бухгалтер', requiredLevel: 14, min: 9000, max: 9489, id: 6 },
    { name: 'Бармен', requiredLevel: 22, min: 10000, max: 12500, id: 7 }, { name: 'Администратор', requiredLevel: 25, min: 12500, max: 13500, id: 8 },
    { name: 'Программист', requiredLevel: 49, min: 16000, max: 17500, id: 9 }
];

let btcPrice = 6000;

function getUser(userId) { return users.find(u => u.id == userId); }
function getUserByUid(uid) { return users.find(u => u.uid == uid); }

async function getOrCreateUser(userId, tag) {
    let user = getUser(userId);
    if (!user) {
        const date = new Date();
        user = {
            id: userId, uid: users.length, balance: 5000, bank: 0, btc: 0, farm_btc: 0,
            farms: 0, farmslimit: 200, energy: 10, opit: 0, biz: 0, zhelezo: 0, zoloto: 0, almaz: 0,
            bizlvl: 0, rating: 0, regDate: `${date.getDate()}.${date.getMonth()+1}.${date.getFullYear()}`,
            mention: true, ban: null, tag: tag, work: 0, business: 0, notifications: true,
            exp: 1, level: 1, referal: null, promo: false, transport: { car: 0, yacht: 0, airplane: 0, helicopter: 0 },
            realty: { home: 0, apartment: 0 }, misc: { phone: 0, farm: 0, pet: 0 },
            settings: { firstmsg: false, adm: 0, trade: true, old: false, limit: 1000000 },
            pet: { lvl: 0, poterl: false }, marriage: { partner: 0, requests: [] },
            timers: { hasWorked: false, bonus: false, poxod: false, poxod2: false, kopat: false, hack: false }
        };
        users.push(user);
        saveUsers();
        console.log(`🎉 Новый игрок: ${tag} (UID: ${user.uid})`);
    }
    return user;
}

async function sendMessage(chatId, userId, text, options = {}) {
    if (chatId < 0) {
        const user = getUser(userId);
        if (user) text = `${user.tag}, ${text}`;
        return bot.sendMessage(chatId, text, options);
    }
    return bot.sendMessage(userId, text, options);
}

async function updateBtcPrice() {
    try {
        const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const data = await response.json();
        btcPrice = Math.floor(data.bitcoin.usd);
    } catch(e) {}
}
setInterval(updateBtcPrice, 60000);
updateBtcPrice();

setInterval(() => {
    for (const user of users) {
        if (user.ban && user.ban.until && Date.now() > user.ban.until) user.ban = null;
        if (user.energy < 10) user.energy++;
        if (user.business) {
            const biz = businesses.find(b => b.id === user.business);
            if (biz) user.biz += biz.earn * (user.bizlvl + 1);
        }
        if (user.farms > 0 && user.misc.farm) {
            const farm = farms.find(f => f.id === user.misc.farm);
            if (farm) user.farm_btc += user.farms * farm.earn;
        }
    }
    saveUsers();
}, 3600000);

bot.onText(/\/start/, async (msg) => {
    const userId = msg.from.id, tag = msg.from.first_name, chatId = msg.chat.id;
    await getOrCreateUser(userId, tag);
    bot.sendMessage(chatId, `🤖 Добро пожаловать в YumaBot, ${tag}!\n📚 "помощь" - команды\n💰 Старт: 5000$`);
});

bot.onText(/^(помощь|команды|help)$/i, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    await getOrCreateUser(userId, msg.from.first_name);
    sendMessage(chatId, userId, 
        `📚 **КОМАНДЫ**\n👤 профиль/проф/я - статистика\n💰 баланс/б - деньги\n💼 работа - заработать\n🏪 бизнес/биз - бизнес\n🔋 ферма - криптоферма\n🛒 магазин - покупки\n🏆 топ\n🔑 бонус\n💽 курс\n\n🚗 машины 🛥 яхты 🛩 самолеты 🚁 вертолеты\n🏠 дома 🏢 квартиры 📱 телефоны 🐼 питомцы\n\n💸 банк [сумма]\n💸 банк снять [сумма]\n🤝 передать [id] [сумма]\n✏️ ник [ник]\n⛏ копать [железо/золото/алмазы]`);
});

bot.onText(/^(профиль|проф|я)$/i, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    const user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.ban) return sendMessage(chatId, userId, `⛔ Ты забанен до ${new Date(user.ban.until).toLocaleString()} (${user.ban.reason})`);
    let text = `🔎 **ПРОФИЛЬ**\n🆔 ID: ${user.uid}\n📛 ${user.tag}\n💰 ${user.balance.toLocaleString()}$\n🏦 ${user.bank.toLocaleString()}$\n💽 ${user.btc}₿\n👑 ${user.rating}\n🌟 ${user.level} (${user.opit}/24 опыта)\n⚡ ${user.energy}/10\n📅 ${user.regDate}\n\n🔐 **Имущество:**\n`;
    if (user.transport.car) text += `🚗 ${cars.find(c => c.id === user.transport.car)?.name}\n`;
    if (user.transport.yacht) text += `🛥 ${yachts.find(y => y.id === user.transport.yacht)?.name}\n`;
    if (user.transport.airplane) text += `🛩 ${airplanes.find(a => a.id === user.transport.airplane)?.name}\n`;
    if (user.transport.helicopter) text += `🚁 ${helicopters.find(h => h.id === user.transport.helicopter)?.name}\n`;
    if (user.realty.home) text += `🏠 ${homes.find(h => h.id === user.realty.home)?.name}\n`;
    if (user.realty.apartment) text += `🏢 ${apartments.find(a => a.id === user.realty.apartment)?.name}\n`;
    if (user.misc.phone) text += `📱 ${phones.find(p => p.id === user.misc.phone)?.name}\n`;
    if (user.misc.pet) text += `🐼 ${pets.find(p => p.id === user.misc.pet)?.name} (ур.${user.pet.lvl})\n`;
    if (user.misc.farm) text += `🔋 ${farms.find(f => f.id === user.misc.farm)?.name} x${user.farms}\n`;
    if (user.business) text += `🏪 ${businesses.find(b => b.id === user.business)?.name}\n`;
    sendMessage(chatId, userId, text);
});

bot.onText(/^(баланс|б)$/i, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    const user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.ban) return sendMessage(chatId, userId, `⛔ Ты забанен`);
    sendMessage(chatId, userId, `💰 **БАЛАНС**\n💵 ${user.balance.toLocaleString()}$\n🏦 ${user.bank.toLocaleString()}$\n💽 ${user.btc}₿`);
});

bot.onText(/^(работа|работать)$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.ban) return sendMessage(chatId, userId, `⛔ Ты забанен`);
    if (!user.work) {
        let text = `📋 **ПРОФЕССИИ**\n`;
        for (const w of worksList) text += `${user.level >= w.requiredLevel ? '✅' : '🔒'} ${w.id}. ${w.name} — ${w.min.toLocaleString()}-${w.max.toLocaleString()}$\n`;
        text += `\n"работа [номер]"`;
        return sendMessage(chatId, userId, text);
    }
    if (user.timers.hasWorked) return sendMessage(chatId, userId, `⏳ Отдых 10 минут`);
    const work = worksList.find(w => w.id === user.work);
    const earn = randomInt(work.min, work.max);
    user.balance += earn; user.opit += 1; user.timers.hasWorked = true;
    setTimeout(() => { user.timers.hasWorked = false; saveUsers(); }, 600000);
    saveUsers();
    let levelUp = '';
    if (user.opit >= 24) { user.level++; user.opit = 0; levelUp = `\n🎉 УРОВЕНЬ ${user.level}! 🎉`; saveUsers(); }
    sendMessage(chatId, userId, `✅ **РАБОТА**\n📋 ${work.name}\n💵 +${earn.toLocaleString()}$\n⭐ +1 опыта${levelUp}`);
});
bot.onText(/^работа (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, workId = parseInt(match[1]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    const work = worksList.find(w => w.id === workId);
    if (!work) return sendMessage(chatId, userId, '❌ Неверный номер');
    if (user.level < work.requiredLevel) return sendMessage(chatId, userId, `❌ Нужен ${work.requiredLevel} уровень`);
    user.work = workId; saveUsers();
    sendMessage(chatId, userId, `✅ Устроен на "${work.name}"! Теперь "работа"`);
});
bot.onText(/^(уволиться|уволится)$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.work) return sendMessage(chatId, userId, '❌ Ты не работаешь');
    user.work = 0; saveUsers();
    sendMessage(chatId, userId, `✅ Ты уволился`);
});

bot.onText(/^банк$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    const user = await getOrCreateUser(userId, msg.from.first_name);
    sendMessage(chatId, userId, `🏦 **БАНК**\n💰 На счету: ${user.bank.toLocaleString()}$\n💵 Наличные: ${user.balance.toLocaleString()}$\n\n"банк [сумма]" - положить\n"банк снять [сумма]" - снять`);
});
bot.onText(/^банк (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, amount = parseInt(match[1]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.ban) return;
    if (amount <= 0 || amount > user.balance) return sendMessage(chatId, userId, '❌ Ошибка');
    user.balance -= amount; user.bank += amount; saveUsers();
    sendMessage(chatId, userId, `✅ +${amount.toLocaleString()}$ в банк`);
});
bot.onText(/^банк снять (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, amount = parseInt(match[1]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (amount <= 0 || amount > user.bank) return sendMessage(chatId, userId, '❌ Ошибка');
    user.bank -= amount; user.balance += amount; saveUsers();
    sendMessage(chatId, userId, `✅ -${amount.toLocaleString()}$ из банка`);
});

bot.onText(/^передать (\d+) (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, targetUid = parseInt(match[1]), amount = parseInt(match[2]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (amount <= 0 || amount > user.balance) return sendMessage(chatId, userId, '❌ Ошибка');
    const target = getUserByUid(targetUid);
    if (!target) return sendMessage(chatId, userId, '❌ Игрок не найден');
    user.balance -= amount; target.balance += amount; saveUsers();
    sendMessage(chatId, userId, `✅ Переведено ${amount.toLocaleString()}$ игроку ${target.tag}`);
    if (target.notifications) bot.sendMessage(target.id, `📩 ${user.tag} перевёл тебе ${amount.toLocaleString()}$`);
});

bot.onText(/^топ$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    const sorted = [...users].sort((a,b) => b.rating - a.rating).slice(0,10);
    let text = `🏆 **ТОП-10** 🏆\n`;
    for (let i=0; i<sorted.length; i++) text += `${i+1}. ${sorted[i].tag} — 👑${sorted[i].rating} | 💰${sorted[i].balance.toLocaleString()}$\n`;
    sendMessage(chatId, userId, text);
});

bot.onText(/^бонус$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.timers.bonus) return sendMessage(chatId, userId, '⏳ Раз в 24 часа');
    const prizes = [
        {text:'50.000$',a:()=>user.balance+=50000},{text:'1.000₿',a:()=>user.btc+=1000},{text:'5 рейтинга',a:()=>user.rating+=5},
        {text:'1 рейтинг',a:()=>user.rating+=1},{text:'1.000.000$ в банк',a:()=>user.bank+=1000000},{text:'5.000.000$ в банк',a:()=>user.bank+=5000000}
    ];
    const prize = randomPick(prizes);
    prize.a(); user.timers.bonus = true; saveUsers();
    setTimeout(() => { user.timers.bonus = false; saveUsers(); }, 86400000);
    sendMessage(chatId, userId, `🎁 **БОНУС**\n✅ +${prize.text}`);
});

bot.onText(/^курс$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    sendMessage(chatId, userId, `💽 **КУРС БИТКОИНА**\n1₿ = ${btcPrice.toLocaleString()}$`);
});

bot.onText(/^магазин$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    sendMessage(chatId, userId, `🛒 **МАГАЗИН**\n🚗 машины\n🛥 яхты\n🛩 самолеты\n🚁 вертолеты\n🏠 дома\n🏢 квартиры\n📱 телефоны\n🐼 питомцы\n🔋 фермы\n\n💎 рейтинг [кол-во]\n💽 биткоин [кол-во]`);
});

function makeShopHandler(cmd, list, typeName, fieldPath) {
    bot.onText(new RegExp(`^${cmd}$`), async (msg) => {
        const userId = msg.from.id, chatId = msg.chat.id;
        let text = `🛒 **${typeName}**\n`;
        for (const item of list) text += `${item.id}. ${item.name} — ${item.cost.toLocaleString()}$\n`;
        text += `\n"купить ${cmd} [номер]"`;
        sendMessage(chatId, userId, text);
    });
    bot.onText(new RegExp(`^купить ${cmd} (\\d+)$`), async (msg, match) => {
        const userId = msg.from.id, chatId = msg.chat.id, itemId = parseInt(match[1]);
        let user = await getOrCreateUser(userId, msg.from.first_name);
        if (user.ban) return;
        const item = list.find(i => i.id === itemId);
        if (!item) return sendMessage(chatId, userId, '❌ Неверный номер');
        const keys = fieldPath.split('.');
        let current = user;
        for (let i=0; i<keys.length-1; i++) current = current[keys[i]];
        if (current[keys[keys.length-1]]) return sendMessage(chatId, userId, `❌ Уже есть! Продай сначала`);
        if (user.balance < item.cost) return sendMessage(chatId, userId, `❌ Нужно ${item.cost.toLocaleString()}$`);
        user.balance -= item.cost;
        current[keys[keys.length-1]] = item.id;
        saveUsers();
        sendMessage(chatId, userId, `✅ Куплено "${item.name}"!`);
    });
}
makeShopHandler('машины', cars, 'МАШИНЫ', 'transport.car');
makeShopHandler('яхты', yachts, 'ЯХТЫ', 'transport.yacht');
makeShopHandler('самолеты', airplanes, 'САМОЛЁТЫ', 'transport.airplane');
makeShopHandler('вертолеты', helicopters, 'ВЕРТОЛЁТЫ', 'transport.helicopter');
makeShopHandler('дома', homes, 'ДОМА', 'realty.home');
makeShopHandler('квартиры', apartments, 'КВАРТИРЫ', 'realty.apartment');
makeShopHandler('телефоны', phones, 'ТЕЛЕФОНЫ', 'misc.phone');

bot.onText(/^питомцы$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let text = `🐼 **ПИТОМЦЫ**\n`;
    for (const p of pets) text += `${p.id}. ${p.name} — ${p.cost.toLocaleString()}$\n`;
    text += `\n"купить питомца [номер]"\n"питомец поход"\n"питомец улучшить"`;
    sendMessage(chatId, userId, text);
});
bot.onText(/^купить питомца (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, petId = parseInt(match[1]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    const pet = pets.find(p => p.id === petId);
    if (!pet) return sendMessage(chatId, userId, '❌ Неверный номер');
    if (user.misc.pet) return sendMessage(chatId, userId, '❌ Уже есть питомец');
    if (user.balance < pet.cost) return sendMessage(chatId, userId, `❌ Нужно ${pet.cost.toLocaleString()}$`);
    user.balance -= pet.cost; user.misc.pet = petId; saveUsers();
    sendMessage(chatId, userId, `✅ Куплен "${pet.name}"!`);
});
bot.onText(/^питомец поход$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.misc.pet) return sendMessage(chatId, userId, '❌ Нет питомца');
    if (user.timers.poxod) return sendMessage(chatId, userId, '⏳ Питомец устал');
    const cash = randomInt(736, 2879);
    user.balance += cash; user.timers.poxod = true; saveUsers();
    setTimeout(() => { user.timers.poxod = false; saveUsers(); }, 3600000);
    sendMessage(chatId, userId, `✅ Питомец нашёл ${cash.toLocaleString()}$!`);
});
bot.onText(/^питомец улучшить$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.misc.pet) return sendMessage(chatId, userId, '❌ Нет питомца');
    const pet = pets.find(p => p.id === user.misc.pet);
    const cost = pet.upgradeCost * (user.pet.lvl + 1);
    if (user.balance < cost) return sendMessage(chatId, userId, `❌ Нужно ${cost.toLocaleString()}$`);
    user.balance -= cost; user.pet.lvl++; saveUsers();
    sendMessage(chatId, userId, `✅ Питомец улучшен до ${user.pet.lvl} уровня!`);
});

bot.onText(/^фермы$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let text = `🔋 **ФЕРМЫ**\n`;
    for (const f of farms) text += `${f.id}. ${f.name} — ${f.cost.toLocaleString()}$ (${f.earn}₿/час)\n`;
    text += `\n"купить ферму [номер] [кол-во]"`;
    sendMessage(chatId, userId, text);
});
bot.onText(/^купить ферму (\d+)(?:\s+(\d+))?$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, farmId = parseInt(match[1]), amount = match[2] ? parseInt(match[2]) : 1;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    const farm = farms.find(f => f.id === farmId);
    if (!farm) return sendMessage(chatId, userId, '❌ Неверный номер');
    const total = farm.cost * amount;
    if (user.balance < total) return sendMessage(chatId, userId, `❌ Нужно ${total.toLocaleString()}$`);
    user.balance -= total;
    if (user.misc.farm !== farmId) user.misc.farm = farmId;
    user.farms += amount;
    saveUsers();
    sendMessage(chatId, userId, `✅ Куплено ${amount} шт. ${farm.name}!`);
});
bot.onText(/^ферма$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.misc.farm) return sendMessage(chatId, userId, '🔋 Нет ферм. "фермы" - купить');
    const farm = farms.find(f => f.id === user.misc.farm);
    sendMessage(chatId, userId, `🔋 **${farm.name}**\n📊 Кол-во: ${user.farms}\n💹 Доход: ${user.farms * farm.earn}₿/час\n💽 На счету: ${user.farm_btc}₿\n\n"ферма собрать"`);
});
bot.onText(/^ферма собрать$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.misc.farm || user.farm_btc <= 0) return sendMessage(chatId, userId, '❌ Нет BTC');
    const btc = user.farm_btc;
    user.btc += btc; user.farm_btc = 0; saveUsers();
    sendMessage(chatId, userId, `✅ Собрано ${btc}₿!`);
});

bot.onText(/^(бизнес|биз|бизнесы)$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.business) {
        let text = `🏪 **БИЗНЕСЫ**\n`;
        for (const b of businesses) text += `${b.id}. ${b.icon} ${b.name} — ${b.cost.toLocaleString()}$ (${b.earn.toLocaleString()}$/час)\n`;
        text += `\n"купить бизнес [номер]"`;
        return sendMessage(chatId, userId, text);
    }
    const biz = businesses.find(b => b.id === user.business);
    sendMessage(chatId, userId, `🏪 **${biz.icon} ${biz.name}**\n💰 Прибыль: ${biz.earn * (user.bizlvl+1).toLocaleString()}$/час\n💳 На счету: ${user.biz.toLocaleString()}$\n🌟 Уровень: ${user.bizlvl}\n\n"бизнес снять"\n"бизнес улучшить"`);
});
bot.onText(/^купить бизнес (\d+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, bizId = parseInt(match[1]);
    let user = await getOrCreateUser(userId, msg.from.first_name);
    const biz = businesses.find(b => b.id === bizId);
    if (!biz) return sendMessage(chatId, userId, '❌ Неверный номер');
    if (user.business) return sendMessage(chatId, userId, '❌ Уже есть бизнес');
    if (user.balance < biz.cost) return sendMessage(chatId, userId, `❌ Нужно ${biz.cost.toLocaleString()}$`);
    user.balance -= biz.cost; user.business = bizId; saveUsers();
    sendMessage(chatId, userId, `✅ Куплен "${biz.name}"!`);
});
bot.onText(/^бизнес снять$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.business || user.biz <= 0) return sendMessage(chatId, userId, '❌ Нет денег');
    const amount = user.biz;
    user.balance += amount; user.biz = 0; saveUsers();
    sendMessage(chatId, userId, `✅ Снято ${amount.toLocaleString()}$`);
});
bot.onText(/^бизнес улучшить$/, async (msg) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (!user.business) return;
    const biz = businesses.find(b => b.id === user.business);
    const cost = biz.cost * (user.bizlvl + 1);
    if (user.balance < cost) return sendMessage(chatId, userId, `❌ Нужно ${cost.toLocaleString()}$`);
    user.balance -= cost; user.bizlvl++; saveUsers();
    sendMessage(chatId, userId, `✅ Бизнес улучшен до ${user.bizlvl} уровня!`);
});

bot.onText(/^ник (.+)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id, newNick = match[1].trim();
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (newNick.length > 16) return sendMessage(chatId, userId, '❌ Максимум 16 символов');
    user.tag = newNick; saveUsers();
    sendMessage(chatId, userId, `✅ Ник изменён на "${newNick}"`);
});

bot.onText(/^копать (железо|золото|алмазы)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    if (user.ban) return;
    const type = match[1];
    let reqExp = 0, found = 0, expGain = 0, amountField = '';
    if (type === 'железо') { reqExp = 0; found = randomInt(16, 97); expGain = 1; amountField = 'zhelezo'; }
    else if (type === 'золото') { reqExp = 300; found = randomInt(5, 35); expGain = 5; amountField = 'zoloto'; }
    else { reqExp = 3000; found = randomInt(3, 26); expGain = 10; amountField = 'almaz'; }
    if (user.opit < reqExp) return sendMessage(chatId, userId, `❌ Нужно ${reqExp} опыта`);
    if (user.energy < 1) return sendMessage(chatId, userId, '❌ Нет энергии!');
    user[amountField] += found; user.energy -= 1; user.opit += expGain; saveUsers();
    sendMessage(chatId, userId, `⛏ +${found} ${type}! (+${expGain} опыта, энергия ${user.energy}/10)`);
});

bot.onText(/^продать (машину|яхту|самолет|вертолет|дом|квартиру|телефон|питомца|бизнес|ферму|железо|золото|алмазы)$/, async (msg, match) => {
    const userId = msg.from.id, chatId = msg.chat.id;
    let user = await getOrCreateUser(userId, msg.from.first_name);
    const item = match[1];
    let price = 0; let clear = () => {};
    if (item === 'машину' && user.transport.car) { const c = cars.find(c=>c.id===user.transport.car); price = Math.floor(c.cost*0.85); clear = () => user.transport.car=0; }
    else if (item === 'яхту' && user.transport.yacht) { const y = yachts.find(y=>y.id===user.transport.yacht); price = Math.floor(y.cost*0.85); clear = () => user.transport.yacht=0; }
    else if (item === 'самолет' && user.transport.airplane) { const a = airplanes.find(a=>a.id===user.transport.airplane); price = Math.floor(a.cost*0.85); clear = () => user.transport.airplane=0; }
    else if (item === 'вертолет' && user.transport.helicopter) { const h = helicopters.find(h=>h.id===user.transport.helicopter); price = Math.floor(h.cost*0.85); clear = () => user.transport.helicopter=0; }
    else if (item === 'дом' && user.realty.home) { const h = homes.find(h=>h.id===user.realty.home); price = Math.floor(h.cost*0.85); clear = () => user.realty.home=0; }
    else if (item === 'квартиру' && user.realty.apartment) { const a = apartments.find(a=>a.id===user.realty.apartment); price = Math.floor(a.cost*0.85); clear = () => user.realty.apartment=0; }
    else if (item === 'телефон' && user.misc.phone) { const p = phones.find(p=>p.id===user.misc.phone); price = Math.floor(p.cost*0.85); clear = () => user.misc.phone=0; }
    else if (item === 'питомца' && user.misc.pet) { const p = pets.find(p=>p.id===user.misc.pet); price = Math.floor(p.cost*0.85); clear = () => { user.misc.pet=0; user.pet.lvl=0; }; }
    else if (item === 'бизнес' && user.business) { const b = businesses.find(b=>b.id===user.business); price = Math.floor(b.cost*0.85); clear = () => { user.business=0; user.bizlvl=0; user.biz=0; }; }
    else if (item === 'ферму' && user.misc.farm) { const f = farms.find(f=>f.id===user.misc.farm); price = Math.floor(f.cost*0.85) * user.farms; clear = () => { user.misc.farm=0; user.farms=0; user.farm_btc=0; }; }
    else if (item === 'железо' && user.zhelezo>0) { price = user.zhelezo*15000; clear = () => user.zhelezo=0; }
    else if (item === 'золото' && user.zoloto>0) { price = user.zoloto*50000; clear = () => user.zoloto=0; }
    else if (item === 'алмазы' && user.almaz>0) { price = user.almaz*100000; clear = () => user.almaz=0; }
    else return sendMessage(chatId, userId, `❌ Нет ${item}`);
    user.balance += price; clear(); saveUsers();
    sendMessage(chatId, userId, `✅ Продано за ${price.toLocaleString()}$`);
});

bot.onText(/^анекдот$/, async (msg) => {
    const jokes = ['Разговаривают два американца...', 'Бывает, борешься за что-то...', '— А это точно поможет?'];
    sendMessage(msg.chat.id, msg.from.id, `📖 ${randomPick(jokes)}`);
});

bot.onText(/^выдать (\d+) (\d+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    target.balance += parseInt(match[2]); saveUsers();
    bot.sendMessage(msg.chat.id, `✅ Выдано ${parseInt(match[2]).toLocaleString()}$ игроку ${target.tag}`);
    bot.sendMessage(target.id, `📩 Админ выдал ${parseInt(match[2]).toLocaleString()}$`);
});
bot.onText(/^забрать (\d+) (\d+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    const amount = parseInt(match[2]);
    if (target.balance < amount) return bot.sendMessage(msg.chat.id, '❌ У игрока меньше денег');
    target.balance -= amount; saveUsers();
    bot.sendMessage(msg.chat.id, `✅ Забрано ${amount.toLocaleString()}$ у ${target.tag}`);
    bot.sendMessage(target.id, `📩 Админ забрал ${amount.toLocaleString()}$`);
});
bot.onText(/^бан (\d+) (\d+) (.+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    const days = parseInt(match[2]);
    const reason = match[3];
    const until = Date.now() + (days * 24 * 60 * 60 * 1000);
    target.ban = { until, reason, by: msg.from.id };
    saveUsers();
    bot.sendMessage(msg.chat.id, `✅ ${target.tag} забанен на ${days} дней. Причина: ${reason}`);
    bot.sendMessage(target.id, `⛔ Ты забанен до ${new Date(until).toLocaleString()} по причине: ${reason}`);
});
bot.onText(/^разбан (\d+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    target.ban = null; saveUsers();
    bot.sendMessage(msg.chat.id, `✅ ${target.tag} разбанен`);
    bot.sendMessage(target.id, `✅ Ты разбанен`);
});
bot.onText(/^сменить id (\d+) (\d+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    const newUid = parseInt(match[2]);
    if (getUserByUid(newUid)) return bot.sendMessage(msg.chat.id, '❌ ID занят');
    target.uid = newUid; users.sort((a,b) => a.uid - b.uid); saveUsers();
    bot.sendMessage(msg.chat.id, `✅ ${target.tag} теперь ID ${newUid}`);
});
bot.onText(/^сетник (\d+) (.+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    target.tag = match[2]; saveUsers();
    bot.sendMessage(msg.chat.id, `✅ Ник изменён на ${match[2]}`);
    bot.sendMessage(target.id, `📩 Админ сменил ник на ${match[2]}`);
});
bot.onText(/^агет (\d+)$/, async (msg, match) => {
    if (!isAdmin(msg.from.id)) return;
    const target = getUserByUid(parseInt(match[1]));
    if (!target) return bot.sendMessage(msg.chat.id, '❌ Игрок не найден');
    bot.sendMessage(msg.chat.id, `👤 **${target.tag}**\n🆔 ID: ${target.uid}\n💰 Денег: ${target.balance.toLocaleString()}$\n🏦 В банке: ${target.bank.toLocaleString()}$\n👑 Рейтинг: ${target.rating}\n🌟 Уровень: ${target.level}\n⛔ Бан: ${target.ban ? `до ${new Date(target.ban.until).toLocaleString()} (${target.ban.reason})` : 'Нет'}`);
});

console.log('🤖 YumaBot запущен!');
console.log(`👑 Админы: ${ADMIN_IDS.join(', ')}`);
