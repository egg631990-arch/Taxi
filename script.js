const start = [55.7558, 37.6173];
const map = L.map('Map', { zoomControl: false }).setView(start, 14);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const stopsLayer = L.layerGroup().addTo(map);
const poiLayer = L.layerGroup().addTo(map);
const foundLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const addressBox = document.getElementById('address');
const btnCenter = document.getElementById('btnCenter');
const mapWrap = document.getElementById('mapWrap');
const mapEl = document.getElementById('Map');
const app = document.getElementById('app');
const toastEl = document.getElementById('toast');

const orderTitle = document.getElementById('orderTitle');
const orderSub = document.getElementById('orderSub');
const orderTime = document.getElementById('orderTime');
const orderDist = document.getElementById('orderDist');
const orderPrice = document.getElementById('orderPrice');
const orderStatus = document.getElementById('orderStatus');
const orderBtn = document.getElementById('orderBtn');
const orderClose = document.getElementById('orderClose');
const cancelBtn = document.getElementById('cancelBtn');
const cancelSheet = document.getElementById('cancelSheet');

let me = null;
let meMarker = null;
let stopsVisible = true;
let follow = false;
let firstFix = true;
let lastGeo = null;
let order = null;
let busy = false;
let riding = false;
let curInfo = null;
const PRICE_PER_KM = 10000;
let reqId = 0;
let balance = Number(localStorage.getItem('balance')) || 0;
let history = JSON.parse(localStorage.getItem('history') || '[]');

const categories = [
    { re: /столов/, filters: [['amenity', 'canteen'], ['amenity', 'cafe'], ['amenity', 'fast_food']] },
    { re: /кафе|кофе/, filters: [['amenity', 'cafe']] },
    { re: /ресторан/, filters: [['amenity', 'restaurant']] },
    { re: /фастфуд|фаст фуд|быстр/, filters: [['amenity', 'fast_food']] },
    { re: /аптек/, filters: [['amenity', 'pharmacy']] },
    { re: /^супермаркет/, filters: [['shop', 'supermarket']] },
    { re: /^(магазин|продукт)/, filters: [['shop', null]] },
    { re: /банкомат/, filters: [['amenity', 'atm']] },
    { re: /^банк/, filters: [['amenity', 'bank']] },
    { re: /заправк|азс|бензин/, filters: [['amenity', 'fuel']] },
    { re: /больниц|поликлиник|клиник/, filters: [['amenity', 'hospital'], ['amenity', 'clinic']] },
    { re: /школ/, filters: [['amenity', 'school']] },
    { re: /детск.* сад|садик/, filters: [['amenity', 'kindergarten']] },
    { re: /университет|институт|вуз|колледж/, filters: [['amenity', 'university'], ['amenity', 'college']] },
    { re: /почт/, filters: [['amenity', 'post_office']] },
    { re: /кинотеатр/, filters: [['amenity', 'cinema']] },
    { re: /^парк/, filters: [['leisure', 'park']] },
    { re: /парковк|стоянк/, filters: [['amenity', 'parking']] },
    { re: /туалет/, filters: [['amenity', 'toilets']] },
    { re: /гостиниц|отел/, filters: [['tourism', 'hotel']] },
    { re: /мойк/, filters: [['amenity', 'car_wash']] },
    { re: /шиномонтаж|автосервис/, filters: [['shop', 'car_repair']] }
];

