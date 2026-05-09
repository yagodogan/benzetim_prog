const canvas  = document.getElementById('simCanvas');
const ctx     = canvas.getContext('2d');
const W       = canvas.width;
const H       = canvas.height;

let simData        = [];
let currentSimTime = 0;
let isRunning      = false;
let visualCars     = [];
let passedCount    = 0;
let spawnIndex     = 0;
let SIM_HOURS      = 5;
let simSpeed       = 1;

const ROAD_Y      = H / 2 - 20;
const ROAD_H      = 46;
const JUNCTION_X  = 530;
const JUNCTION_W  = 140;
const CAR_W       = 26;
const CAR_H       = 16;
const QUEUE_GAP   = 30;
const QUEUE_END_X = JUNCTION_X - 8;
const EXIT_X      = JUNCTION_X + JUNCTION_W + 8;

const JUNCTION_TYPES = {
    roundabout: {
        id: 'roundabout',
        label: 'Dönel Kavşak',
        icon: '⭕',
        description: 'Araçlar dönerek geçer, akıcı ama yavaş.',
        serviceTime: 0.08,
        speedMult: 0.75,
        color: '#e67e22',
        bgColor: 'rgba(230,126,34,0.12)',
        borderColor: '#e67e22',
        shape: 'circle',
    },
    bridge: {
        id: 'bridge',
        label: 'Köprülü Kavşak',
        icon: '🌉',
        description: 'Farklı seviyeli geçiş, kesintisiz ve hızlı akış.',
        serviceTime: 0.04,
        speedMult: 1.2,
        color: '#4f8ef7',
        bgColor: 'rgba(79,142,247,0.12)',
        borderColor: '#4f8ef7',
        shape: 'rect',
    }
};

let activeJunctionType = JUNCTION_TYPES.roundabout;

function buildJunctionSelector() {
    const container = document.getElementById('junctionTypeCards');
    container.innerHTML = '';

    Object.values(JUNCTION_TYPES).forEach(jt => {
        const card = document.createElement('div');
        card.className = 'junction-card' + (jt.id === activeJunctionType.id ? ' selected' : '');
        card.dataset.id = jt.id;
        card.innerHTML = `
        <div class="junction-card-icon" style="color:${jt.color}">${jt.icon}</div>
        <div class="junction-card-label">${jt.label}</div>
        `;
        card.addEventListener('click', () => selectJunctionType(jt.id));
        container.appendChild(card);
    });

    updateJunctionPreview();
}

function selectJunctionType(id) {
    activeJunctionType = JUNCTION_TYPES[id];
    document.querySelectorAll('.junction-card').forEach(c => {
        c.classList.toggle('selected', c.dataset.id === id);
    });
    updateJunctionPreview();
}

function updateJunctionPreview() {
    const jt = activeJunctionType;
    const preview = document.getElementById('junctionPreviewCanvas');
    const pc = preview.getContext('2d');
    const pw = preview.width;
    const ph = preview.height;

    pc.clearRect(0, 0, pw, ph);

    pc.fillStyle = '#0f1117';
    pc.fillRect(0, 0, pw, ph);

    const cx = pw / 2;
    const cy = ph / 2;

    drawJunctionPreview(pc, jt, cx, cy, pw, ph);

    document.getElementById('junctionTypeName').textContent = jt.label;
    document.getElementById('junctionTypeDesc').textContent = jt.description;
    document.getElementById('junctionServiceTime').textContent = (jt.serviceTime * 60).toFixed(1) + ' dk';
    document.getElementById('junctionSpeedMult').textContent = (jt.speedMult * 100).toFixed(0) + '%';

    document.getElementById('junctionPreviewWrap').style.borderColor = jt.color;
    document.getElementById('junctionInfoBar').style.borderLeftColor = jt.color;

    const legendDot = document.getElementById('legendJunction');
    if(legendDot) legendDot.style.background = jt.color;
}

