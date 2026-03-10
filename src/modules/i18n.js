const STORAGE_KEY = 'uznav-lang';
const LANGS = ['en', 'ru', 'uz'];
let currentLang = localStorage.getItem(STORAGE_KEY) || 'en';

const T = {
  en: {
    searchPlaceholder: 'Search city or address...',
    poiCafe: '☕ Cafe', poiRestaurant: '🍽️ Restaurant', poiFuel: '⛽ Gas',
    poiPharmacy: '💊 Pharmacy', poiAtm: '🏧 ATM', poiParking: '🅿️ Parking',
    poiCharging: '⚡ Charging',
    traffic: 'Traffic', speedCameras: 'Speed cameras',
    routeOptions: 'Route options',
    avoidHighways: 'Avoid highways', avoidTolls: 'Avoid tolls', avoidFerries: 'Avoid ferries',
    routeSection: 'Route', clearBtn: 'Clear',
    longPressHint: 'Long press on map to add a waypoint',
    distanceLabel: 'Distance', timeLabel: 'Est. Time', startBtn: 'Start',
    directionsTitle: 'Directions',
    etaLabel: 'ETA', leftLabel: 'Left', kmhUnit: 'km/h',
    gpsSearching: 'GPS...', gpsActive: 'GPS active', gpsNone: 'No GPS',
    gpsUnavailable: 'GPS not available',
    buildRouteFirst: 'Build a route first',
    searchingNearby: 'Searching nearby...', noneFoundNearby: 'None found nearby',
    addStopsMode: 'Tap map to add stops', editModeOff: 'Edit mode off',
    calculating: 'Calculating route...',
    arrived: 'You have arrived!', recalculating: 'Recalculating...',
    stopAdded: 'Stop added',
    cameraAhead: 'Speed camera ahead!',
    noResults: 'No results found', searchFailed: 'Search failed. Try again.',
    routeHere: 'Route Here', addStop: 'Add Stop',
    manDepart: 'Depart', manArrive: 'Arrive', manContinue: 'Continue',
    manTurn: 'Turn', manMerge: 'Merge', manRamp: 'Ramp', manExit: 'Exit',
    manFork: 'Fork', manRoundabout: 'Roundabout', manRotary: 'Rotary',
    modLeft: 'left', modRight: 'right',
    modSlightLeft: 'slight left', modSlightRight: 'slight right',
    modSharpLeft: 'sharp left', modSharpRight: 'sharp right',
    modStraight: 'straight', modUturn: 'U-turn',
  },
  ru: {
    searchPlaceholder: 'Поиск города или адреса...',
    poiCafe: '☕ Кафе', poiRestaurant: '🍽️ Ресторан', poiFuel: '⛽ АЗС',
    poiPharmacy: '💊 Аптека', poiAtm: '🏧 Банкомат', poiParking: '🅿️ Парковка',
    poiCharging: '⚡ Зарядка',
    traffic: 'Пробки', speedCameras: 'Камеры',
    routeOptions: 'Настройки маршрута',
    avoidHighways: 'Без автомагистралей', avoidTolls: 'Без платных дорог', avoidFerries: 'Без паромов',
    routeSection: 'Маршрут', clearBtn: 'Очистить',
    longPressHint: 'Удерживайте карту для добавления точки',
    distanceLabel: 'Расстояние', timeLabel: 'Время', startBtn: 'Старт',
    directionsTitle: 'Маршрут',
    etaLabel: 'Прибытие', leftLabel: 'Осталось', kmhUnit: 'км/ч',
    gpsSearching: 'GPS...', gpsActive: 'GPS активен', gpsNone: 'Нет GPS',
    gpsUnavailable: 'GPS недоступен',
    buildRouteFirst: 'Сначала постройте маршрут',
    searchingNearby: 'Поиск рядом...', noneFoundNearby: 'Ничего не найдено',
    addStopsMode: 'Нажмите карту для добавления', editModeOff: 'Редактирование выкл',
    calculating: 'Расчёт маршрута...',
    arrived: 'Вы прибыли!', recalculating: 'Перерасчёт...',
    stopAdded: 'Остановка добавлена',
    cameraAhead: 'Камера впереди!',
    noResults: 'Результатов не найдено', searchFailed: 'Ошибка поиска. Попробуйте ещё.',
    routeHere: 'Маршрут сюда', addStop: 'Добавить остановку',
    manDepart: 'Отправление', manArrive: 'Прибытие', manContinue: 'Прямо',
    manTurn: 'Поворот', manMerge: 'Перестроение', manRamp: 'Съезд', manExit: 'Выезд',
    manFork: 'Развилка', manRoundabout: 'Кольцо', manRotary: 'Кольцо',
    modLeft: 'налево', modRight: 'направо',
    modSlightLeft: 'немного налево', modSlightRight: 'немного направо',
    modSharpLeft: 'резко налево', modSharpRight: 'резко направо',
    modStraight: 'прямо', modUturn: 'разворот',
  },
  uz: {
    searchPlaceholder: 'Shahar yoki manzil qidirish...',
    poiCafe: '☕ Kafe', poiRestaurant: '🍽️ Restoran', poiFuel: '⛽ Benzin',
    poiPharmacy: '💊 Dorixona', poiAtm: '🏧 Bankomat', poiParking: '🅿️ Parkovka',
    poiCharging: '⚡ Zaryad',
    traffic: 'Tirbandlik', speedCameras: 'Kameralar',
    routeOptions: 'Marshrut sozlamalari',
    avoidHighways: "Magistralsiz", avoidTolls: "To'lovsiz yo'l", avoidFerries: 'Paromsiz',
    routeSection: 'Marshrut', clearBtn: 'Tozalash',
    longPressHint: 'Nuqta qo\'shish uchun xaritani bosib turing',
    distanceLabel: 'Masofa', timeLabel: 'Vaqt', startBtn: 'Boshlash',
    directionsTitle: 'Yo\'nalish',
    etaLabel: 'Yetib borish', leftLabel: 'Qoldi', kmhUnit: 'km/s',
    gpsSearching: 'GPS...', gpsActive: 'GPS faol', gpsNone: 'GPS yo\'q',
    gpsUnavailable: 'GPS mavjud emas',
    buildRouteFirst: 'Avval marshrut tuzing',
    searchingNearby: 'Yaqin atrofda qidirilmoqda...', noneFoundNearby: 'Yaqin atrofda topilmadi',
    addStopsMode: 'To\'xtash joyi qo\'shish uchun bosing', editModeOff: 'Tahrirlash o\'chiq',
    calculating: 'Marshrut hisoblanmoqda...',
    arrived: 'Manzilga yetib keldingiz!', recalculating: 'Qayta hisoblanmoqda...',
    stopAdded: 'To\'xtash joyi qo\'shildi',
    cameraAhead: 'Oldinda kamera!',
    noResults: 'Natijalar topilmadi', searchFailed: 'Qidiruv xatosi. Qayta urining.',
    routeHere: 'Marshrut', addStop: 'To\'xtash joyi qo\'shish',
    manDepart: 'Jo\'nash', manArrive: 'Yetib borish', manContinue: 'To\'g\'ri',
    manTurn: 'Burilish', manMerge: 'Qo\'shilish', manRamp: 'Yo\'l', manExit: 'Chiqish',
    manFork: 'Ayrilma', manRoundabout: 'Aylana yo\'l', manRotary: 'Aylana yo\'l',
    modLeft: 'chapga', modRight: 'o\'ngga',
    modSlightLeft: 'biroz chapga', modSlightRight: 'biroz o\'ngga',
    modSharpLeft: 'keskin chapga', modSharpRight: 'keskin o\'ngga',
    modStraight: 'to\'g\'ri', modUturn: 'orqaga',
  },
};

export const t = (key) => T[currentLang]?.[key] ?? T.en[key] ?? key;

export const getLang = () => currentLang;

export function cycleLang() {
  const idx = LANGS.indexOf(currentLang);
  const next = LANGS[(idx + 1) % LANGS.length];
  setLang(next);
  return next;
}

export function setLang(lang) {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
  applyTranslations();
}

export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = t(el.dataset.i18n);
    if (el.tagName === 'INPUT') {
      el.placeholder = val;
    } else {
      el.textContent = val;
    }
  });
}