// подписи и цвета для точек на карте
const AMENITY = {
    pharmacy: ['Аптека', '#11a04e'],
    hospital: ['Больница', '#ff4d4d'],
    clinic: ['Клиника', '#ff4d4d'],
    doctors: ['Врач', '#ff4d4d'],
    dentist: ['Стоматология', '#ff4d4d'],
    school: ['Школа', '#2f80ff'],
    kindergarten: ['Детский сад', '#2f80ff'],
    college: ['Колледж', '#2f80ff'],
    university: ['Университет', '#2f80ff'],
    library: ['Библиотека', '#2f80ff'],
    post_office: ['Почта', '#2f80ff'],
    police: ['Полиция', '#2f80ff'],
    restaurant: ['Ресторан', '#ff8a00'],
    cafe: ['Кафе', '#ff8a00'],
    fast_food: ['Фастфуд', '#ff8a00'],
    canteen: ['Столовая', '#ff8a00'],
    bank: ['Банк', '#9b59ff'],
    atm: ['Банкомат', '#9b59ff'],
    fuel: ['АЗС', '#e5c100'],
    parking: ['Парковка', '#888888'],
    cinema: ['Кинотеатр', '#ff5fa2'],
    theatre: ['Театр', '#ff5fa2'],
    marketplace: ['Рынок', '#00c2c7'],
    bus_station: ['Автовокзал', '#888888'],
    car_wash: ['Автомойка', '#888888']
};

const SHOP = {
    supermarket: 'Супермаркет',
    convenience: 'Магазин у дома',
    mall: 'Торговый центр',
    department_store: 'Универмаг',
    clothes: 'Одежда',
    shoes: 'Обувь',
    bakery: 'Пекарня',
    butcher: 'Мясной',
    greengrocer: 'Овощи и фрукты',
    alcohol: 'Алкоголь',
    beverages: 'Напитки',
    chemist: 'Бытовая химия',
    cosmetics: 'Косметика',
    electronics: 'Электроника',
    mobile_phone: 'Связь',
    hardware: 'Хозтовары',
    doityourself: 'Стройматериалы',
    furniture: 'Мебель',
    florist: 'Цветы',
    kiosk: 'Киоск',
    books: 'Книги',
    jewelry: 'Ювелирный',
    sports: 'Спорттовары',
    car_repair: 'Автосервис',
    car: 'Автосалон',
    car_parts: 'Автозапчасти',
    pet: 'Зоотовары',
    optician: 'Оптика',
    hairdresser: 'Парикмахерская',
    beauty: 'Салон красоты',
    variety_store: 'Всё по одной цене',
    general: 'Универсальный',
    confectionery: 'Кондитерская',
    toys: 'Игрушки',
    gift: 'Подарки'
};

function esc(s) {
    return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function norm(s) {
    return s.toLowerCase().replace(/ё/g, 'е').trim();
}

let toastTimer = null;
function toast(text, ms) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    if (ms) toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function fmt(n) {
    return n.toLocaleString('ru-RU') + ' ₸';
}

function center() {
    if (me) return me;
    const c = map.getCenter();
    return [c.lat, c.lng];
}

function makeAddress(a) {
    const street = a.road || a.pedestrian || a.footway || a.neighbourhood || '';
    const house = a.house_number || '';
    const city = a.city || a.town || a.village || '';
    return [street + (house ? ', ' + house : ''), city].filter(Boolean).join(', ');
}

async function loadAddress(pos) {
    if (lastGeo && map.distance(lastGeo, pos) < 30) return;
    lastGeo = pos;
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&accept-language=ru&lat=' + pos[0] + '&lon=' + pos[1]);
        const data = await res.json();
        const text = data.address ? makeAddress(data.address) : '';
        addressBox.textContent = text || data.display_name || 'Адрес не найден';
    } catch (e) {
        addressBox.textContent = 'Не удалось получить адрес';
    }
}

async function loadStops() {
    const c = center();
    const query = '[out:json][timeout:20];node["amenity"="taxi"](around:3000,' + c[0] + ',' + c[1] + ');out 30;';
    try {
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query)
        });
        const data = await res.json();
        stopsLayer.clearLayers();
        data.elements.forEach(el => {
            const name = (el.tags && el.tags.name) ? el.tags.name : 'Стоянка такси';
            const icon = L.divIcon({
                className: '',
                html: '<div class="stop"><div class="pin"></div><div class="tag">' + esc(name) + '</div></div>',
                iconSize: [0, 0]
            });
            L.marker([el.lat, el.lon], { icon: icon }).addTo(stopsLayer);
        });
    } catch (e) {}
}

