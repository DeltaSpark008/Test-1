// ==========================================================================
// CORE STATE DATA & STORAGE KEYS
// ==========================================================================
const STORAGE_KEYS = {
    METRICS: 'himank_v2_metrics',
    TASKS: 'himank_v2_tasks_today',
    STREAK: 'himank_v2_streak',
    LAST_DATE: 'himank_v2_last_date',
    ARCHIVE: 'himank_v2_archives'
};

let activeCharts = {};
let metronomeInterval = null;

document.addEventListener("DOMContentLoaded", () => {
    initializeDatabase();
    checkDailyReset();
    renderCharts();
    updateXpBar();
    populateArchiveDropdown();
    setupEventListeners();
});

// ==========================================================================
// DATABASE & STORAGE CONFIGURATION
// ==========================================================================
function initializeDatabase() {
    if (!localStorage.getItem(STORAGE_KEYS.METRICS)) {
        localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify([]));
    }
    if (!localStorage.getItem(STORAGE_KEYS.TASKS)) {
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify({}));
    }
    if (!localStorage.getItem(STORAGE_KEYS.STREAK)) {
        localStorage.setItem(STORAGE_KEYS.STREAK, '0');
    }
    if (!localStorage.getItem(STORAGE_KEYS.ARCHIVE)) {
        localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify({}));
    }
}

function checkDailyReset() {
    const todayStr = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);

    if (lastDate !== todayStr) {
        // Evaluate if previous day's streak was maintained
        if (lastDate) {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            // If they skipped a whole day, clear tasks but handle streak break rules
            if (lastDate !== yesterdayStr) {
                localStorage.setItem(STORAGE_KEYS.STREAK, '0');
            }
        }
        
        // Reset interactive daily checks
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify({}));
        localStorage.setItem(STORAGE_KEYS.LAST_DATE, todayStr);
        
        // Automated Monthly Rolling Cycle Clean up
        handleMonthlyArchiveCheck(todayStr);
    }
    
    // Restore checkmark status onto items
    const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS));
    document.querySelectorAll('.task-checkbox').forEach((box, index) => {
        if (savedTasks[index]) {
            box.checked = true;
        }
    });
}

function handleMonthlyArchiveCheck(todayStr) {
    const currentMonthKey = todayStr.substring(0, 7); // "2026-07"
    const metrics = JSON.parse(localStorage.getItem(STORAGE_KEYS.METRICS));
    
    if (metrics.length === 0) return;
    
    // Check if the oldest record belongs to a previous month
    const standardFirstEntryMonth = metrics[0].date.substring(0, 7);
    
    if (standardFirstEntryMonth !== currentMonthKey) {
        let archives = JSON.parse(localStorage.getItem(STORAGE_KEYS.ARCHIVE));
        archives[standardFirstEntryMonth] = metrics;
        localStorage.setItem(STORAGE_KEYS.ARCHIVE, JSON.stringify(archives));
        
        // Wipe active ledger to start new clean graphics slate
        localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify([]));
        populateArchiveDropdown();
    }
}

// ==========================================================================
// GAMIFICATION ENGINE (XP SYSTEM)
// ==========================================================================
function updateXpBar() {
    const totalCheckboxes = document.querySelectorAll('.task-checkbox').length;
    const checkedBoxes = document.querySelectorAll('.task-checkbox:checked').length;
    
    const xpPercent = Math.round((checkedBoxes / totalCheckboxes) * 100);
    document.getElementById('xpProgress').style.width = `${xpPercent}%`;
    document.getElementById('xpPoints').innerText = `${checkedBoxes} / ${totalCheckboxes} Tasks Done`;
    
    // Dynamic Rank Badges
    let rank = "Resting";
    if (checkedBoxes <= 2) rank = "System Foggy";
    else if (checkedBoxes <= 4) rank = "Consistent Build";
    else if (checkedBoxes <= 6) rank = "Growth Phase";
    else if (checkedBoxes === totalCheckboxes) {
        rank = "Elite Execution";
        updateStreakBonus();
    }
    
    document.getElementById('rankText').innerText = `Rank: ${rank}`;
    document.getElementById('streakDays').innerHTML = `<i class="fa-solid fa-fire"></i> Streak: ${localStorage.getItem(STORAGE_KEYS.STREAK)} Days`;
}

