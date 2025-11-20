const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const btnStartPause = document.getElementById('btnStartPause');
const btnReset = document.getElementById('btnReset');
const toggleFriction = document.getElementById('toggleFriction');
const sliderGravity = document.getElementById('sliderGravity');
const valGravity = document.getElementById('valGravity');
const overlayInstruction = document.querySelector('.overlay-instruction');

// Bars
const barTotal = document.getElementById('barTotal');
const barPotential = document.getElementById('barPotential');
const barKinetic = document.getElementById('barKinetic');
const barThermal = document.getElementById('barThermal');
const valTotal = document.getElementById('valTotal');
const valPotential = document.getElementById('valPotential');
const valKinetic = document.getElementById('valKinetic');
const valThermal = document.getElementById('valThermal');

// Physics Constants & State
let width, height;
let simRunning = false;
let dragging = false;

const state = {
    x: 0, // x position (0 is center)
    y: 0, // y position
    v: 0, // scalar velocity along the curve
    mass: 1,
    gravity: 9.8,
    friction: 0.0,
    thermalEnergy: 0,
    initialTotalEnergy: 0,
    trackScale: 0.005, // curvature of parabola y = trackScale * x^2
    pixelsPerMeter: 100 // scale for visualization
};

// Initial State
function resetSimulation() {
    state.x = -100; // Start on the left
    state.v = 0;
    state.thermalEnergy = 0;
    state.initialTotalEnergy = 0;
    state.friction = toggleFriction.checked ? parseFloat(sliderFriction.value) : 0;
    state.gravity = parseFloat(sliderGravity.value);
    updatePositionFromX();
    simRunning = false;
    btnStartPause.textContent = "Start";
    overlayInstruction.style.opacity = 1;
    draw();
    updateCharts();
}

function updatePositionFromX() {
    state.y = state.trackScale * state.x * state.x;
}

// Resize Handling
function resize() {
    width = canvas.parentElement.clientWidth;
    height = canvas.parentElement.clientHeight;
    canvas.width = width;
    canvas.height = height;
    draw();
}
window.addEventListener('resize', resize);

// Physics Loop
let lastTime = 0;
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (dt > 0.1) dt = 0.1; // Cap large steps

    if (simRunning && !dragging) {
        // Sub-stepping for stability
        const subSteps = 10;
        const subDt = dt / subSteps;
        for (let i = 0; i < subSteps; i++) {
            updatePhysics(subDt);
        }
    }

    draw();
    updateCharts();
    requestAnimationFrame(loop);
}

function updatePhysics(dt) {
    // 1. Calculate Slope
    // y' = 2 * a * x
    const slope = 2 * state.trackScale * state.x;

    // 2. Calculate Forces
    const g = state.gravity * 20;
    const sinTheta = slope / Math.sqrt(1 + slope * slope);
    let a_t = -g * sinTheta;

    // Friction
    if (state.friction > 0) {
        // Force = -mu * v
        const frictionForce = -state.friction * state.v;
        a_t += frictionForce;

        // Energy loss calculation (Work = Force * Distance)
        // dW = |F| * |dx| = |F| * |v| * dt
        // We add this to thermal energy explicitly to track it
        // Note: The main energy calculation derives thermal from conservation, 
        // but we need to ensure the physics actually loses energy.
    }

    // Update Velocity
    state.v += a_t * dt;

    // Update Position
    const cosTheta = 1 / Math.sqrt(1 + slope * slope);
    state.x += state.v * cosTheta * dt;

    updatePositionFromX();
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    const centerX = width / 2;
    const bottomY = height - 50;

    // Draw Track
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 4;
    for (let ix = -width / 2; ix < width / 2; ix += 5) {
        const iy = state.trackScale * ix * ix;
        if (bottomY - iy < 0) continue; // Don't draw off screen
        if (ix === -width / 2) ctx.moveTo(centerX + ix, bottomY - iy);
        else ctx.lineTo(centerX + ix, bottomY - iy);
    }
    ctx.stroke();

    // Draw Ball
    const ballX = centerX + state.x;
    const ballY = bottomY - state.y;

    ctx.beginPath();
    ctx.fillStyle = '#f1f5f9';
    ctx.arc(ballX, ballY, 15, 0, Math.PI * 2);
    ctx.fill();

    // Glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
    ctx.shadowBlur = 0;
}