function onPosition(p) {
    me = [p.coords.latitude, p.coords.longitude];
    if (!meMarker) {
        meMarker = L.marker(me, {
            icon: L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [0, 0] }),
            interactive: false
        }).addTo(map);
    } else {
        meMarker.setLatLng(me);
    }
    loadAddress(me);
    if (firstFix) {
        firstFix = false;
        map.setView(me, 16);
        loadStops();
    } else if (follow) {
        map.panTo(me);
    }
}

function onError() {
    addressBox.textContent = 'Нет доступа к геолокации';
}

if (navigator.geolocation) {
    navigator.geolocation.watchPosition(onPosition, onError, {
        enableHighAccuracy: true,
        maximumAge: 2000
    });
} else {
    onError();
}

map.on('dragstart', () => {
    follow = false;
    btnCenter.classList.remove('follow');
});

document.getElementById('btnLocate').addEventListener('click', () => {
    if (!me) {
        alert('Местоположение ещё не определено');
        return;
    }
    map.setView(me, 17);
    lastGeo = null;
    loadAddress(me);
});

btnCenter.addEventListener('click', () => {
    if (!me) {
        alert('Местоположение ещё не определено');
        return;
    }
    follow = !follow;
    btnCenter.classList.toggle('follow', follow);
    if (follow) map.setView(me, 17);
});

document.getElementById('btnStops').addEventListener('click', function () {
    stopsVisible = !stopsVisible;
    if (stopsVisible) {
        map.addLayer(stopsLayer);
        this.classList.remove('off');
    } else {
        map.removeLayer(stopsLayer);
        this.classList.add('off');
    }
});

async function getRoute(from, to) {
    const url = 'https://routing.openstreetmap.de/routed-car/route/v1/driving/'
        + from[1] + ',' + from[0] + ';' + to[1] + ',' + to[0]
        + '?overview=full&geometries=geojson';
    const res = await fetch(url);
    const data = await res.json();
    return data.routes && data.routes[0] ? data.routes[0] : null;
}

function resetBtn() {
    orderBtn.style.display = 'block';
    orderBtn.textContent = 'Заказать такси';
    orderBtn.dataset.mode = 'order';
    cancelBtn.style.display = 'none';
    orderClose.style.visibility = 'visible';
    orderStatus.textContent = '';
    orderStatus.className = '';
}

async function showOrder(lat, lon, title, addr) {
    if (busy || riding) return;
    const id = ++reqId;
    const from = center();
    const to = [lat, lon];
    order = null;
    curInfo = { title: title, price: 0 };
    routeLayer.clearLayers();
    L.marker(to, {
        icon: L.divIcon({ className: '', html: '<div class="found"></div>', iconSize: [0, 0] }),
        interactive: false
    }).addTo(routeLayer);
    orderTitle.textContent = title;
    orderSub.textContent = addr || '';
    orderTime.textContent = '...';
    orderDist.textContent = '';
    orderPrice.textContent = '';
    resetBtn();
    mapWrap.classList.add('ordering');

    let r = null;
    try {
        r = await getRoute(from, to);
    } catch (e) {}
    if (id !== reqId) return;

    if (!r) {
        const d = map.distance(from, to) * 1.3;
        r = { distance: d, duration: d / (30 / 3.6), geometry: null };
    }

    const km = r.distance / 1000;
    const min = Math.max(1, Math.round(r.duration / 60));
    const price = Math.round(km * PRICE_PER_KM / 100) * 100;
    curInfo.price = price;
    order = curInfo;

    orderTime.textContent = 'В пути ' + min + ' мин';
    orderDist.textContent = km.toFixed(1) + ' км';
    orderPrice.textContent = fmt(price);

    if (r.geometry) {
        const line = L.geoJSON(r.geometry, {
            style: { color: '#ffc702', weight: 6, opacity: 0.9 }
        }).addTo(routeLayer);
        map.fitBounds(line.getBounds(), { padding: [50, 50] });
    }
}

