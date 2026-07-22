// Pondera App - Frontend JavaScript Logic
let state = {
    periods: [],
    resumen: {},
    chartData: { labels: [], values: [] },
    planCycles: {},
    compatibility: {},
    activeTab: null,
    planExpanded: false,
    isEmpty: true
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

// Fetch initial data from server (Empty by default)
async function fetchInitialData() {
    try {
        const response = await fetch('/api/initial-data');
        const data = await response.json();
        if (data.success) {
            state.periods = data.periods || [];
            state.resumen = data.resumen || {};
            state.chartData = data.chart_data || { labels: [], values: [] };
            state.planCycles = data.plan_cycles || {};
            state.compatibility = data.compatibility || {};
            state.isEmpty = data.is_empty || true;
            
            renderAll();
        } else {
            console.error("Error loading initial data:", data.error);
        }
    } catch (err) {
        console.error("Failed to fetch initial data:", err);
    }
}

// Render UI Components
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

// Render Header Info
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

// Render Compatibility Alert Banner
function renderCompatibilityAlert() {
    const banner = document.getElementById('compatibility-alert-banner');
    if (!banner) return;

    const compat = state.compatibility;
    if (compat && !compat.is_compatible && !state.isEmpty) {
        banner.style.display = 'flex';
        document.getElementById('alert-title').innerText = '⚠️ Advertencia: Incompatibilidad entre Historial y Plan de Estudios';
        
        let msgHtml = '<div style="margin-top:6px;"><ul style="margin-left: 20px; font-size:13px;">';
        (compat.reasons || []).forEach(r => {
            msgHtml += `<li>${r}</li>`;
        });
        msgHtml += '</ul><div style="margin-top:6px; font-size:12px; font-weight:600;">Verifique que ambos archivos PDF correspondan a la misma carrera profesional.</div></div>';
        
        document.getElementById('alert-message').innerHTML = msgHtml;
    } else {
        banner.style.display = 'none';
    }
}

// Render Dashboard Metrics
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

    // Breakdown
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

// Render Spline Chart with Hover Tooltip & Crosshair Line
function renderChart() {
    const ctx = document.getElementById('ponderadosChart').getContext('2d');
    
    const labels = state.chartData.labels || [];
    const dataValues = state.chartData.values || [];

    let maxVal = dataValues.length > 0 ? Math.max(...dataValues) : 16.0;
    let minVal = dataValues.length > 0 ? Math.min(...dataValues) : 13.0;

    const yMax = Math.max(16.0, Math.ceil(maxVal + 0.5));
    const yMin = Math.min(13.0, Math.floor(minVal - 0.5));

    if (ponderadosChart) {
        ponderadosChart.destroy();
    }

    ponderadosChart = new Chart(ctx, {
        type: 'line',
        plugins: [crosshairPlugin],
        data: {
            labels: labels.length > 0 ? labels : ['Sin Datos'],
            datasets: [{
                label: 'Promedio Semestre',
                data: dataValues.length > 0 ? dataValues : [0],
                borderColor: '#1EA7FF', // Cyan brillante per spec
                borderWidth: 5,         // Gruesa (~4px-5px) per spec
                tension: 0.4,           // Curvatura suave Spline ~0.4 per spec
                pointRadius: 0,         // Sin puntos visibles en estado normal per spec
                pointHoverRadius: 6,    // Puntos visibles al pasar el cursor per screenshot
                pointHoverBackgroundColor: '#1EA7FF',
                pointHoverBorderColor: '#FFFFFF',
                pointHoverBorderWidth: 2,
                fill: false,
                clip: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            layout: {
                padding: {
                    top: 20,
                    bottom: 15,
                    left: 10,
                    right: 15
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Grafico de comparacion entre Periodo Academico y Promedio',
                    align: 'start', // Izquierda top-left per spec
                    color: '#222222', // Gris oscuro / casi negro per spec
                    font: {
                        family: 'Inter, sans-serif',
                        size: 16,
                        weight: 'bold'
                    },
                    padding: {
                        bottom: 15
                    }
                },
                legend: {
                    display: false
                },
                tooltip: {
                    enabled: true,
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#F0F4F8',
                    titleColor: '#1F2937',
                    bodyColor: '#1F2937',
                    borderColor: '#D1D5DB',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { family: 'Inter, sans-serif', size: 13, weight: 'bold' },
                    bodyFont: { family: 'Inter, sans-serif', size: 13, weight: '500' },
                    displayColors: true,
                    usePointStyle: true,
                    callbacks: {
                        title: function(context) {
                            return context[0].label;
                        },
                        label: function(context) {
                            const val = Number(context.parsed.y).toFixed(3);
                            return ` Promedio Semestre:  ${val}`;
                        },
                        labelColor: function() {
                            return {
                                borderColor: '#1EA7FF',
                                backgroundColor: '#1EA7FF',
                                borderWidth: 2,
                                borderDash: [],
                                borderRadius: 50
                            };
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Periodos', // Eje X per spec
                        color: '#333333',
                        font: {
                            family: 'Inter, sans-serif',
                            size: 14,
                            weight: 'bold'
                        },
                        padding: { top: 10 }
                    },
                    ticks: {
                        color: '#333333',
                        font: { family: 'Inter, sans-serif', weight: 'bold' }
                    },
                    grid: {
                        display: false,
                        drawTicks: true,
                        tickLength: 6,
                        tickColor: '#333333'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Promedios', // Eje Y per spec
                        color: '#333333',
                        font: {
                            family: 'Inter, sans-serif',
                            size: 14,
                            weight: 'bold'
                        }
                    },
                    min: yMin,
                    max: yMax,
                    ticks: {
                        stepSize: 1.000,
                        color: '#333333',
                        font: { family: 'Inter, sans-serif', weight: 'bold' },
                        callback: function(value) {
                            return Number(value).toFixed(3);
                        }
                    },
                    grid: {
                        color: '#E5E7EB',
                        drawBorder: false
                    }
                }
            }
        }
    });
}

// Render Period Tabs
function renderPeriodTabs() {
    const tabsBar = document.getElementById('period-tabs-bar');
    tabsBar.innerHTML = '';

    if (!state.periods || state.periods.length === 0) {
        tabsBar.innerHTML = '';
        return;
    }

    if (!state.activeTab && state.periods.length > 0) {
        state.activeTab = state.periods[0].period;
    }

    state.periods.forEach(p => {
        const btn = document.createElement('button');
        const ppcStr = (p.ppc !== null && p.ppc !== undefined) ? p.ppc.toFixed(3) : 'Pendiente';
        btn.className = `tab-btn ${p.period === state.activeTab ? 'active' : ''}`;
        btn.innerHTML = `Periodo ${p.period} <small>(${ppcStr})</small>`;
        btn.onclick = () => {
            state.activeTab = p.period;
            renderPeriodTabs();
            renderCourseTables();
        };
        tabsBar.appendChild(btn);
    });
}

// Render Course Tables per Tab
function renderCourseTables() {
    const container = document.getElementById('tab-contents-container');
    container.innerHTML = '';

    if (!state.periods || state.periods.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <div style="font-size:36px; margin-bottom:10px;">📄</div>
                <h3 style="font-size:16px; font-weight:700; color:#1F2937; margin-bottom:6px;">No hay datos de cursos cargados</h3>
                <p style="font-size:13px; color:#6B7280;">Por favor, suba su archivo PDF de <strong>Historial Académico</strong> para visualizar sus asignaturas y editar sus notas.</p>
            </div>
        `;
        return;
    }

    const currentPeriod = state.periods.find(p => p.period === state.activeTab);
    if (!currentPeriod) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'course-table-wrapper';

    let html = `
        <table class="course-table">
            <thead>
                <tr>
                    <th>Ciclo</th>
                    <th>Tipo</th>
                    <th>Asignatura</th>
                    <th>Créd.</th>
                    <th>EP (30%)</th>
                    <th>EC (40%)</th>
                    <th>EF (30%)</th>
                    <th>Nota Final</th>
                    <th>Sec.</th>
                    <th>Acta</th>
                </tr>
            </thead>
            <tbody>
    `;

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

        html += `
            <tr>
                <td><strong>Ciclo ${c.ciclo}</strong></td>
                <td><span class="badge-tipo ${c.tipo}">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'}</span></td>
                <td>
                    <div><strong>${c.codigo || ''}</strong></div>
                    <div style="font-size:12px; color:#4B5563;">${c.nombre || c.asignatura_full}</div>
                </td>
                <td><strong>${c.creditos.toFixed(1)}</strong></td>
                <td>
                    <input type="number" class="grade-input" min="0" max="20" step="1" 
                        value="${c.en_curso && !c.user_edited ? '' : epVal}" placeholder="--"
                        onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ep', this.value)">
                </td>
                <td>
                    <input type="number" class="grade-input" min="0" max="20" step="1" 
                        value="${c.en_curso && !c.user_edited ? '' : ecVal}" placeholder="--"
                        onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ec', this.value)">
                </td>
                <td>
                    <input type="number" class="grade-input" min="0" max="20" step="1" 
                        value="${c.en_curso && !c.user_edited ? '' : efVal}" placeholder="--"
                        onchange="onGradeChange('${currentPeriod.period}', ${idx}, 'ef', this.value)">
                </td>
                <td>
                    <span class="grade-final ${gradeClass}" id="grade-final-${currentPeriod.period}-${idx}">${califDisplay}</span>
                </td>
                <td>${c.seccion || '1'}</td>
                <td style="font-size:11px; color:#6B7280;">${c.acta || '--'}</td>
            </tr>
        `;
    });

    const ppcValStr = (currentPeriod.ppc !== null && currentPeriod.ppc !== undefined) ? currentPeriod.ppc.toFixed(3) : 'Pendiente';

    html += `
            </tbody>
        </table>
        <div style="margin-top: 14px; text-align: right; font-size: 14px; font-weight: 700;">
            Promedio Ponderado del Ciclo (${currentPeriod.period}): <span style="color: var(--primary); font-size: 16px;">${ppcValStr}</span>
        </div>
    `;

    wrapper.innerHTML = html;
    container.appendChild(wrapper);
}

// Render PPC Summary List in main Grid
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
        item.innerHTML = `
            <div style="display:flex; flex-direction:column;">
                <span class="ppc-period">Periodo ${p.period}</span>
                <span style="font-size:11px; color:#6B7280;">${evalCreds} evaluados</span>
            </div>
            <span class="ppc-val">${ppcStr}</span>
        `;
        listContainer.appendChild(item);
    });
}

// Handle grade input changes
function onGradeChange(periodName, courseIdx, field, val) {
    let intVal = parseInt(val, 10);
    if (isNaN(intVal)) intVal = 0;
    intVal = Math.max(0, Math.min(20, intVal));

    const p = state.periods.find(item => item.period === periodName);
    if (p && p.courses[courseIdx]) {
        p.courses[courseIdx][field] = intVal;
        p.courses[courseIdx].user_edited = true;
        
        const ep = p.courses[courseIdx].ep || 0;
        const ec = p.courses[courseIdx].ec || 0;
        const ef = p.courses[courseIdx].ef || 0;
        const exact = 0.30 * ep + 0.40 * ec + 0.30 * ef;
        const rounded = Math.floor(exact + 0.5); // 10.5 -> 11 rounding
        
        p.courses[courseIdx].calificacion = rounded;
        
        const finalElem = document.getElementById(`grade-final-${periodName}-${courseIdx}`);
        if (finalElem) {
            finalElem.innerText = rounded;
            finalElem.className = `grade-final ${rounded >= 11 ? 'grade-approved' : 'grade-disapproved'}`;
        }
        
        recalculateAll();
    }
}

// Recalculate all metrics via Server API
async function recalculateAll() {
    try {
        const response = await fetch('/api/recalculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                periods: state.periods,
                resumen: state.resumen
            })
        });

        const data = await response.json();
        if (data.success) {
            state.periods = data.periods;
            state.resumen = data.resumen;
            state.chartData = data.chart_data;

            renderDashboard();
            renderChart();
            renderPeriodTabs();
            renderPPCSummaryList();
        }
    } catch (err) {
        console.error("Recalculation error:", err);
    }
}

// Toggle Plan de Estudios Collapsible Section
function togglePlanEstudios() {
    state.planExpanded = !state.planExpanded;
    const bodyElem = document.getElementById('plan-estudios-body');
    const toggleBtn = document.getElementById('plan-toggle-btn');
    if (bodyElem && toggleBtn) {
        if (state.planExpanded) {
            bodyElem.style.display = 'block';
            toggleBtn.innerText = '▲ Ocultar Plan de Estudios Completo';
        } else {
            bodyElem.style.display = 'none';
            toggleBtn.innerText = '▼ Ver Plan de Estudios Completo';
        }
    }
}

// Render Plan de Estudios with clean fixed table layout & vertical auto-expanding height
function renderPlanEstudios() {
    const container = document.getElementById('plan-cycles-container');
    if (!container) return;
    container.innerHTML = '';

    const cycles = state.planCycles || {};
    const cycleKeys = Object.keys(cycles).sort((a, b) => parseInt(a) - parseInt(b));

    if (cycleKeys.length === 0) {
        container.innerHTML = `
            <div class="empty-state-box">
                <div style="font-size:36px; margin-bottom:10px;">📚</div>
                <h3 style="font-size:16px; font-weight:700; color:#1F2937; margin-bottom:6px;">No hay datos de plan de estudios cargados</h3>
                <p style="font-size:13px; color:#6B7280;">Por favor, suba su archivo PDF de <strong>Plan de Estudios</strong> para consultar la malla curricular de su carrera.</p>
            </div>
        `;
        return;
    }

    cycleKeys.forEach(cNum => {
        const courses = cycles[cNum];
        const card = document.createElement('div');
        card.className = 'plan-cycle-card';
        
        let cTitle = `Ciclo ${cNum}`;
        let cTableHtml = `
            <div class="plan-cycle-header">
                <span>📚 ${cTitle}</span>
                <span>${courses.length} asignaturas</span>
            </div>
            <div class="course-table-wrapper">
                <table class="plan-table">
                    <thead>
                        <tr>
                            <th class="plan-col-code">Código</th>
                            <th class="plan-col-name">Asignatura</th>
                            <th class="plan-col-cred">Créditos</th>
                            <th class="plan-col-tipo">Tipo</th>
                            <th class="plan-col-prereq">Prerrequisitos</th>
                        </tr>
                    </thead>
                    <tbody>
        `;

        courses.forEach(c => {
            cTableHtml += `
                <tr>
                    <td class="plan-col-code"><strong>${c.codigo || '--'}</strong></td>
                    <td class="plan-col-name"><strong>${c.nombre || c.asignatura_full}</strong></td>
                    <td class="plan-col-cred"><strong>${c.creditos.toFixed(1)}</strong></td>
                    <td class="plan-col-tipo"><span class="badge-tipo ${c.tipo}">${c.tipo === 'O' ? 'Obligatorio' : 'Electivo'}</span></td>
                    <td class="plan-col-prereq" style="font-size:12px; color:#4B5563;">${c.prerequisito || '--'}</td>
                </tr>
            `;
        });

        cTableHtml += `</tbody></table></div>`;
        card.innerHTML = cTableHtml;
        container.appendChild(card);
    });
}

// Setup Upload Handlers
function setupUploadHandlers() {
    const historialInput = document.getElementById('historial-file-input');
    historialInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);

            try {
                const response = await fetch('/api/upload-historial', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    state.periods = data.periods;
                    state.resumen = data.resumen;
                    state.chartData = data.chart_data;
                    state.compatibility = data.compatibility;
                    state.isEmpty = false;
                    state.activeTab = state.periods.length > 0 ? state.periods[0].period : null;
                    renderAll();
                    
                    if (data.compatibility && !data.compatibility.is_compatible) {
                        alert("⚠️ Advertencia: El Historial Académico cargado parece no coincidir con el Plan de Estudios. Por favor revise el aviso superior.");
                    } else {
                        alert("¡Historial académico cargado y verificado exitosamente!");
                    }
                } else {
                    alert("Error al procesar el historial: " + data.error);
                }
            } catch (err) {
                alert("Error al subir el archivo de historial: " + err);
            }
        }
    });

    const planInput = document.getElementById('plan-file-input');
    planInput.addEventListener('change', async (e) => {
        if (e.target.files.length > 0) {
            const formData = new FormData();
            formData.append('file', e.target.files[0]);

            try {
                const response = await fetch('/api/upload-plan', {
                    method: 'POST',
                    body: formData
                });
                const data = await response.json();
                if (data.success) {
                    state.planCycles = data.plan_cycles;
                    state.compatibility = data.compatibility;
                    state.isEmpty = false;
                    renderAll();
                    
                    if (data.compatibility && !data.compatibility.is_compatible) {
                        alert("⚠️ Advertencia: El Plan de Estudios cargado no coincide con la carrera del Historial Académico. Por favor revise el aviso superior.");
                    } else {
                        alert("¡Plan de estudios cargado y verificado exitosamente!");
                    }
                } else {
                    alert("Error al procesar el plan: " + data.error);
                }
            } catch (err) {
                alert("Error al subir el archivo de plan de estudios: " + err);
            }
        }
    });
}
