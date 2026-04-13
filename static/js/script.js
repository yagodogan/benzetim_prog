const canvas  = document.getElementById('simCanvas');
const ctx     = canvas.getContext('2d');
const W       = canvas.width;
const H       = canvas.height;


let simData        = [];   // Backend'den gelen araç kayıtları (indeksli kopyalar)
let currentSimTime = 0;
let isRunning      = false;
let visualCars     = [];   // Ekrandaki araç nesneleri
let passedCount    = 0;
let spawnIndex     = 0;    // Sonraki doğacak aracın indeksi (O(1) spawn kontrolü)
let SIM_HOURS      = 5;
let simSpeed       = 1;    // Hız çarpanı

const ROAD_Y       = H / 2 - 20;   // Yolun üst kenarı
const ROAD_H       = 46;
const JUNCTION_X   = 530;
const JUNCTION_W   = 140;
const CAR_W        = 26;
const CAR_H        = 16;
const QUEUE_GAP    = 30;            // Kuyrukta araçlar arası mesafe
const QUEUE_END_X  = JUNCTION_X - 8; // Kuyruğun bittiği X
const EXIT_X       = JUNCTION_X + JUNCTION_W + 8; // Servisten çıkış X

// ── UI Kontrolleri ──────────────────────────
document.getElementById('capSlider').addEventListener('input', e => {
    document.getElementById('capVal').textContent = e.target.value;
});

document.getElementById('speedSlider').addEventListener('input', e => {
    const labels = ['','1×','2×','3×','4×','5×','6×','7×','8×'];
    simSpeed = parseInt(e.target.value);
    document.getElementById('speedVal').textContent = labels[simSpeed] || simSpeed + '×';
});