function drawJunctionPreview(pc, jt, cx, cy, pw, ph) {
    const roadW = 28;
    const roadLen = 60;

    pc.fillStyle = '#3a3d4a';
    pc.fillRect(0, cy - roadW/2, pw, roadW);

    switch(jt.shape) {
        case 'circle':
            drawRoundaboutPreview(pc, jt, cx, cy, roadW, roadLen, pw, ph);
            break;
        case 'rect':
            drawBridgePreview(pc, jt, cx, cy, roadW, roadLen, pw, ph);
            break;
    }

    pc.fillStyle = jt.color;
    pc.font = 'bold 11px "Segoe UI", sans-serif';
    pc.textAlign = 'center';
    pc.fillText(jt.label.toUpperCase(), cx, ph - 10);
    pc.textAlign = 'left';
}

function drawRoundaboutPreview(pc, jt, cx, cy, roadW, roadLen, pw, ph) {
    const R = 36;
    const r = 16;

    pc.fillStyle = jt.bgColor;
    pc.beginPath();
    pc.arc(cx, cy, R, 0, Math.PI * 2);
    pc.fill();

    pc.strokeStyle = jt.color;
    pc.lineWidth = 2;
    pc.beginPath();
    pc.arc(cx, cy, R, 0, Math.PI * 2);
    pc.stroke();

    pc.fillStyle = '#1a2a1a';
    pc.beginPath();
    pc.arc(cx, cy, r, 0, Math.PI * 2);
    pc.fill();

    pc.strokeStyle = jt.color;
    pc.lineWidth = 1.5;
    pc.setLineDash([4, 3]);
    pc.beginPath();
    pc.arc(cx, cy, (R + r) / 2, 0, Math.PI * 2);
    pc.stroke();
    pc.setLineDash([]);

    [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx, dy]) => {
        pc.fillStyle = '#3a3d4a';
        const armW = 14;
        const from = {
            x: dx > 0 ? cx + r + 2 : dx < 0 ? cx - r - 2 - roadLen * 0.4 : cx - armW/2,
            y: dy > 0 ? cy + r + 2 : dy < 0 ? cy - r - 2 - roadLen * 0.4 : cy - armW/2,
        };
        if (dx !== 0) pc.fillRect(dx > 0 ? cx + r : cx - r - roadLen * 0.4, cy - armW/2, roadLen * 0.4, armW);
        if (dy !== 0) pc.fillRect(cx - armW/2, dy > 0 ? cy + r : cy - r - roadLen * 0.4, armW, roadLen * 0.4);
    });

        pc.strokeStyle = jt.color;
        pc.lineWidth = 1.5;
        pc.setLineDash([5, 4]);
        pc.beginPath();
        pc.arc(cx, cy, (R + r) / 2, -Math.PI / 2, Math.PI, false);
        pc.stroke();
        pc.setLineDash([]);
}

function drawBridgePreview(pc, jt, cx, cy, roadW, roadLen, pw, ph) {
    pc.fillStyle = '#3a3d4a';
    pc.fillRect(cx - roadW/2, 0, roadW, ph);

    pc.fillStyle = jt.bgColor;
    pc.fillRect(cx - roadW/2 - 4, cy - roadW/2 - 4, roadW + 8, roadW + 8);

    pc.strokeStyle = jt.color;
    pc.lineWidth = 2;
    pc.strokeRect(cx - roadW/2 - 4, cy - roadW/2 - 4, roadW + 8, roadW + 8);

    pc.setLineDash([8, 6]);
    pc.strokeStyle = '#666';
    pc.lineWidth = 1.5;
    pc.beginPath();
    pc.moveTo(cx, 0); pc.lineTo(cx, cy - roadW/2 - 4);
    pc.moveTo(cx, cy + roadW/2 + 4); pc.lineTo(cx, ph);
    pc.moveTo(0, cy); pc.lineTo(cx - roadW/2 - 4, cy);
    pc.moveTo(cx + roadW/2 + 4, cy); pc.lineTo(pw, cy);
    pc.stroke();
    pc.setLineDash([]);
}


document.getElementById('capSlider').addEventListener('input', e => {
    document.getElementById('capVal').textContent = e.target.value;
});
document.getElementById('speedSlider').addEventListener('input', e => {
    const labels = ['','1×','2×','3×','4×','5×','6×','7×','8×'];
    simSpeed = parseInt(e.target.value);
    document.getElementById('speedVal').textContent = labels[simSpeed] || simSpeed + '×';
});