// закрыть панель можно только пока заказ не оплачен
orderClose.addEventListener('click', () => {
    if (busy || riding) return;
    reqId++;
    order = null;
    mapWrap.classList.remove('ordering');
    routeLayer.clearLayers();
});

orderBtn.addEventListener('click', () => {
    if (!order || busy || riding) return;
    if (orderBtn.dataset.mode === 'wallet') {
        openTab('wallet');
        return;
    }
    if (balance < order.price) {
        orderStatus.textContent = 'Недостаточно средств. Баланс: ' + fmt(balance);
        orderBtn.textContent = 'Пополнить кошелёк';
        orderBtn.dataset.mode = 'wallet';
        return;
    }
    balance -= order.price;
    history.unshift({ type: 'out', title: 'Поездка: ' + order.title, amount: order.price, ts: Date.now() });
    saveWallet();
    renderWallet();
    busy = true;
    orderClose.style.visibility = 'hidden';
    orderBtn.style.display = 'none';
    orderStatus.className = '';
    orderStatus.textContent = 'Ожидаем, пока таксист примет заказ...';
    setTimeout(() => {
        orderStatus.textContent = 'Такси в пути';
        orderStatus.classList.add('go');
        cancelBtn.style.display = 'block';
        busy = false;
        riding = true;
    }, 5000);
});

// отмена активного заказа
cancelBtn.addEventListener('click', () => {
    if (!riding) return;
    cancelSheet.classList.add('show');
});

document.getElementById('cancelNo').addEventListener('click', () => {
    cancelSheet.classList.remove('show');
});

document.getElementById('cancelYes').addEventListener('click', () => {
    cancelSheet.classList.remove('show');
    if (!riding) return;
    reqId++;
    order = null;
    riding = false;
    busy = false;
    mapWrap.classList.remove('ordering');
    routeLayer.clearLayers();
    resetBtn();
    toast('Заказ отменён. Деньги не возвращаются', 3500);
});

function saveWallet() {
    localStorage.setItem('balance', balance);
    localStorage.setItem('history', JSON.stringify(history));
}

function renderWallet() {
    document.getElementById('balance').textContent = fmt(balance);
    const box = document.getElementById('history');
    if (!history.length) {
        box.innerHTML = '<div class="empty">Операций пока нет</div>';
        return;
    }
    box.innerHTML = history.map(h => {
        const d = new Date(h.ts).toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        const sign = h.type === 'in' ? '+ ' : '− ';
        return '<div class="hItem"><div><b>' + esc(h.title) + '</b><small>' + d + '</small></div><span class="' + h.type + '">' + sign + fmt(h.amount) + '</span></div>';
    }).join('');
}

function openTab(t) {
    app.classList.toggle('wallet', t === 'wallet');
    document.querySelectorAll('#icon .item').forEach(i => {
        i.classList.toggle('active', i.dataset.tab === t);
    });
    if (t === 'map') {
        setTimeout(() => map.invalidateSize(), 0);
        if (order && !riding && !busy && orderBtn.dataset.mode === 'wallet') resetBtn();
    }
}

document.querySelectorAll('#icon .item').forEach(i => {
    i.addEventListener('click', () => {
        const t = i.dataset.tab;
        if (t === 'map' || t === 'wallet') openTab(t);
    });
});

const sheet = document.getElementById('sheet');
const topupInput = document.getElementById('topupInput');

document.getElementById('topupBtn').addEventListener('click', () => {
    topupInput.value = '';
    sheet.classList.add('show');
});

document.getElementById('topupCancel').addEventListener('click', () => {
    sheet.classList.remove('show');
});

document.querySelectorAll('#chips span').forEach(c => {
    c.addEventListener('click', () => {
        topupInput.value = c.dataset.v;
    });
});