function updateStreakBonus() {
    const lastDate = localStorage.getItem(STORAGE_KEYS.LAST_DATE);
    const todayStr = new Date().toISOString().split('T')[0];
    // Simple incremental verification if not already counted
    if (localStorage.getItem('himank_last_streak_inc') !== todayStr) {
        let streak = parseInt(localStorage.getItem(STORAGE_KEYS.STREAK)) + 1;
        localStorage.setItem(STORAGE_KEYS.STREAK, streak.toString());
        localStorage.setItem('himank_last_streak_inc', todayStr);
    }
}

// ==========================================================================
// FORM ENTRIES & DATA EXPORTER
// ==========================================================================
function submitDailyMetrics() {
    const ht = parseFloat(document.getElementById('inputHeight').value);
    const wtAM = parseFloat(document.getElementById('inputWeightAM').value);
    const wtPM = parseFloat(document.getElementById('inputWeightPM').value);
    
    if (!ht && !wtAM && !wtPM) {
        alert("Please fill in at least one metric field to log history.");
        return;
    }
    
    const todayStr = new Date().toISOString().split('T')[0];
    let metrics = JSON.parse(localStorage.getItem(STORAGE_KEYS.METRICS));
    
    // Prevent duplicated rows on identical dates; update if exists
    let existingEntry = metrics.find(m => m.date === todayStr);
    if (existingEntry) {
        if (ht) existingEntry.height = ht;
        if (wtAM) existingEntry.weightAM = wtAM;
        if (wtPM) existingEntry.weightPM = wtPM;
    } else {
        metrics.push({
            date: todayStr,
            height: ht || null,
            weightAM: wtAM || null,
            weightPM: wtPM || null
        });
    }
    
    localStorage.setItem(STORAGE_KEYS.METRICS, JSON.stringify(metrics));
    alert("Metrics successfully injected into system logs.");
    renderCharts();
}

function exportDataStringToClipboard() {
    const metrics = localStorage.getItem(STORAGE_KEYS.METRICS);
    const streak = localStorage.getItem(STORAGE_KEYS.STREAK);
    const payload = {
        exportTimestamp: new Date().toLocaleString(),
        currentStreak: streak,
        monthDataSummary: JSON.parse(metrics)
    };
    
    const outputString = JSON.stringify(payload, null, 2);
    navigator.clipboard.writeText(outputString).then(() => {
        alert("System log copied to clipboard! Paste directly to AI for progress analysis.");
    }).catch(() => {
        alert("Failed to auto-copy. Here is raw string:\n" + outputString);
    });
}

// ==========================================================================
// VISUAL GRAPH GENERATORS (CHART.JS)
// ==========================================================================
function renderCharts(datasetOverride = null) {
    const data = datasetOverride || JSON.parse(localStorage.getItem(STORAGE_KEYS.METRICS)) || [];
    
    const labels = data.map(m => m.date.substring(5)); // Clean MM-DD string
    const heights = data.map(m => m.height);
    const weightsAM = data.map(m => m.weightAM);
    const weightsPM = data.map(m => m.weightPM);
    
    // Destroy previous graphics instances to clear cache buffers
    if (activeCharts.height) activeCharts.height.destroy();
    if (activeCharts.weight) activeCharts.weight.destroy();
    
    const themeColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-blue').trim();
    const secondaryColor = getComputedStyle(document.documentElement).getPropertyValue('--accent-purple').trim();

    // Height Graph Layout config
    const ctxH = document.getElementById('heightChart').getContext('2d');
    activeCharts.height = new Chart(ctxH, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Height (cm)',
                data: heights,
                borderColor: themeColor,
                backgroundColor: 'rgba(14, 165, 233, 0.1)',
                tension: 0.2,
                spanGaps: true
            }]
        },
        options: { responsive: true, scales: { y: { beginAtZero: false } } }
    });

    // Dual Weights Tracking Layout Configuration
    const ctxW = document.getElementById('weightChart').getContext('2d');
    activeCharts.weight = new Chart(ctxW, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'AM Weight (9:00 AM)',
                    data: weightsAM,
                    borderColor: themeColor,
                    backgroundColor: 'transparent',
                    tension: 0.1,
                    spanGaps: true
                },
                {
                    label: 'PM Weight (11:00 PM)',
                    data: weightsPM,
                    borderColor: secondaryColor,
                    backgroundColor: 'transparent',
                    tension: 0.1,
                    spanGaps: true
                }
            ]
        },
        options: { responsive: true }
    });
}

