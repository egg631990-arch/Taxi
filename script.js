const start = [55.7558, 37.6173];
const map = L.map('Map', { zoomControl: false }).setView(start, 14);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
}).addTo(map);

const stopsLayer = L.layerGroup().addTo(map);
const foundLayer = L.layerGroup().addTo(map);
const addressBox = document.getElementById('address');
const btnCenter = document.getElementById('btnCenter');

let me = null;
let meMarker = null;
let stopsVisible = true;
let follow = false;
let firstFix = true;
let lastGeo = null;

const categories = [
    { re: /столов/, filters: [['amenity', 'canteen'], ['amenity', 'cafe'], ['amenity', 'fast_food']] },
    { re: /кафе|кофе/, filters: [['amenity', 'cafe']] },
    { re: /ресторан/, filters: [['amenity', 'restaurant']] },
    { re: /фастфуд|фаст фуд|быстр/, filters: [['amenity', 'fast_food']] },
    { re: /аптек/, filters: [['amenity', 'pharmacy']] },
    { re: /магазин|продукт/, filters: [['shop', 'supermarket'], ['shop', 'convenience']] },
    { re: /супермаркет/, filters: [['shop', 'supermarket']] },
    { re: /банкомат/, filters: [['amenity', 'atm']] },
    { re: /банк/, filters: [['amenity', 'bank']] },
    { re: /заправк|азс|бензин/, filters: [['amenity', 'fuel']] },
    { re: /больниц|поликлиник/, filters: [['amenity', 'hospital'], ['amenity', 'clinic']] },
    { re: /парковк/, filters: [['amenity', 'parking']] },
    { re: /туалет/, filters: [['amenity', 'toilets']] },
    { re: /гостиниц|отел/, filters: [['tourism', 'hotel']] },
    { re: /мойк/, filters: [['amenity', 'car_wash']] },
    { re: /шиномонтаж|автосервис/, filters: [['shop', 'car_repair']] }
];

function center() {
    if (me) return me;
    const c = map.getCenter();
    return [c.lat, c.lng];
}

function dist(m) {
    return m < 1000 ? Math.round(m) + ' м' : (m / 1000).toFixed(1) + ' км';
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

function addFound(lat, lon, title, sub, distance) {
    const marker = L.marker([lat, lon], {
        icon: L.divIcon({ className: '', html: '<div class="found"></div>', iconSize: [0, 0] })
    }).addTo(foundLayer);
    marker.bindPopup('<b>' + title + '</b><br>' + (sub ? sub + '<br>' : '') + dist(distance));
    return marker;
}

async function searchCategory(filters, c) {
    const radii = [100, 500, 1000, 3000];
    for (const r of radii) {
        const body = filters.map(f => 'nwr["' + f[0] + '"="' + f[1] + '"](around:' + r + ',' + c[0] + ',' + c[1] + ');').join('');
        const query = '[out:json][timeout:25];(' + body + ');out center 40;';
        const res = await fetch('https://overpass-api.de/api/interpreter', {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query)
        });
        const data = await res.json();
        if (data.elements.length) {
            return data.elements.map(el => {
                const lat = el.lat || el.center.lat;
                const lon = el.lon || el.center.lon;
                const t = el.tags || {};
                const addr = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
                return {
                    lat: lat,
                    lon: lon,
                    name: t.name || 'Без названия',
                    addr: addr,
                    d: map.distance(c, [lat, lon])
                };
            }).sort((a, b) => a.d - b.d).slice(0, 15);
        }
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
        const results = cat ? await searchCategory(cat.filters, c) : await searchText(text, c);
        if (!results.length) {
            alert('Ничего не найдено рядом');
            return;
        }
        const bounds = L.latLngBounds([c]);
        let first = null;
        results.forEach(r => {
            const m = addFound(r.lat, r.lon, r.name, r.addr, r.d);
            bounds.extend([r.lat, r.lon]);
            if (!first) first = m;
        });
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 17 });
        first.openPopup();
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

loadStops();

window.addEventListener('load', () => {
    setTimeout(() => {
        document.getElementById('loader').classList.add('hide');
    }, 1500);
});