document.getElementById('topupOk').addEventListener('click', () => {
    const v = Math.floor(Number(topupInput.value));
    if (!v || v <= 0) return;
    balance += v;
    history.unshift({ type: 'in', title: 'Пополнение', amount: v, ts: Date.now() });
    saveWallet();
    renderWallet();
    sheet.classList.remove('show');
});

/* ---------- Overpass ---------- */

const OVERPASS_URLS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
];

// регистронезависимый шаблон (е = ё), чтобы "пятерочка" находила "Пятёрочка"
function ci(text) {
    return text.split('').map(ch => {
        if ('еёЕЁ'.includes(ch)) return '[еЕёЁ]';
        const lo = ch.toLowerCase();
        const up = ch.toUpperCase();
        return lo !== up ? '[' + lo + up + ']' : ch;
    }).join('');
}

function bbox(pad) {
    const b = map.getBounds().pad(pad || 0);
    return '(' + b.getSouth() + ',' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast() + ')';
}

// запрос сразу к нескольким серверам: берём первый удачный ответ
async function overpass(body, limit) {
    const query = '[out:json][timeout:25];(' + body + ');out center ' + (limit || 200) + ';';
    let finished = false;
    const ctrls = [];
    const tries = OVERPASS_URLS.map((url, i) => new Promise(r => setTimeout(r, i * 2500)).then(() => {
        if (finished) throw new Error('skip');
        const ctrl = new AbortController();
        ctrls.push(ctrl);
        const timer = setTimeout(() => ctrl.abort(), 20000);
        return fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            signal: ctrl.signal
        }).then(res => {
            if (!res.ok) throw new Error('http');
            return res.json();
        }).then(data => {
            if (!data || !data.elements) throw new Error('bad');
            return data.elements;
        }).finally(() => clearTimeout(timer));
    }));
    try {
        return await Promise.any(tries);
    } finally {
        finished = true;
        ctrls.forEach(c => c.abort());
    }
}

function describe(t) {
    if (t.amenity && AMENITY[t.amenity]) return { kind: AMENITY[t.amenity][0], color: AMENITY[t.amenity][1] };
    if (t.shop) return { kind: SHOP[t.shop] ? 'Магазин · ' + SHOP[t.shop] : 'Магазин', color: '#ffc702' };
    if (t.tourism === 'hotel') return { kind: 'Гостиница', color: '#00c2c7' };
    if (t.tourism === 'hostel') return { kind: 'Хостел', color: '#00c2c7' };
    if (t.tourism === 'museum') return { kind: 'Музей', color: '#ff5fa2' };
    if (t.tourism === 'attraction') return { kind: 'Достопримечательность', color: '#ff5fa2' };
    if (t.leisure === 'park') return { kind: 'Парк', color: '#11a04e' };
    if (t.leisure === 'stadium') return { kind: 'Стадион', color: '#11a04e' };
    if (t.leisure === 'fitness_centre') return { kind: 'Фитнес', color: '#11a04e' };
    if (t.building) return { kind: 'Здание', color: '#aaaaaa', building: true };
    return { kind: '', color: '#ff8a00' };
}

function toPlace(el, c) {
    const lat = el.lat !== undefined ? el.lat : (el.center && el.center.lat);
    const lon = el.lon !== undefined ? el.lon : (el.center && el.center.lon);
    if (lat === undefined || lon === undefined) return null;
    const t = el.tags || {};
    const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    const d = describe(t);
    const name = t.name || t['name:ru'] || t.brand || addr || 'Без названия';
    return {
        id: el.type + el.id,
        lat: lat,
        lon: lon,
        name: name,
        addr: name === addr ? '' : addr,
        kind: d.kind,
        color: d.color,
        building: !!d.building,
        d: map.distance(c, [lat, lon])
    };
}

function toPlaces(list, c) {
    return list.map(el => toPlace(el, c)).filter(Boolean).sort((a, b) => a.d - b.d);
}

/* ---------- точки на карте (аптеки, школы, магазины, здания) ---------- */

let poiPlaces = [];
let poiReq = 0;
let poiTimer = null;