function updateCharts() {
    // Calculate Energies
    const scaleE = 0.0005;
    const g = state.gravity * 20;

    const pe = state.mass * g * state.y * scaleE;
    const ke = 0.5 * state.mass * state.v * state.v * scaleE;

    // Total Energy Management
    if (!state.initialTotalEnergy && (pe + ke) > 0) {
        // Set initial energy when simulation starts or resets
        state.initialTotalEnergy = pe + ke;
    }

    // If dragging, reset initial energy tracking
    if (dragging) {
        state.initialTotalEnergy = pe + ke;
        state.thermalEnergy = 0;
    }

    // Calculate Thermal as the difference (Conservation Law enforced visually)
    // E_total = PE + KE + Thermal
    // Thermal = E_total_initial - (PE + KE)
    let thermal = 0;
    if (state.initialTotalEnergy) {
        thermal = state.initialTotalEnergy - (pe + ke);
        if (thermal < 0) thermal = 0; // Clamp negative thermal (integration error gain)
    }

    const total = pe + ke + thermal;

    // Avoid division by zero
    const maxE = Math.max(total, 10);

    // Update DOM
    barPotential.style.width = `${(pe / maxE) * 100}%`;
    barKinetic.style.width = `${(ke / maxE) * 100}%`;
    barThermal.style.width = `${(thermal / maxE) * 100}%`;
    barTotal.style.width = '100%';

    valPotential.textContent = Math.round(pe) + 'J';
    valKinetic.textContent = Math.round(ke) + 'J';
    valThermal.textContent = Math.round(thermal) + 'J';
    valTotal.textContent = Math.round(total) + 'J';
}

// Interaction
canvas.addEventListener('mousedown', startDrag);
canvas.addEventListener('touchstart', startDrag);
window.addEventListener('mousemove', drag);
window.addEventListener('touchmove', drag);
window.addEventListener('mouseup', endDrag);
window.addEventListener('touchend', endDrag);

function startDrag(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const mouseX = clientX - rect.left;
    const mouseY = clientY - rect.top;

    const centerX = width / 2;
    const bottomY = height - 50;
    const ballX = centerX + state.x;
    const ballY = bottomY - state.y;

    const dist = Math.hypot(mouseX - ballX, mouseY - ballY);
    if (dist < 40) {
        dragging = true;
        simRunning = false;
        btnStartPause.textContent = "Start";
        state.v = 0; // Reset velocity on grab
        overlayInstruction.style.opacity = 0;
    }
}

function drag(e) {
    if (!dragging) return;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;

    const mouseX = clientX - rect.left;
    const centerX = width / 2;

    // Set x based on mouse
    state.x = mouseX - centerX;
    updatePositionFromX();

    // Reset thermal energy when user manually moves the ball (injecting energy)
    state.thermalEnergy = 0;
    state.initialTotalEnergy = 0; // Will be reset on next updateCharts

    draw();
    updateCharts();
}

function endDrag() {
    dragging = false;
}

// Controls
btnStartPause.addEventListener('click', () => {
    simRunning = !simRunning;
    btnStartPause.textContent = simRunning ? "Pause" : "Start";
    if (simRunning) overlayInstruction.style.opacity = 0;
});

btnReset.addEventListener('click', resetSimulation);

const frictionSliderGroup = document.getElementById('frictionSliderGroup');
const sliderFriction = document.getElementById('sliderFriction');
const valFriction = document.getElementById('valFriction');

toggleFriction.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    state.friction = isChecked ? parseFloat(sliderFriction.value) : 0;
    frictionSliderGroup.style.display = isChecked ? 'flex' : 'none';
});

sliderFriction.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    state.friction = toggleFriction.checked ? val : 0;
    valFriction.textContent = val.toFixed(3);
});

sliderGravity.addEventListener('input', (e) => {
    state.gravity = parseFloat(e.target.value);
    valGravity.textContent = state.gravity + " m/s²";
});

// Init
resize();
resetSimulation();
requestAnimationFrame(loop);

