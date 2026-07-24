// Pondera App - Frontend JavaScript Logic
let state = {
    periods: [],
    resumen: {},
    chartData: { labels: [], values: [] },
    planCycles: {},
    compatibility: {},
    activeTab: null,
    planExpanded: false,
    isEmpty: true,
    initialPeriods: null,
    initialResumen: null,
    // Simulation state
    simSelectedCodes: new Set(),
    simCreditsCurrent: 0.0
};

let ponderadosChart = null;

// Custom Chart.js Plugin for Vertical Dashed Crosshair Line on Hover
const crosshairPlugin = {
    id: 'crosshair',
    afterDraw: (chart) => {
        if (chart.tooltip && chart.tooltip._active && chart.tooltip._active.length) {
            const activePoint = chart.tooltip._active[0];
            const ctx = chart.ctx;
            const x = activePoint.element.x;
            const topY = chart.scales.y.top;
            const bottomY = chart.scales.y.bottom;
            ctx.save();
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.moveTo(x, topY);
            ctx.lineTo(x, bottomY);
            ctx.lineWidth = 1.5;
            ctx.strokeStyle = '#9CA3AF';
            ctx.stroke();
            ctx.restore();
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    fetchInitialData();
    setupUploadHandlers();
});

function fetchInitialData() {
    state.periods = [];
    state.resumen = {
        required_credits: 0.0, approved_credits: 0.0, obligatorios: 0.0, especialidad: 0.0,
        electivos_generales: 0.0, electivos_especialidad: 0.0, optativos: 0.0, alternativos: 0.0,
        otra_especialidad: 0.0, mas_de_una_vez: 0.0, otros: 0.0, missing_credits: 0.0, ppg: 0.0
    };
    state.chartData = { labels: [], values: [] };
    state.planCycles = {};
    state.compatibility = { is_compatible: true, reasons: [] };
    state.isEmpty = true;
    renderAll();
}

function renderAll() {
    renderHeaderInfo();
    renderCompatibilityAlert();
    renderDashboard();
    renderChart();
    renderPeriodTabs();
    renderCourseTables();
    renderPPCSummaryList();
    renderPlanEstudios();
}

function renderHeaderInfo() {
    const compat = state.compatibility || {};
    const histMeta = compat.historial_meta || {};
    const planMeta = compat.plan_meta || {};
    const studentElem = document.getElementById('student-name');
    const planElem = document.getElementById('header-plan-tag');
    if (state.isEmpty && (!histMeta.student_name && !planMeta.escuela)) {
        if (studentElem) studentElem.innerText = 'Suba sus archivos PDF para comenzar';
        if (planElem) planElem.innerText = 'Plan --';
        return;
    }
    const studentName = histMeta.student_name || 'Estudiante';
    const escuela = histMeta.escuela || planMeta.escuela || 'Escuela Profesional';
    const planName = planMeta.plan || histMeta.plan || 'Plan --';
    if (studentElem) studentElem.innerText = `${studentName} (${escuela})`;
    if (planElem) planElem.innerText = planName;
}

function renderCompatibilityAlert() {
    const banner = document.getElementById('compatibility-alert-banner');
    if (!banner) return;
    const compat = state.compatibility;
    if (compat && !compat.is_compatible && !state.isEmpty) {
        banner.style.display = 'flex';
        document.getElementById('alert-title').innerText = '⚠️ Advertencia: Incompatibilidad entre Historial y Plan de Estudios';
        let msgHtml = '<div style="margin-top:6px;"><ul style="margin-left: 20px; font-size:13px;">';
        (compat.reasons || []).forEach(r => { msgHtml += `<li>${r}</li>`; });
        msgHtml += '</ul><div style="margin-top:6px; font-size:12px; font-weight:600;">Verifique que ambos archivos PDF correspondan a la misma carrera profesional.</div></div>';
        document.getElementById('alert-message').innerHTML = msgHtml;
    } else {
        banner.style.display = 'none';
    }
}

function renderDashboard() {
    const r = state.resumen || {};
    const hasData = state.periods.length > 0 || r.approved_credits > 0;
    document.getElementById('ppg-val').innerText = (hasData && r.ppg !== undefined) ? r.ppg.toFixed(3) : '--';
    document.getElementById('req-credits-val').innerText = (hasData && r.required_credits) ? r.required_credits.toFixed(1) : '--';
    const approved = r.approved_credits || 0.0;
    const required = r.required_credits || 221.0;
    document.getElementById('app-credits-val').innerText = hasData ? approved.toFixed(1) : '--';
    const pct = hasData ? Math.min(100, Math.max(0, (approved / required) * 100)) : 0;
    document.getElementById('progress-bar-fill').style.width = `${pct.toFixed(1)}%`;
    document.getElementById('progress-pct-text').innerText = hasData ? `${pct.toFixed(1)}% del total` : 'Sin datos';
    const missing = r.missing_credits !== undefined ? r.missing_credits : Math.max(0, required - approved);
    document.getElementById('missing-credits-val').innerText = hasData ? missing.toFixed(1) : '--';
    document.getElementById('cat-obligatorios').innerText = (r.obligatorios || 0.0).toFixed(1);
    document.getElementById('cat-especialidad').innerText = (r.especialidad || 0.0).toFixed(1);
    document.getElementById('cat-electivos-generales').innerText = (r.electivos_generales || 0.0).toFixed(1);
    document.getElementById('cat-electivos-especialidad').innerText = (r.electivos_especialidad || 0.0).toFixed(1);
    document.getElementById('cat-optativos').innerText = (r.optativos || 0.0).toFixed(1);
    document.getElementById('cat-alternativos').innerText = (r.alternativos || 0.0).toFixed(1);
    document.getElementById('cat-otra-especialidad').innerText = (r.otra_especialidad || 0.0).toFixed(1);
    document.getElementById('cat-mas-de-una-vez').innerText = (r.mas_de_una_vez || 0.0).toFixed(1);
    document.getElementById('cat-otros').innerText = (r.otros || 0.0).toFixed(1);
}

function renderChart() {
    const ctx = document.getElementById('ponderadosChart').getContext('2d');
    const labels = state.chartData.labels || [];
    const dataValues = state.chartData.values || [];
    let maxVal = dataValues.length > 0 ? Math.max(...dataValues) : 16.0;
    let minVal = dataValues.length > 0 ? Math.min(...dataValues) : 13.0;
    const yMax = Math.max(16.0, Math.ceil(maxVal + 0.5));
    const yMin = Math.min(13.0, Math.floor(minVal - 0.5));

    const fillGradient = ctx.createLinearGradient(0, 0, 0, 300);
    fillGradient.addColorStop(0, 'rgba(37, 99, 235, 0.12)');
    fillGradient.addColorStop(1, 'rgba(37, 99, 235, 0.0)');

    if (ponderadosChart) ponderadosChart.destroy();
    ponderadosChart = new Chart(ctx, {
        type: 'line',
        plugins: [crosshairPlugin],
        data: {
            labels: labels.length > 0 ? labels : ['Sin Datos'],
            datasets: [{
                label: 'Promedio Semestre',
                data: dataValues.length > 0 ? dataValues : [0],
                borderColor: '#2563EB',
                borderWidth: 4,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointBackgroundColor: '#2563EB',
                pointBorderColor: '#2563EB',
                pointHoverBackgroundColor: '#2563EB',
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBorderWidth: 2,
                backgroundColor: fillGradient,
                fill: true,
                clip: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { top: 20, bottom: 15, left: 10, right: 15 } },
            plugins: {
                title: { display: true, text: 'Grafico de comparacion entre Periodo Academico y Promedio', align: 'start', color: '#222222', font: { family: 'Inter, sans-serif', size: 16, weight: 'bold' }, padding: { bottom: 15 } },
                legend: { display: false },
                tooltip: {
                    enabled: true, mode: 'index', intersect: false,
                    backgroundColor: '#F0F4F8', titleColor: '#1F2937', bodyColor: '#1F2937',
                    borderColor: '#D1D5DB', borderWidth: 1, padding: 12, cornerRadius: 8,
                    titleFont: { family: 'Inter, sans-serif', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Inter, sans-serif', size: 13, weight: '500' },
                    displayColors: true, usePointStyle: true,
                    callbacks: {
                        title: (ctx) => ctx[0].label,
                        label: (ctx) => ` Promedio Semestre:  ${Number(ctx.parsed.y).toFixed(3)}`,
                        labelColor: () => ({ borderColor: '#2563EB', backgroundColor: '#2563EB', borderWidth: 2, borderDash: [], borderRadius: 50 })
                    }
                }
            },
            scales: {
                x: { title: { display: true, text: 'Periodos', color: '#333333', font: { family: 'Inter, sans-serif', size: 14, weight: 'bold' }, padding: { top: 10 } }, ticks: { color: '#333333', font: { family: 'Inter, sans-serif', weight: 'bold' } }, grid: { display: false, drawTicks: true, tickLength: 6, tickColor: '#333333' } },
                y: { title: { display: true, text: 'Promedios', color: '#333333', font: { family: 'Inter, sans-serif', size: 14, weight: 'bold' } }, min: yMin, max: yMax, ticks: { stepSize: 1.000, color: '#333333', font: { family: 'Inter, sans-serif', weight: 'bold' }, callback: v => Number(v).toFixed(3) }, grid: { color: '#E5E7EB', drawBorder: false } }
            }
        }
    });
}

function renderPeriodTabs() {
    const tabsBar = document.getElementById('period-tabs-bar');
    tabsBar.innerHTML = '';
    if (!state.periods || state.periods.length === 0) return;
    if (!state.activeTab && state.periods.length > 0) state.activeTab = state.periods[0].period;
    state.periods.forEach(p => {
        const btn = document.createElement('button');
        const ppcStr = (p.ppc !== null && p.ppc !== undefined) ? p.ppc.toFixed(3) : 'Pendiente';
        const isSimulated = p.is_simulated || false;
        btn.className = `tab-btn ${p.period === state.activeTab ? 'active' : ''} ${isSimulated ? 'simulated' : ''}`;
        btn.innerHTML = `Periodo ${p.period} <small>(${ppcStr})</small>`;
        btn.onclick = () => { state.activeTab = p.period; renderPeriodTabs(); renderCourseTables(); };
        tabsBar.appendChild(btn);
    });
}

function renderCourseTables() {
    const container = document.getElementById('tab-contents-container');
    container.innerHTML = '';
    if (!state.periods || state.periods.length === 0) {
        container.innerHTML = `<div class="empty-state-box"><div style="font-size:36px; margin-bottom:10px;">📄</div><h3 style="font-size:16px; font-weight:700; color:#1F2937; margin-bottom:6px;">No hay datos de cursos cargados</h3><p style="font-size:13px; color:#6B7280;">Por favor, suba su archivo PDF de <strong>Historial Académico</strong> para visualizar sus asignaturas y editar sus notas.</p></div>`;
        return;
    }
    const currentPeriod = state.periods.find(p => p.period === state.activeTab);
    if (!currentPeriod) return;

    const isSimulated = currentPeriod.is_simulated || false;
    const wrapper = document.createElement('div');
    wrapper.className = 'course-table-wrapper';

    let headerHtml = '';
    if (isSimulated) {
        headerHtml = `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; padding:10px 14px; background:#EDE9FE; border-radius:8px;">
            <span style="font-size:13px; font-weight:700; color:#6D28D9;">🔮 Ciclo Simulado — ${currentPeriod.sim_type === 'verano' ? 'Verano (máx 11.0 cr)' : 'Regular (máx 26.0 cr)'}</span>
            <button class="btn-delete-sim" onclick="deleteSimulatedPeriod('${currentPeriod.period}')">🗑️ Eliminar Ciclo Simulado</button>
        </div>`;
    }

    let html = headerHtml + `<table class="course-table"><thead><tr><th>Ciclo</th><th>Tipo</th><th>Asignatura</th><th>Créd.</th><th>EP (30%)</th><th>EC (40%)</th><th>EF (30%)</th><th>Nota Final</th></tr></thead><tbody>`;
    currentPeriod.courses.forEach((c, idx) => {
        let califDisplay = '-';
        let gradeClass = 'grade-pending';
        if (c.calificacion !== null && c.calificacion !== undefined) {
            califDisplay = c.calificacion;
            gradeClass = c.calificacion >= 11 ? 'grade-approved' : 'grade-disapproved';
        }
        const epVal = (c.ep !== undefined) ? c.ep : (c.calificacion || 0);
        const ecVal = (c.ec !== undefined) ? c.ec : (c.calificacion || 0);
        const efVal = (c.ef !== undefined) ? c.ef : (c.calificacion || 0);
        const showEmpty = (isSimulated || c.en_curso) && !c.user_edited;
        html += `<tr>
            <td><strong>Ciclo ${c.ciclo}</strong></td>
            <td><span class="badge-tipo ${c.tipo}">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'}</span></td>
            <td><div><strong>${c.codigo || ''}</strong></div><div style="font-size:12px; color:#4B5563;">${c.nombre || c.asignatura_full}</div></td>
            <td><strong>${c.creditos.toFixed(1)}</strong></td>
            <td><input type="number" class="grade-input" min="0" max="20" step="1" value="${showEmpty ? '' : epVal}" placeholder="--" oninput="onGradeChange('${currentPeriod.period}', ${idx}, 'ep', this.value)" onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ep', this.value)"></td>
            <td><input type="number" class="grade-input" min="0" max="20" step="1" value="${showEmpty ? '' : ecVal}" placeholder="--" oninput="onGradeChange('${currentPeriod.period}', ${idx}, 'ec', this.value)" onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ec', this.value)"></td>
            <td><input type="number" class="grade-input" min="0" max="20" step="1" value="${showEmpty ? '' : efVal}" placeholder="--" oninput="onGradeChange('${currentPeriod.period}', ${idx}, 'ef', this.value)" onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ef', this.value)"></td>
            <td><span class="grade-final ${gradeClass}" id="grade-final-${currentPeriod.period}-${idx}">${califDisplay}</span></td>
        </tr>`;
    });
    const ppcValStr = (currentPeriod.ppc !== null && currentPeriod.ppc !== undefined) ? currentPeriod.ppc.toFixed(3) : 'Pendiente';
    html += `</tbody></table><div style="margin-top: 14px; text-align: right; font-size: 14px; font-weight: 700;">Promedio Ponderado del Ciclo (${currentPeriod.period}): <span style="color: #1D4ED8; font-size: 16px; font-weight: 800;">${ppcValStr}</span></div>`;
    wrapper.innerHTML = html;
    container.appendChild(wrapper);
}

function renderPPCSummaryList() {
    const listContainer = document.getElementById('ppc-summary-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';
    if (!state.periods || state.periods.length === 0) {
        listContainer.innerHTML = '<span class="text-muted" style="font-size:13px;">Suba su Historial Académico para ver sus periodos.</span>';
        return;
    }
    state.periods.forEach(p => {
        const item = document.createElement('div');
        item.className = 'ppc-item';
        const ppcStr = (p.ppc !== null && p.ppc !== undefined) ? p.ppc.toFixed(3) : 'En curso';
        const evalCreds = p.evaluated_credits ? `${p.evaluated_credits.toFixed(1)} cr.` : '0 cr.';
        const simLabel = p.is_simulated ? ' <span style="font-size:9px; background:#EDE9FE; color:#6D28D9; padding:1px 4px; border-radius:3px; font-weight:700;">SIM</span>' : '';
        item.innerHTML = `<div style="display:flex; flex-direction:column;"><span class="ppc-period">Periodo ${p.period}${simLabel}</span><span style="font-size:11px; color:#6B7280;">${evalCreds} evaluados</span></div><span class="ppc-val">${ppcStr}</span>`;
        listContainer.appendChild(item);
    });
}

function onGradeChange(periodName, courseIdx, field, val) {
    const p = state.periods.find(item => item.period === periodName);
    if (!p || !p.courses[courseIdx]) return;
    const course = p.courses[courseIdx];

    if (val === '' || val === null || val === undefined) {
        delete course[field];
    } else {
        let intVal = parseInt(val, 10);
        if (isNaN(intVal)) intVal = 0;
        course[field] = Math.max(0, Math.min(20, intVal));
    }
    course.user_edited = true;

    const hasEp = (course.ep !== undefined);
    const hasEc = (course.ec !== undefined);
    const hasEf = (course.ef !== undefined);

    if (hasEp || hasEc || hasEf) {
        const ep = course.ep || 0;
        const ec = course.ec || 0;
        const ef = course.ef || 0;
        const exact = 0.30 * ep + 0.40 * ec + 0.30 * ef;
        const rounded = Math.floor(exact + 0.5);
        course.calificacion = rounded;
        const finalElem = document.getElementById(`grade-final-${periodName}-${courseIdx}`);
        if (finalElem) {
            finalElem.innerText = rounded;
            finalElem.className = `grade-final ${rounded >= 11 ? 'grade-approved' : 'grade-disapproved'}`;
        }
    } else {
        course.calificacion = null;
        const finalElem = document.getElementById(`grade-final-${periodName}-${courseIdx}`);
        if (finalElem) {
            finalElem.innerText = '-';
            finalElem.className = 'grade-final grade-pending';
        }
    }
    recalculateAll();
}

function enrichLocalPeriodsWithPlan() {
    if (!state.planCycles || !state.periods) return;
    const planMap = {};
    Object.keys(state.planCycles).forEach(cNum => {
        state.planCycles[cNum].forEach(c => {
            if (c.codigo && c.codigo !== '--' && (c.nombre || c.asignatura_full)) {
                planMap[c.codigo] = c.nombre || c.asignatura_full;
            }
        });
    });

    state.periods.forEach(p => {
        p.courses.forEach(c => {
            if (c.codigo && planMap[c.codigo]) {
                c.nombre = planMap[c.codigo];
                c.asignatura_full = `${c.codigo} - ${planMap[c.codigo]}`;
            }
        });
    });
}

function undoChanges() {
    if (!state.initialPeriods || state.initialPeriods.length === 0) {
        alert("No hay cambios guardados para deshacer.");
        return;
    }
    state.periods = JSON.parse(JSON.stringify(state.initialPeriods));
    if (state.initialResumen) {
        state.resumen = JSON.parse(JSON.stringify(state.initialResumen));
    }
    state.activeTab = state.periods.length > 0 ? state.periods[0].period : null;
    enrichLocalPeriodsWithPlan();
    recalculateAll();
    renderAll();
    alert("↺ Se han deshecho todos los cambios, notas editadas y ciclos simulados.");
}

function recalculateAll() {
    try {
        enrichLocalPeriodsWithPlan();
        const baseResumen = state.initialResumen ? JSON.parse(JSON.stringify(state.initialResumen)) : {};
        const calcResult = window.computeAllPonderados(state.periods, baseResumen);
        
        state.periods = calcResult.periodsData;
        state.resumen = calcResult.resumen;
        state.chartData = calcResult.chartData;
        
        renderDashboard();
        renderChart();
        renderPeriodTabs();
        renderPPCSummaryList();
    } catch (err) { console.error("Recalculation error:", err); }
}

function togglePlanEstudios() {
    state.planExpanded = !state.planExpanded;
    const bodyElem = document.getElementById('plan-estudios-body');
    const toggleBtn = document.getElementById('plan-toggle-btn');
    if (bodyElem && toggleBtn) {
        bodyElem.style.display = state.planExpanded ? 'block' : 'none';
        toggleBtn.innerText = state.planExpanded ? '▲ Ocultar Plan de Estudios Completo' : '▼ Ver Plan de Estudios Completo';
    }
}

function renderPlanEstudios() {
    const container = document.getElementById('plan-cycles-container');
    if (!container) return;
    container.innerHTML = '';
    const cycles = state.planCycles || {};
    const cycleKeys = Object.keys(cycles).sort((a, b) => parseInt(a) - parseInt(b));
    if (cycleKeys.length === 0) {
        container.innerHTML = `<div class="empty-state-box"><div style="display:flex; justify-content:center; margin-bottom:10px; color:#9CA3AF;"><svg class="icon-svg-lg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></div><h3 style="font-size:16px; font-weight:700; color:#1F2937; margin-bottom:6px;">No hay datos de plan de estudios cargados</h3><p style="font-size:13px; color:#6B7280;">Por favor, suba su archivo PDF de <strong>Plan de Estudios</strong> para consultar la malla curricular de su carrera.</p></div>`;
        return;
    }
    cycleKeys.forEach(cNum => {
        const courses = cycles[cNum];
        const card = document.createElement('div');
        card.className = 'plan-cycle-card';
        let html = `<div class="plan-cycle-header"><span style="display:inline-flex; align-items:center; gap:6px;"><svg class="icon-svg-sm" viewBox="0 0 24 24" fill="none" stroke="#2563EB"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> Ciclo ${cNum}</span><span>${courses.length} asignaturas</span></div><div class="course-table-wrapper"><table class="plan-table"><thead><tr><th class="plan-col-code">Código</th><th class="plan-col-name">Asignatura</th><th class="plan-col-cred">Créditos</th><th class="plan-col-tipo">Tipo</th><th class="plan-col-prereq">Prerrequisitos</th></tr></thead><tbody>`;
        courses.forEach(c => {
            html += `<tr><td class="plan-col-code"><strong>${c.codigo || '--'}</strong></td><td class="plan-col-name"><strong>${c.nombre || c.asignatura_full}</strong></td><td class="plan-col-cred"><strong>${c.creditos.toFixed(1)}</strong></td><td class="plan-col-tipo"><span class="badge-tipo ${c.tipo}">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'}</span></td><td class="plan-col-prereq" style="font-size:12px; color:#4B5563;">${c.prerequisito || '--'}</td></tr>`;
        });
        html += '</tbody></table></div>';
        card.innerHTML = html;
        container.appendChild(card);
    });
}

// ========== SIMULACIÓN DE NUEVO CICLO ==========

function normalizeCourseName(str) {
    if (!str) return '';
    return str.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, '');
}

function getApprovedCodes() {
    const approved = new Set();
    state.periods.forEach(p => {
        p.courses.forEach(c => {
            if (c.calificacion !== null && c.calificacion !== undefined && c.calificacion >= 11) {
                if (c.codigo && c.codigo !== '--') approved.add(c.codigo);
                if (c.nombre) approved.add(normalizeCourseName(c.nombre));
                if (c.asignatura_full) approved.add(normalizeCourseName(c.asignatura_full));
            }
        });
    });
    return approved;
}

function getCoursedCodes() {
    const coursed = new Set();
    state.periods.forEach(p => {
        p.courses.forEach(c => {
            if (c.codigo && c.codigo !== '--') coursed.add(c.codigo);
            if (c.nombre) coursed.add(normalizeCourseName(c.nombre));
        });
    });
    return coursed;
}

function getEligibleCourses() {
    const approved = getApprovedCodes();
    const coursed = getCoursedCodes();
    const cycles = state.planCycles || {};
    const available = [];
    const locked = [];

    Object.keys(cycles).sort((a, b) => parseInt(a) - parseInt(b)).forEach(cNum => {
        cycles[cNum].forEach(c => {
            const code = c.codigo || '--';
            const normName = normalizeCourseName(c.nombre || c.asignatura_full);
            
            // Skip if already taken (by code OR by normalized name)
            if ((code !== '--' && coursed.has(code)) || (normName && coursed.has(normName))) return;

            const prereqStr = (c.prerequisito || '--').trim();
            let prereqMet = true;
            let missingPrereqs = [];

            if (prereqStr !== '--' && prereqStr !== '') {
                // Parse prerequisite entries (code - name or just code)
                const prereqItems = prereqStr.split(/[,;]/).map(s => s.trim()).filter(s => s.length > 1);

                prereqItems.forEach(item => {
                    const parts = item.split(' - ');
                    const pCode = parts[0].trim();
                    const pName = parts.length > 1 ? normalizeCourseName(parts[1]) : normalizeCourseName(item);

                    // Check if approved by code OR by name
                    const isApprovedByCode = (pCode && pCode !== '--' && approved.has(pCode));
                    const isApprovedByName = (pName && approved.has(pName));

                    if (!isApprovedByCode && !isApprovedByName) {
                        prereqMet = false;
                        missingPrereqs.push(item);
                    }
                });
            }

            const entry = {
                codigo: code,
                nombre: c.nombre || c.asignatura_full,
                creditos: c.creditos,
                tipo: c.tipo,
                ciclo: parseInt(cNum),
                prerequisito: prereqStr,
                prereqMet: prereqMet,
                missingPrereqs: missingPrereqs
            };

            if (prereqMet) {
                available.push(entry);
            } else {
                locked.push(entry);
            }
        });
    });

    return { available, locked };
}

function suggestPeriodName() {
    const existingPeriods = state.periods.map(p => p.period).sort();
    if (existingPeriods.length === 0) return '2025-1';
    const last = existingPeriods[existingPeriods.length - 1];
    const m = last.match(/^(\d{4})-(\d)$/);
    if (m) {
        const year = parseInt(m[1]);
        const sem = parseInt(m[2]);
        if (sem === 0) return `${year}-1`;
        if (sem === 1) return `${year}-2`;
        return `${year + 1}-0`;
    }
    return '2025-2';
}

function openSimulateModal() {
    if (state.periods.length === 0 || Object.keys(state.planCycles).length === 0) {
        alert('⚠️ Debe cargar primero su Historial Académico y Plan de Estudios para poder simular un nuevo ciclo.');
        return;
    }

    state.simSelectedCodes = new Set();
    state.simCreditsCurrent = 0.0;
    state.simActiveCycle = null; // Will be set in renderSimCycleNav

    document.getElementById('sim-periodo-nombre').value = suggestPeriodName();
    document.getElementById('sim-tipo-periodo').value = 'regular';

    updateSimCreditsDisplay();
    renderSimCycleNav();

    document.getElementById('modal-simular-ciclo').style.display = 'flex';
}

function closeSimulateModal() {
    document.getElementById('modal-simular-ciclo').style.display = 'none';
}

function onSimTipoChange() {
    const maxCredits = getSimMaxCredits();
    if (state.simCreditsCurrent > maxCredits) {
        state.simSelectedCodes = new Set();
        state.simCreditsCurrent = 0.0;
    }
    updateSimCreditsDisplay();
    renderSimCycleNav();
}

function getSimMaxCredits() {
    const tipo = document.getElementById('sim-tipo-periodo').value;
    return tipo === 'verano' ? 11.0 : 26.0;
}

function updateSimCreditsDisplay() {
    const maxCredits = getSimMaxCredits();
    document.getElementById('sim-credits-count').innerText = state.simCreditsCurrent.toFixed(1);
    document.getElementById('sim-credits-max').innerText = maxCredits.toFixed(1);
    const pct = Math.min(100, (state.simCreditsCurrent / maxCredits) * 100);
    document.getElementById('sim-credits-fill').style.width = `${pct.toFixed(1)}%`;
}

function getEligibleCoursesByCycle() {
    const { available, locked } = getEligibleCourses();
    const byCycle = {};

    // Group available courses by cycle
    available.forEach(c => {
        if (!byCycle[c.ciclo]) byCycle[c.ciclo] = { available: [], locked: [] };
        byCycle[c.ciclo].available.push(c);
    });

    // Group locked courses by cycle
    locked.forEach(c => {
        if (!byCycle[c.ciclo]) byCycle[c.ciclo] = { available: [], locked: [] };
        byCycle[c.ciclo].locked.push(c);
    });

    return byCycle;
}

function renderSimCycleNav() {
    const navContainer = document.getElementById('sim-cycle-nav');
    navContainer.innerHTML = '';
    const byCycle = getEligibleCoursesByCycle();
    const cycleKeys = Object.keys(byCycle).sort((a, b) => parseInt(a) - parseInt(b));

    if (cycleKeys.length === 0) {
        navContainer.innerHTML = '<div style="font-size:13px; color:#6B7280; padding:4px 0;">No hay ciclos con cursos disponibles.</div>';
        renderSimCourseListForCycle(null);
        return;
    }

    // Auto-select first cycle if none active or invalid
    if (!state.simActiveCycle || !cycleKeys.includes(String(state.simActiveCycle))) {
        state.simActiveCycle = parseInt(cycleKeys[0]);
    }

    cycleKeys.forEach(cNum => {
        const cycleData = byCycle[cNum];
        const total = cycleData.available.length + cycleData.locked.length;
        const selected = cycleData.available.filter(c => state.simSelectedCodes.has(c.codigo)).length;
        const isActive = parseInt(cNum) === state.simActiveCycle;

        const btn = document.createElement('button');
        btn.className = `sim-cycle-btn ${isActive ? 'active' : ''}`;

        let badgeHtml = `<span class="cycle-count">${total}</span>`;
        if (selected > 0) {
            badgeHtml = `<span class="cycle-selected">✓${selected}</span>`;
        }

        btn.innerHTML = `Ciclo ${cNum} ${badgeHtml}`;
        btn.onclick = () => {
            state.simActiveCycle = parseInt(cNum);
            renderSimCycleNav();
        };
        navContainer.appendChild(btn);
    });

    renderSimCourseListForCycle(state.simActiveCycle);
}

function renderSimCourseListForCycle(cycleNum) {
    const availContainer = document.getElementById('sim-available-list');
    const lockedContainer = document.getElementById('sim-locked-list');
    const titleElem = document.getElementById('sim-cycle-title');
    availContainer.innerHTML = '';
    lockedContainer.innerHTML = '';

    if (!cycleNum) {
        titleElem.innerText = '';
        availContainer.innerHTML = '<div style="font-size:13px; color:#6B7280; padding:8px 0;">No hay cursos disponibles para simular.</div>';
        return;
    }

    const byCycle = getEligibleCoursesByCycle();
    const cycleData = byCycle[cycleNum] || { available: [], locked: [] };
    const maxCredits = getSimMaxCredits();

    titleElem.innerHTML = `<svg class="icon-svg-sm" viewBox="0 0 24 24" fill="none" stroke="#2563EB"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg> <span>Ciclo ${cycleNum} — Seleccione los cursos que desea llevar</span>`;

    // Render available courses for this cycle
    if (cycleData.available.length === 0) {
        availContainer.innerHTML = '<div style="font-size:13px; color:#6B7280; padding:8px 0;">No hay cursos disponibles en este ciclo. Ya fueron cursados o los prerrequisitos están pendientes.</div>';
    } else {
        cycleData.available.forEach(c => {
            const isChecked = state.simSelectedCodes.has(c.codigo);
            const wouldExceed = !isChecked && (state.simCreditsCurrent + c.creditos > maxCredits);
            const row = document.createElement('div');
            row.className = `sim-course-row ${isChecked ? 'checked' : ''} ${wouldExceed ? 'over-limit' : ''}`;
            row.innerHTML = `
                <input type="checkbox" class="sim-course-checkbox" data-code="${c.codigo}" data-credits="${c.creditos}"
                    ${isChecked ? 'checked' : ''} ${wouldExceed ? 'disabled' : ''}>
                <div class="sim-course-details">
                    <div class="sim-course-name">${c.codigo} — ${c.nombre}</div>
                    <div class="sim-course-meta">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'} · ${c.creditos.toFixed(1)} créditos</div>
                </div>
                <div class="sim-course-credits">${c.creditos.toFixed(1)} cr</div>
            `;
            const cb = row.querySelector('input[type="checkbox"]');
            cb.addEventListener('change', () => onSimCourseToggle(c, cb.checked));
            if (!wouldExceed) {
                row.addEventListener('click', (e) => {
                    if (e.target.tagName === 'INPUT') return;
                    cb.checked = !cb.checked;
                    onSimCourseToggle(c, cb.checked);
                });
            }
            availContainer.appendChild(row);
        });
    }

    // Render locked courses for this cycle
    if (cycleData.locked.length === 0) {
        lockedContainer.innerHTML = '<div style="font-size:13px; color:#6B7280; padding:8px 0;">Ningún curso bloqueado en este ciclo.</div>';
    } else {
        cycleData.locked.forEach(c => {
            const row = document.createElement('div');
            row.className = 'sim-course-row locked';
            row.innerHTML = `
                <div style="width:18px; text-align:center; color:#9CA3AF; font-size:16px;">🔒</div>
                <div class="sim-course-details">
                    <div class="sim-course-name" style="color:#9CA3AF;">${c.codigo} — ${c.nombre}</div>
                    <div class="sim-course-meta">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'} · ${c.creditos.toFixed(1)} créditos</div>
                    <div class="sim-prereq-reason">Requiere: ${c.missingPrereqs.join(', ')} (No aprobado)</div>
                </div>
                <div class="sim-course-credits" style="color:#9CA3AF;">${c.creditos.toFixed(1)} cr</div>
            `;
            lockedContainer.appendChild(row);
        });
    }
}

function onSimCourseToggle(course, isChecked) {
    if (isChecked) {
        state.simSelectedCodes.add(course.codigo);
        state.simCreditsCurrent += course.creditos;
    } else {
        state.simSelectedCodes.delete(course.codigo);
        state.simCreditsCurrent -= course.creditos;
    }
    state.simCreditsCurrent = Math.max(0, state.simCreditsCurrent);
    updateSimCreditsDisplay();
    // Update cycle nav badges and re-render current cycle's courses
    renderSimCycleNav();
}

function confirmSimulatedPeriod() {
    if (state.simSelectedCodes.size === 0) {
        alert('Seleccione al menos un curso para crear el ciclo simulado.');
        return;
    }

    const periodName = document.getElementById('sim-periodo-nombre').value.trim();
    if (!periodName) {
        alert('Ingrese un nombre para el periodo (ej: 2025-2).');
        return;
    }

    // Check duplicate period name
    if (state.periods.some(p => p.period === periodName)) {
        alert(`Ya existe un periodo con el nombre "${periodName}". Elija un nombre diferente.`);
        return;
    }

    const simType = document.getElementById('sim-tipo-periodo').value;
    const { available } = getEligibleCourses();

    const courses = [];
    available.forEach(c => {
        if (state.simSelectedCodes.has(c.codigo)) {
            courses.push({
                id: `${periodName}_${c.codigo}_SIM`,
                ciclo: c.ciclo,
                plan: '2023',
                tipo: c.tipo,
                codigo: c.codigo,
                nombre: c.nombre,
                asignatura_full: `${c.codigo} - ${c.nombre}`,
                calificacion: null,
                creditos: c.creditos,
                seccion: '1',
                acta: 'Simulado',
                ep: 0,
                ec: 0,
                ef: 0,
                en_curso: true,
                user_edited: false,
                is_simulated: true
            });
        }
    });

    const newPeriod = {
        period: periodName,
        courses: courses,
        ppc: null,
        evaluated_credits: 0.0,
        is_simulated: true,
        sim_type: simType
    };

    state.periods.push(newPeriod);
    state.activeTab = periodName;
    state.isEmpty = false;

    closeSimulateModal();
    renderAll();
}

function deleteSimulatedPeriod(periodName) {
    const idx = state.periods.findIndex(p => p.period === periodName && p.is_simulated);
    if (idx === -1) return;

    state.periods.splice(idx, 1);

    if (state.activeTab === periodName) {
        state.activeTab = state.periods.length > 0 ? state.periods[state.periods.length - 1].period : null;
    }

    recalculateAll();
    renderAll();
}

// ========== UPLOAD HANDLERS ==========

function setupUploadHandlers() {
    document.getElementById('historial-file-input').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            try {
                const data = await window.parseHistorialFile(e.target.files[0]);
                const calcResult = window.computeAllPonderados(data.periods, data.resumen);
                const compatInfo = window.validateDocumentCompatibility(data.metadata, {}, calcResult.periodsData, {});
                
                const simPeriods = state.periods.filter(p => p.is_simulated);
                state.periods = [...calcResult.periodsData, ...simPeriods];
                state.resumen = calcResult.resumen;
                state.initialPeriods = JSON.parse(JSON.stringify(calcResult.periodsData));
                state.initialResumen = JSON.parse(JSON.stringify(calcResult.resumen));
                state.chartData = calcResult.chartData;
                state.compatibility = compatInfo;
                state.compatibility.historial_meta = data.metadata;
                state.isEmpty = false;
                state.activeTab = state.periods.length > 0 ? state.periods[0].period : null;
                
                enrichLocalPeriodsWithPlan();
                recalculateAll();
                
                if (compatInfo && !compatInfo.is_compatible) {
                    alert("⚠️ Advertencia: El Historial Académico cargado parece no coincidir con el Plan de Estudios.");
                } else {
                    alert("¡Historial académico cargado exitosamente!");
                }
            } catch (err) { alert("Error al subir el archivo de historial: " + err); }
        }
    });

    document.getElementById('plan-file-input').addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            try {
                const data = await window.parsePlanFile(e.target.files[0]);
                const histMeta = state.compatibility ? state.compatibility.historial_meta : {};
                const compatInfo = window.validateDocumentCompatibility(histMeta, data.metadata, state.periods, data.cycles);
                
                state.planCycles = data.cycles;
                state.compatibility = compatInfo;
                state.isEmpty = false;
                
                enrichLocalPeriodsWithPlan();
                recalculateAll();
                
                if (compatInfo && !compatInfo.is_compatible) {
                    alert("⚠️ Advertencia: El Plan de Estudios cargado no coincide con la carrera del Historial Académico.");
                } else {
                    alert("¡Plan de estudios cargado exitosamente!");
                }
            } catch (err) { alert("Error al subir el archivo de plan de estudios: " + err); }
        }
    });
}