function placeSub(p) {
    return [p.kind, p.addr].filter(Boolean).join(' · ');
}

function selectPlace(p) {
    if (busy || riding) return;
    showOrder(p.lat, p.lon, p.name, placeSub(p));
}

function drawPlace(layer, p, cls) {
    const html = '<div class="poi ' + cls + '" style="--c:' + p.color + '">'
        + '<div class="dot"></div>'
        + '<div class="ptag">' + (p.kind ? '<i>' + esc(p.kind) + '</i>' : '') + esc(p.name) + '</div>'
        + '</div>';
    const marker = L.marker([p.lat, p.lon], {
        icon: L.divIcon({ className: '', html: html, iconSize: [0, 0] }),
        zIndexOffset: cls.indexOf('hit') >= 0 ? 1000 : 0
    }).addTo(layer);
    marker.on('click', () => selectPlace(p));
    return marker;
}

function poiBody(bb, withBuildings) {
    let q = 'nwr["amenity"~"^(' + Object.keys(AMENITY).join('|') + ')$"]["name"]' + bb + ';'
        + 'nwr["shop"]["name"]' + bb + ';'
        + 'nwr["tourism"~"^(hotel|hostel|museum|attraction)$"]["name"]' + bb + ';'
        + 'nwr["leisure"~"^(park|stadium|fitness_centre)$"]["name"]' + bb + ';';
    if (withBuildings) q += 'way["building"]["addr:housenumber"]' + bb + ';';
    return q;
}

async function loadPois() {
    const z = map.getZoom();
    const id = ++poiReq;
    if (z < 15) {
        poiLayer.clearLayers();
        poiPlaces = [];
        return;
    }
    const mc = map.getCenter();
    const c = [mc.lat, mc.lng];
    try {
        const els = await overpass(poiBody(bbox(0), z >= 17), 400);
        if (id !== poiReq) return;
        const list = toPlaces(els, c);
        const places = list.filter(p => !p.building).slice(0, 120)
            .concat(list.filter(p => p.building).slice(0, 60));
        poiPlaces = places;
        poiLayer.clearLayers();
        places.forEach(p => drawPlace(poiLayer, p, p.building ? 'building' : ''));
    } catch (e) {}
}

function schedulePois() {
    clearTimeout(poiTimer);
    poiTimer = setTimeout(loadPois, 700);
}

function updateLabels() {
    mapEl.classList.toggle('nolabels', map.getZoom() < 16);
}

map.on('moveend', schedulePois);
map.on('zoomend', updateLabels);
updateLabels();

/* ---------- поиск ---------- */

function filterBody(f, bb) {
    return 'nwr["' + f[0] + '"' + (f[1] ? '="' + f[1] + '"' : '') + ']' + bb + ';';
}

async function searchCategory(filters, c, pad) {
    const bb = bbox(pad);
    const body = filters.map(f => filterBody(f, bb)).join('');
    return toPlaces(await overpass(body, 300), c);
}

async function searchName(text, c, pad) {
    const safe = text.replace(/[^\p{L}\p{N}\s-]/gu, '').trim();
    if (!safe) return [];
    const p = ci(safe);
    const bb = bbox(pad);
    const body = 'nwr["name"~"' + p + '"]' + bb + ';'
        + 'nwr["brand"~"' + p + '"]' + bb + ';'
        + 'nwr["name:ru"~"' + p + '"]' + bb + ';';
    return toPlaces(await overpass(body, 300), c);
}

async function searchText(text, c, pad) {
    const b = map.getBounds().pad(pad || 0);
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=20&accept-language=ru&addressdetails=1&bounded=1'
        + '&viewbox=' + b.getWest() + ',' + b.getNorth() + ',' + b.getEast() + ',' + b.getSouth()
        + '&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    if (!res.ok) throw new Error('nominatim');
    const list = await res.json();
    return list.map(i => ({
        id: 'n' + i.place_id,
        lat: +i.lat,
        lon: +i.lon,
        name: i.name || text,
        addr: i.address ? makeAddress(i.address) : '',
        kind: '',
        color: '#ff8a00',
        building: false,
        d: map.distance(c, [+i.lat, +i.lon])
    })).sort((a, b) => a.d - b.d);
}