async function fetchSimulation() {
    const junction = document.getElementById('junctionSelect').value;
    const capacity = document.getElementById('capSlider').value;
    const junctionType = activeJunctionType.id;
    const btn = document.getElementById('simBtn');

    btn.disabled = true;
    btn.textContent = '⏳ Hesaplanıyor…';
    setStatus('loading', 'SimPy arka planda çalışıyor…');

    try {
        const res  = await fetch(`/simulate?junction=${junction}&capacity=${capacity}&junction_type=${junctionType}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Sunucu hatası (${res.status})`);
        if (!Array.isArray(data) || data.length === 0)
            throw new Error('Simülasyon veri döndürmedi. CSV verisi yeterli mi?');

        simData    = data.sort((a, b) => a.arrive_time - b.arrive_time);
        SIM_HOURS  = Math.ceil(Math.max(...simData.map(d => d.leave_time)));

        currentSimTime = 0;
        visualCars     = [];
        passedCount    = 0;
        spawnIndex     = 0;
        isRunning      = true;

        updateWaitStat();
        setStatus('running', `${simData.length} araç yüklendi [${activeJunctionType.label}] — animasyon oynatılıyor.`);
    } catch (err) {
        setStatus('error', err.message);
    } finally {
        btn.disabled    = false;
        btn.textContent = '▶ Yeniden Hesapla';
    }
}

function updateWaitStat() {
    if (!simData.length) return;
    const avgWaitHours = simData.reduce((sum, d) => sum + (d.enter_time - d.arrive_time), 0) / simData.length;
    document.getElementById('waitVal').textContent = (avgWaitHours * 60).toFixed(1);
}

function setStatus(type, msg) {
    const dot  = document.getElementById('statusDot');
    const text = document.getElementById('statusText');
    dot.className  = 'status-dot ' + (type === 'loading' ? 'running' : type);
    text.className = 'status-text' + (type === 'error' ? ' error-text' : '');
    text.textContent = msg;
}