// ── Fetch & Başlat ──────────────────────────
async function fetchSimulation() {
    const junction = document.getElementById('junctionSelect').value;
    const capacity = document.getElementById('capSlider').value;
    const btn      = document.getElementById('simBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Hesaplanıyor…';
    setStatus('loading', 'SimPy arka planda çalışıyor…');

    try {
        const res = await fetch(`/simulate?junction=${junction}&capacity=${capacity}`);
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`);
        if (!Array.isArray(data) || data.length === 0)
            throw new Error('Simülasyon veri döndürmedi. CSV verisi yeterli mi?');

        // arrive_time'a göre sırala (spawn indeksi için şart)
        simData = data.sort((a, b) => a.arrive_time - b.arrive_time);
        SIM_HOURS = Math.ceil(Math.max(...simData.map(d => d.leave_time)));

        // Animasyonu sıfırla
        currentSimTime = 0;
        visualCars     = [];
        passedCount    = 0;
        spawnIndex     = 0;
        isRunning      = true;

        updateWaitStat();
        setStatus('running', `${simData.length} araç yüklendi — animasyon oynatılıyor.`);
    } catch (err) {
        setStatus('error', err.message);
    } finally {
        btn.disabled   = false;
        btn.textContent = '▶ Yeniden Hesapla';
    }
}

// Ortalama bekleme süresini hesapla ve göster
function updateWaitStat() {
    if (!simData.length) return;
    const avgWaitHours = simData.reduce((sum, d) =>
        sum + (d.enter_time - d.arrive_time), 0) / simData.length;
    const avgWaitMin = (avgWaitHours * 60).toFixed(1);
    document.getElementById('waitVal').textContent = avgWaitMin;
}

function setStatus(type, msg) {
    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    dot.className  = 'status-dot ' + (type === 'loading' ? 'running' : type);
    text.className = 'status-text' + (type === 'error' ? ' error-text' : '');
    text.textContent = msg;
}

// ── Araç Sınıfı ─────────────────────────────
class Car {
    constructor(record) {
        this.record  = record;
        this.x       = -CAR_W - 10;  // Ekranın solundan başla
        this.y       = ROAD_Y + (ROAD_H - CAR_H) / 2 + (Math.random() * 4 - 2);
        this.state   = 'approaching'; // approaching | queued | in_junction | leaving | done
        this.counted = false;

        // Renk: kuyruk=turuncu, kavşak=mavi, geçti=yeşil (state'e göre draw'da)
        this.hue = Math.floor(Math.random() * 360);
    }

    get targetColor() {
        switch (this.state) {
            case 'queued':      return '#f39c12';
            case 'in_junction': return '#4f8ef7';
            case 'leaving':
            case 'done':        return '#2ecc71';
            default:            return `hsl(${this.hue},65%,55%)`;
        }
    }

    draw() {
        const color = this.targetColor;
        // Gövde
        ctx.fillStyle = color;
        roundRect(ctx, this.x, this.y, CAR_W, CAR_H, 3);
        ctx.fill();
        // Ön cam
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        roundRect(ctx, this.x + CAR_W - 8, this.y + 2, 6, CAR_H - 4, 2);
        ctx.fill();
        // Tekerlek
        ctx.fillStyle = '#111';
        ctx.fillRect(this.x + 3,          this.y + CAR_H - 3, 6, 3);
        ctx.fillRect(this.x + CAR_W - 9,  this.y + CAR_H - 3, 6, 3);
    }
}

// Yardımcı: yuvarlak köşeli dikdörtgen
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ── Güncelleme Döngüsü ───────────────────────
// 1 simülasyon saati = ekranda ~15 gerçek saniye (60 FPS @ hız 1×)
const TIME_STEP_PER_FRAME = 1.0 / (15 * 60); // hız=1 için

function update() {
    if (!isRunning) return;

    const dt = TIME_STEP_PER_FRAME * simSpeed;
    currentSimTime += dt;

    // İlerleme çubuğu
    const pct = Math.min(100, (currentSimTime / SIM_HOURS) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('timeVal').textContent = currentSimTime.toFixed(2);

    // Simülasyon bitti mi?
    if (currentSimTime >= SIM_HOURS && visualCars.length === 0) {
        isRunning = false;
        setStatus('done', `Simülasyon tamamlandı. ${passedCount} araç geçti.`);
        document.getElementById('progressBar').style.width = '100%';
        return;
    }

    // ── Yeni araç doğur (O(1): spawn indeksiyle)
    while (spawnIndex < simData.length &&
           currentSimTime >= simData[spawnIndex].arrive_time) {
        visualCars.push(new Car(simData[spawnIndex]));
        spawnIndex++;
    }

    // ── Araçların state ve X güncellemesi
    let queueCount = 0;
    const queued = [];

    for (const car of visualCars) {
        const r = car.record;

        if (currentSimTime >= r.leave_time) {
            car.state = 'leaving';
            car.x    += 5 * simSpeed;
        } else if (currentSimTime >= r.enter_time) {
            car.state = 'in_junction';
            // Kavşak ortasına yerleş
            const targetX = JUNCTION_X + 20 + (Math.random() * (JUNCTION_W - CAR_W - 40));
            if (car.x < targetX) car.x += 3 * simSpeed;
        } else {
            car.state = 'queued';
            queueCount++;
            queued.push(car);
        }
    }

    // Kuyruk X koordinatları: en erken gelen en ileride durur
    queued.sort((a, b) => a.record.arrive_time - b.record.arrive_time);
    queued.forEach((car, i) => {
        const targetX = QUEUE_END_X - (i * QUEUE_GAP) - CAR_W;
        // Hedef X'e doğru pürüzsüz hareket
        const diff = targetX - car.x;
        car.x += diff * 0.12 * simSpeed;
    });

    // Ekrandan çıkan araçları temizle
    visualCars = visualCars.filter(car => {
        if (car.x > W + 10) {
            if (!car.counted) { car.counted = true; passedCount++; }
            return false;
        }
        return true;
    });

    // İstatistik güncelle
    document.getElementById('queueVal').textContent  = queueCount;
    document.getElementById('passedVal').textContent = passedCount;
}

// ── Çizim ───────────────────────────────────
function draw() {
    ctx.clearRect(0, 0, W, H);

    // Arka plan
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, W, H);

    // Yol
    ctx.fillStyle = '#3a3d4a';
    ctx.fillRect(0, ROAD_Y, W, ROAD_H);

    // Orta şerit kesik çizgi
    ctx.setLineDash([22, 16]);
    ctx.strokeStyle = '#666';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0,  ROAD_Y + ROAD_H / 2);
    ctx.lineTo(W,  ROAD_Y + ROAD_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Yol kenarları
    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, ROAD_Y);              ctx.lineTo(W, ROAD_Y);
    ctx.moveTo(0, ROAD_Y + ROAD_H);    ctx.lineTo(W, ROAD_Y + ROAD_H);
    ctx.stroke();

    // Kavşak bölgesi arka planı
    ctx.fillStyle = 'rgba(79,142,247,0.10)';
    ctx.fillRect(JUNCTION_X, ROAD_Y - 2, JUNCTION_W, ROAD_H + 4);

    // Kavşak dikey çizgileri
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(JUNCTION_X,              ROAD_Y - 6);
    ctx.lineTo(JUNCTION_X,              ROAD_Y + ROAD_H + 6);
    ctx.moveTo(JUNCTION_X + JUNCTION_W, ROAD_Y - 6);
    ctx.lineTo(JUNCTION_X + JUNCTION_W, ROAD_Y + ROAD_H + 6);
    ctx.stroke();

    // Kavşak etiketi
    ctx.fillStyle = '#4f8ef7';
    ctx.font      = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('KAVŞAK BÖLGESİ', JUNCTION_X + JUNCTION_W / 2, ROAD_Y - 10);
    ctx.textAlign = 'left';

    // Araçları çiz (önce kuyruk, sonra kavşak içi, en üstte çıkış)
    const order = ['queued','approaching','in_junction','leaving'];
    const sorted = [...visualCars].sort(
        (a, b) => order.indexOf(a.state) - order.indexOf(b.state));
    sorted.forEach(car => car.draw());

    // Zaman etiketi
    if (isRunning || currentSimTime > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font      = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`t = ${currentSimTime.toFixed(2)} saat`, W - 10, ROAD_Y - 14);
        ctx.textAlign = 'left';
    }
}

// ── Ana Döngü ───────────────────────────────
function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}
loop();