async function findPlaces(raw) {
    const text = norm(raw);
    const c = center();
    const cat = categories.find(x => x.re.test(text));
    const pads = map.getZoom() >= 13 ? [0, 1] : [0];
    let answered = false;

    for (const pad of pads) {
        try {
            const r = cat ? await searchCategory(cat.filters, c, pad) : await searchName(text, c, pad);
            answered = true;
            if (r.length) return r;
        } catch (e) {
            break;
        }
    }

    // то, что уже показано на карте
    const local = poiPlaces.filter(p => norm(p.name + ' ' + p.kind + ' ' + p.addr).includes(text));
    if (local.length) return local;

    if (!cat) {
        for (const pad of pads) {
            try {
                const r = await searchText(text, c, pad);
                answered = true;
                if (r.length) return r;
            } catch (e) {
                break;
            }
        }
    }

    if (!answered) throw new Error('search');
    return [];
}

let searching = false;
const searchInput = document.getElementById('searchInput');

searchInput.addEventListener('input', () => {
    if (!searchInput.value.trim()) foundLayer.clearLayers();
});

document.getElementById('searchForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (searching) return;
    const raw = searchInput.value.trim();
    if (!raw) return;
    if (map.getZoom() < 12) {
        toast('Приблизьте карту, чтобы искать в видимой области', 3000);
        return;
    }
    searching = true;
    searchInput.blur();
    toast('Ищу...');
    foundLayer.clearLayers();
    try {
        const results = (await findPlaces(raw)).slice(0, 100);
        if (!results.length) {
            toast('Ничего не найдено рядом', 3000);
            return;
        }
        results.forEach(r => drawPlace(foundLayer, r, 'hit'));
        toast('Найдено: ' + results.length + '. Выберите место на карте', 3500);
        const bounds = L.latLngBounds(results.map(r => [r.lat, r.lon]));
        if (results.length === 1) {
            map.setView([results[0].lat, results[0].lon], Math.max(map.getZoom(), 16));
        } else {
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 17 });
        }
    } catch (err) {
        toast('Не удалось выполнить поиск. Проверьте интернет и повторите', 4000);
    } finally {
        searching = false;
    }
});

async function reverseAddress(pos) {
    try {
        const res = await fetch('https://nominatim.openstreetmap.org/reverse?format=json&zoom=18&addressdetails=1&accept-language=ru&lat=' + pos[0] + '&lon=' + pos[1]);
        if (!res.ok) return '';
        const data = await res.json();
        return (data.address ? makeAddress(data.address) : '') || data.display_name || '';
    } catch (e) {
        return '';
    }
}

// нажатие на любое место карты -> панель "Заказать такси"
// при активном заказе нажатия игнорируются
map.on('click', e => {
    if (busy || riding) return;
    const lat = e.latlng.lat;
    const lon = e.latlng.lng;
    showOrder(lat, lon, 'Точка на карте', 'Определяю адрес...');
    const my = reqId;
    reverseAddress([lat, lon]).then(text => {
        if (my !== reqId) return;
        if (text) {
            curInfo.title = text;
            orderTitle.textContent = text;
            orderSub.textContent = 'Выбранная точка';
        } else {
            orderSub.textContent = '';
        }
    });
});

const status = document.getElementById('Online');
const statusText = document.getElementById('statusText');

function updateStatus() {
    if (navigator.onLine) {
        status.classList.add('online');
        statusText.textContent = 'В сети';
    } else {
        status.classList.remove('online');
        statusText.textContent = 'Не в сети';
    }
}

window.addEventListener('online', updateStatus);
window.addEventListener('offline', updateStatus);
updateStatus();

renderWallet();
loadStops();

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hide');
    }, 1500);
});