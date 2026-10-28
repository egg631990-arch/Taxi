const start = [55.7558, 37.6173];
const map = L.map('Map', { zoomControl: false }).setView(start, 14);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const stopsLayer = L.layerGroup().addTo(map);
const foundLayer = L.layerGroup().addTo(map);
const routeLayer = L.layerGroup().addTo(map);
const addressBox = document.getElementById('address');
const btnCenter = document.getElementById('btnCenter');
const mapWrap = document.getElementById('mapWrap');
const app = document.getElementById('app');

const orderTitle = document.getElementById('orderTitle');
const orderSub = document.getElementById('orderSub');
const orderTime = document.getElementById('orderTime');
const orderDist = document.getElementById('orderDist');
const orderPrice = document.getElementById('orderPrice');
const orderStatus = document.getElementById('orderStatus');
const orderBtn = document.getElementById('orderBtn');
const orderClose = document.getElementById('orderClose');

let me = null;
let meMarker = null;
let stopsVisible = true;
let follow = false;
let firstFix = true;
let lastGeo = null;
let order = null;
let busy = false;
let reqId = 0;
let balance = Number(localStorage.getItem('balance')) || 0;
let history = JSON.parse(localStorage.getItem('history') || '[]');

const categories = [
    { re: /столов/, filters: [['amenity', 'canteen'], ['amenity', 'cafe'], ['amenity', 'fast_food']] },
    { re: /кафе|кофе/, filters: [['amenity', 'cafe']] },
    { re: /ресторан/, filters: [['amenity', 'restaurant']] },
    { re: /фастфуд|фаст фуд|быстр/, filters: [['amenity', 'fast_food']] },
    { re: /аптек/, filters: [['amenity', 'pharmacy']] },
    { re: /^(магазин|продукт)/, filters: [['shop', 'supermarket'], ['shop', 'convenience']] },
    { re: /^супермаркет/, filters: [['shop', 'supermarket']] },
    { re: /банкомат/, filters: [['amenity', 'atm']] },
    { re: /^банк/, filters: [['amenity', 'bank']] },
    { re: /заправк|азс|бензин/, filters: [['amenity', 'fuel']] },
    { re: /больниц|поликлиник/, filters: [['amenity', 'hospital'], ['amenity', 'clinic']] },
    { re: /парковк/, filters: [['amenity', 'parking']] },
    { re: /туалет/, filters: [['amenity', 'toilets']] },
    { re: /гостиниц|отел/, filters: [['tourism', 'hotel']] },
    { re: /мойк/, filters: [['amenity', 'car_wash']] },
    { re: /шиномонтаж|автосервис/, filters: [['shop', 'car_repair']] }
];

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
                html: '<div class="stop"><div class="pin"></div><div class="tag">' + name + '</div></div>',
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
    orderStatus.textContent = '';
    orderStatus.className = '';
}

async function showOrder(lat, lon, title, addr) {
    if (busy) return;
    const id = ++reqId;
    const from = center();
    const to = [lat, lon];
    order = null;
    routeLayer.clearLayers();
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
    const price = Math.max(800, Math.round((600 + 150 * km) / 10) * 10);
    order = { title: title, price: price };

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

orderClose.addEventListener('click', () => {
    if (busy) return;
    reqId++;
    order = null;
    mapWrap.classList.remove('ordering');
    routeLayer.clearLayers();
});

orderBtn.addEventListener('click', () => {
    if (!order) return;
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
        orderClose.style.visibility = 'visible';
        busy = false;
    }, 5000);
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
        return '<div class="hItem"><div><b>' + h.title + '</b><small>' + d + '</small></div><span class="' + h.type + '">' + sign + fmt(h.amount) + '</span></div>';
    }).join('');
}

function openTab(t) {
    app.classList.toggle('wallet', t === 'wallet');
    document.querySelectorAll('#icon .item').forEach(i => {
        i.classList.toggle('active', i.dataset.tab === t);
    });
    if (t === 'map') {
        setTimeout(() => map.invalidateSize(), 0);
        if (order && orderBtn.dataset.mode === 'wallet') resetBtn();
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

function addFound(lat, lon, title, addr) {
    const marker = L.marker([lat, lon], {
        icon: L.divIcon({ className: '', html: '<div class="found"></div>', iconSize: [0, 0] })
    }).addTo(foundLayer);
    marker.on('click', () => showOrder(lat, lon, title, addr));
    return marker;
}

function mapElements(list, c) {
    return list.map(el => {
        const lat = el.lat || el.center.lat;
        const lon = el.lon || el.center.lon;
        const t = el.tags || {};
        const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
        return {
            lat: lat,
            lon: lon,
            name: t.name || t.brand || 'Без названия',
            addr: addr,
            d: map.distance(c, [lat, lon])
        };
    }).sort((a, b) => a.d - b.d).slice(0, 15);
}

async function overpass(body) {
    const query = '[out:json][timeout:25];(' + body + ');out center 100;';
    const res = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body: 'data=' + encodeURIComponent(query)
    });
    const data = await res.json();
    return data.elements;
}

async function searchCategory(filters, c) {
    const radii = [100, 500, 1000, 3000, 10000];
    for (const r of radii) {
        const body = filters.map(f => 'nwr["' + f[0] + '"="' + f[1] + '"](around:' + r + ',' + c[0] + ',' + c[1] + ');').join('');
        const list = await overpass(body);
        if (list.length) return mapElements(list, c);
    }
    return [];
}

async function searchName(text, c) {
    const safe = text.replace(/[\\"^$.*+?()[\]{}|]/g, '\\$&');
    const radii = [100, 500, 1000, 3000, 10000];
    for (const r of radii) {
        const a = '(around:' + r + ',' + c[0] + ',' + c[1] + ')';
        const body = 'nwr["name"~"' + safe + '",i]' + a + ';nwr["brand"~"' + safe + '",i]' + a + ';nwr["name:ru"~"' + safe + '",i]' + a + ';';
        const list = await overpass(body);
        if (list.length) return mapElements(list, c);
    }
    return [];
}

async function searchText(text, c) {
    const url = 'https://nominatim.openstreetmap.org/search?format=json&limit=10&accept-language=ru&addressdetails=1&bounded=1'
        + '&viewbox=' + (c[1] - 0.15) + ',' + (c[0] + 0.1) + ',' + (c[1] + 0.15) + ',' + (c[0] - 0.1)
        + '&q=' + encodeURIComponent(text);
    const res = await fetch(url);
    const list = await res.json();
    return list.map(i => ({
        lat: +i.lat,
        lon: +i.lon,
        name: i.name || text,
        addr: i.address ? makeAddress(i.address) : '',
        d: map.distance(c, [i.lat, i.lon])
    })).sort((a, b) => a.d - b.d);
}

document.getElementById('searchForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = document.getElementById('searchInput').value.trim().toLowerCase();
    if (!text) return;
    const c = center();
    foundLayer.clearLayers();
    try {
        const cat = categories.find(x => x.re.test(text));
        let results = cat ? await searchCategory(cat.filters, c) : await searchName(text, c);
        if (!results.length && !cat) results = await searchText(text, c);
        if (!results.length) {
            alert('Ничего не найдено рядом');
            return;
        }
        const bounds = L.latLngBounds([c]);
        results.forEach(r => {
            addFound(r.lat, r.lon, r.name, r.addr);
            bounds.extend([r.lat, r.lon]);
        });
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        document.getElementById('searchInput').blur();
    } catch (err) {
        alert('Ошибка поиска');
    }
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