class Car {
    constructor(record) {
        this.record  = record;
        this.x       = -CAR_W - 10;
        this.y       = ROAD_Y + (ROAD_H - CAR_H) / 2 + (Math.random() * 4 - 2);
        this.state   = 'approaching';
        this.counted = false;
        this.hue     = Math.floor(Math.random() * 360);
    }
    get targetColor() {
        switch (this.state) {
            case 'queued':      return '#f39c12';
            case 'in_junction': return activeJunctionType.color;
            case 'leaving':
            case 'done':        return '#2ecc71';
            default:            return `hsl(${this.hue},65%,55%)`;
        }
    }
    draw() {
        const color = this.targetColor;
        ctx.fillStyle = color;
        roundRect(ctx, this.x, this.y, CAR_W, CAR_H, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        roundRect(ctx, this.x + CAR_W - 8, this.y + 2, 6, CAR_H - 4, 2);
        ctx.fill();
        ctx.fillStyle = '#111';
        ctx.fillRect(this.x + 3,         this.y + CAR_H - 3, 6, 3);
        ctx.fillRect(this.x + CAR_W - 9, this.y + CAR_H - 3, 6, 3);
    }
}

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

const TIME_STEP_PER_FRAME = 1.0 / (15 * 60);

function update() {
    if (!isRunning) return;
    const dt = TIME_STEP_PER_FRAME * simSpeed;
    currentSimTime += dt;

    const pct = Math.min(100, (currentSimTime / SIM_HOURS) * 100);
    document.getElementById('progressBar').style.width = pct + '%';
    document.getElementById('timeVal').textContent = currentSimTime.toFixed(2);

    if (currentSimTime >= SIM_HOURS && visualCars.length === 0) {
        isRunning = false;
        setStatus('done', `Simülasyon tamamlandı. ${passedCount} araç geçti.`);
        document.getElementById('progressBar').style.width = '100%';
        return;
    }

    while (spawnIndex < simData.length && currentSimTime >= simData[spawnIndex].arrive_time) {
        visualCars.push(new Car(simData[spawnIndex]));
        spawnIndex++;
    }

    let queueCount = 0;
    const queued = [];

    for (const car of visualCars) {
        const r = car.record;
        const jSpeedMult = activeJunctionType.speedMult;

        if (currentSimTime >= r.leave_time) {
            car.state = 'leaving';
            car.x    += 5 * simSpeed * jSpeedMult;
        } else if (currentSimTime >= r.enter_time) {
            car.state = 'in_junction';
            const targetX = JUNCTION_X + 20 + (Math.random() * (JUNCTION_W - CAR_W - 40));
            if (car.x < targetX) car.x += 3 * simSpeed * jSpeedMult;
        } else {
            car.state = 'queued';
            queueCount++;
            queued.push(car);
        }
    }

    queued.sort((a, b) => a.record.arrive_time - b.record.arrive_time);
    queued.forEach((car, i) => {
        const targetX = QUEUE_END_X - (i * QUEUE_GAP) - CAR_W;
        const diff    = targetX - car.x;
        car.x        += diff * 0.12 * simSpeed;
    });

    visualCars = visualCars.filter(car => {
        if (car.x > W + 10) {
            if (!car.counted) { car.counted = true; passedCount++; }
            return false;
        }
        return true;
    });

    document.getElementById('queueVal').textContent  = queueCount;
    document.getElementById('passedVal').textContent = passedCount;
}

function draw() {
    ctx.clearRect(0, 0, W, H);

    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = '#3a3d4a';
    ctx.fillRect(0, ROAD_Y, W, ROAD_H);

    ctx.setLineDash([22, 16]);
    ctx.strokeStyle = '#666';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, ROAD_Y + ROAD_H / 2);
    ctx.lineTo(W, ROAD_Y + ROAD_H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.moveTo(0, ROAD_Y);           ctx.lineTo(W, ROAD_Y);
    ctx.moveTo(0, ROAD_Y + ROAD_H); ctx.lineTo(W, ROAD_Y + ROAD_H);
    ctx.stroke();

    // Kavşak türüne göre bölge çizimi
    drawJunctionZone();

    const order  = ['queued','approaching','in_junction','leaving'];
    const sorted = [...visualCars].sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state));
    sorted.forEach(car => car.draw());

    if (isRunning || currentSimTime > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.font      = 'bold 13px "Segoe UI", sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(`t = ${currentSimTime.toFixed(2)} saat`, W - 10, ROAD_Y - 14);
        ctx.textAlign = 'left';
    }
}

function drawJunctionZone() {
    const jt = activeJunctionType;
    const jcx = JUNCTION_X + JUNCTION_W / 2;
    const jcy = ROAD_Y + ROAD_H / 2;

    switch (jt.shape) {
        case 'circle':
            // Dönel kavşak: daire
            const R = ROAD_H / 2 + 10;
            ctx.fillStyle = jt.bgColor;
            ctx.beginPath();
            ctx.arc(jcx, jcy, R, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = jt.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.arc(jcx, jcy, R, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = '#1a2210';
            ctx.beginPath();
            ctx.arc(jcx, jcy, R - 18, 0, Math.PI * 2);
            ctx.fill();

            ctx.strokeStyle = jt.color;
            ctx.lineWidth   = 1;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(jcx, jcy, R - 9, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            break;

        case 'rect':
            ctx.fillStyle = jt.bgColor;
            ctx.fillRect(JUNCTION_X, ROAD_Y - 2, JUNCTION_W, ROAD_H + 4);

            ctx.strokeStyle = jt.color;
            ctx.lineWidth   = 2;
            ctx.beginPath();
            ctx.moveTo(JUNCTION_X,              ROAD_Y - 6);
            ctx.lineTo(JUNCTION_X,              ROAD_Y + ROAD_H + 6);
            ctx.moveTo(JUNCTION_X + JUNCTION_W, ROAD_Y - 6);
            ctx.lineTo(JUNCTION_X + JUNCTION_W, ROAD_Y + ROAD_H + 6);
            ctx.stroke();
            break;
    }

    ctx.fillStyle = jt.color;
    ctx.font      = 'bold 11px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(jt.label.toUpperCase(), jcx, ROAD_Y - 12);
    ctx.textAlign = 'left';
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

buildJunctionSelector();
loop();