function downloadChart(chartKey) {
    const chartInstance = chartKey === 'heightChart' ? activeCharts.height : activeCharts.weight;
    if (!chartInstance) return;
    
    const imageURI = chartInstance.toBase64Image();
    const anchor = document.createElement('a');
    anchor.download = `${chartKey}_snapshot.png`;
    anchor.href = imageURI;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
}

function populateArchiveDropdown() {
    const select = document.getElementById('archiveMonthSelect');
    const archives = JSON.parse(localStorage.getItem(STORAGE_KEYS.ARCHIVE)) || {};
    
    // Clear dynamic children variations beyond base index
    select.innerHTML = '<option value="">-- Current Active Slate --</option>';
    
    Object.keys(archives).forEach(monthKey => {
        const option = document.createElement('option');
        option.value = monthKey;
        option.innerText = `Log Archive: ${monthKey}`;
        select.appendChild(option);
    });
}

function loadArchivedMonth() {
    const selectedMonth = document.getElementById('archiveMonthSelect').value;
    if (!selectedMonth) {
        renderCharts(); // Default fallback load
        return;
    }
    const archives = JSON.parse(localStorage.getItem(STORAGE_KEYS.ARCHIVE));
    renderCharts(archives[selectedMonth]);
}

// ==========================================================================
// INTERACTIVE NAVIGATION & UTILITY LISTENERS
// ==========================================================================
function switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    
    // Locate triggering elements
    event.currentTarget.classList.add('active');
    document.getElementById(`${tabId}Tab`).classList.add('active');
}

function toggleWorkout(mode) {
    document.querySelectorAll('.workout-toggle-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('panelWorkoutA').classList.add('hidden');
    document.getElementById('panelWorkoutB').classList.add('hidden');
    
    if (mode === 'A') {
        document.getElementById('btnWorkoutA').classList.add('active');
        document.getElementById('panelWorkoutA').classList.remove('hidden');
    } else {
        document.getElementById('btnWorkoutB').classList.add('active');
        document.getElementById('panelWorkoutB').classList.remove('hidden');
    }
}

function startTimer(durationSeconds, displayId) {
    const display = document.getElementById(displayId);
    let remaining = durationSeconds;
    
    const interval = setInterval(() => {
        remaining--;
        display.innerText = `${remaining}s`;
        
        if (remaining <= 0) {
            clearInterval(interval);
            display.innerText = `${durationSeconds}s`;
            alert("Timer completed! Transition safely to the next set.");
        }
    }, 1000);
}

function setupEventListeners() {
    // Checkbox State Engine updates
    document.querySelectorAll('.task-checkbox').forEach((box, index) => {
        box.addEventListener('change', () => {
            const savedTasks = JSON.parse(localStorage.getItem(STORAGE_KEYS.TASKS)) || {};
            savedTasks[index] = box.checked;
            localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(savedTasks));
            updateXpBar();
        });
    });

    // Injury Control Toggle Filter Rules
    document.getElementById('headacheThrottle').addEventListener('change', (e) => {
        const jumpsTask = document.querySelectorAll('.task-item')[4]; // Index mapping jumps
        if (e.target.checked) {
            jumpsTask.style.opacity = "0.3";
            jumpsTask.style.pointerEvents = "none";
            alert("Headache protocol engaged. Jumping tasks deactivated. Execute Wall Slides instead.");
        } else {
            jumpsTask.style.opacity = "1";
            jumpsTask.style.pointerEvents = "auto";
        }
    });

    // Emergency Routine Switcher Collapse
    document.getElementById('emergencyBtn').addEventListener('click', () => {
        document.querySelectorAll('.phase-card').forEach((card, i) => {
            if (i !== 0 && i !== 4) card.classList.toggle('hidden'); // Leave only key checkpoints
        });
        alert("Emergency View triggered. Focus entirely on basic nourishment and HGH sleep checks.");
    });

    // Theme Management Controls
    document.getElementById('voidEchoToggle').addEventListener('click', () => {
        document.body.classList.remove('fog-theme');
        document.body.classList.toggle('void-echo-theme');
        renderCharts();
    });

    document.getElementById('fogModeToggle').addEventListener('click', () => {
        document.body.classList.remove('void-echo-theme');
        document.body.classList.toggle('fog-theme');
        renderCharts();
    });

    // Pre-sleep Breathe Engine Metronome
    document.getElementById('startMetronomeBtn').addEventListener('click', toggleBreathingMetronome);
}

// ==========================================================================
// PRE-SLEEP BREATH METRONOME (4S INHALE / 4S EXHALE)
// ==========================================================================
function toggleBreathingMetronome() {
    const wrapper = document.getElementById('metronomeWrapper');
    const circle = document.getElementById('breathCircle');
    const statusText = document.getElementById('breathText');
    const btn = document.getElementById('startMetronomeBtn');
    
    if (metronomeInterval) {
        clearInterval(metronomeInterval);
        metronomeInterval = null;
        wrapper.classList.add('hidden');
        circle.classList.remove('expand');
        btn.innerHTML = '<i class="fa-solid fa-circle-nodes"></i> Start Breathing Metronome';
        return;
    }
    
    wrapper.classList.remove('hidden');
    btn.innerHTML = '<i class="fa-solid fa-stop"></i> Stop Metronome';
    
    let isInhaling = true;
    statusText.innerText = "Nasal Inhale (4s)";
    circle.classList.add('expand');
    
    metronomeInterval = setInterval(() => {
        isInhaling = !isInhaling;
        if (isInhaling) {
            statusText.innerText = "Nasal Inhale (4s)";
            circle.classList.add('expand');
        } else {
            statusText.innerText = "Nasal Exhale (4s)";
            circle.classList.remove('expand');
        }
    }, 4000);
}
// ==========================================================================
// QUICK UNIT CONVERTERS
// ==========================================================================
function convertWeightUnit(val) {
    const num = parseFloat(val);
    if (isNaN(num)) {
        document.getElementById('weightConvResult').innerText = "0 lbs = 0 kg";
        return;
    }
    const toKg = (num * 0.453592).toFixed(2);
    const toLbs = (num / 0.453592).toFixed(2);
    document.getElementById('weightConvResult').innerText = `${num} lbs = ${toKg} kg | ${num} kg = ${toLbs} lbs`;
}

function convertCmToFeet(cmVal) {
    const cm = parseFloat(cmVal);
    if (isNaN(cm) || cm <= 0) {
        document.getElementById('heightCmResult').innerText = "0 ft";
        return;
    }
    const realFeet = cm * 0.0328084;
    const feet = Math.floor(realFeet);
    const inches = Math.round((realFeet - feet) * 12);
    document.getElementById('heightCmResult').innerText = `${feet}'${inches}"`;
}

function convertFeetToCm(ftVal) {
    const ftStr = ftVal.toString();
    if (!ftVal || isNaN(parseFloat(ftVal))) {
        document.getElementById('heightFtResult').innerText = "0 cm";
        return;
    }
    
    // Split input like 5.07 into 5 feet and 7 inches
    const parts = ftStr.split('.');
    const feet = parseInt(parts[0]) || 0;
    const inches = parseInt(parts[1]) || 0;
    
    const totalInches = (feet * 12) + inches;
    const cm = (totalInches * 2.54).toFixed(1);
    document.getElementById('heightFtResult').innerText = `${cm} cm`;
}
