// calculator.js - Ported from app.py calculation logic

window.calculateCourseGrade = function(ep, ec, ef) {
    ep = Math.max(0, Math.min(20, parseInt(ep) || 0));
    ec = Math.max(0, Math.min(20, parseInt(ec) || 0));
    ef = Math.max(0, Math.min(20, parseInt(ef) || 0));
    
    let exact = 0.30 * ep + 0.40 * ec + 0.30 * ef;
    let rounded = Math.floor(exact + 0.5);
    return { exact, rounded };
};

window.enrichHistorialWithPlan = function(periods, planCycles) {
    if (!planCycles || Object.keys(planCycles).length === 0 || !periods || periods.length === 0) {
        return periods;
    }
    
    let planMap = {};
    for (const [cnum, courses] of Object.entries(planCycles)) {
        for (const c of courses) {
            let cCode = c.codigo;
            let cName = c.nombre || c.asignatura_full;
            if (cCode && cCode !== '--' && cName) {
                planMap[cCode] = cName;
            }
        }
    }
    
    for (const p of periods) {
        let courses = p.courses || [];
        for (const c of courses) {
            let code = c.codigo;
            if (code && planMap[code]) {
                let officialName = planMap[code];
                c.nombre = officialName;
                c.asignatura_full = `${code} - ${officialName}`;
            }
        }
    }

    return periods;
};

window.validateDocumentCompatibility = function(historialMeta, planMeta, periodsData, planCycles) {
    let histCodes = new Set();
    for (const p of periodsData) {
        for (const c of p.courses || []) {
            let code = c.codigo;
            if (code && code !== '--') {
                histCodes.add(code);
            }
        }
    }
                
    let planCodes = new Set();
    for (const [cnum, courses] of Object.entries(planCycles || {})) {
        for (const c of courses) {
            let code = c.codigo;
            if (code && code !== '--') {
                planCodes.add(code);
            }
        }
    }
                
    if (histCodes.size === 0 || planCodes.size === 0) {
        return {
            is_compatible: true,
            match_percentage: 100.0,
            matching_courses_count: 0,
            total_historial_courses: histCodes.size,
            reasons: [],
            historial_meta: historialMeta || {},
            plan_meta: planMeta || {}
        };
    }

    let overlap = new Set([...histCodes].filter(x => planCodes.has(x)));
    let matchPct = histCodes.size > 0 ? (overlap.size / histCodes.size * 100) : 100.0;
    
    let schoolMatch = true;
    let histEscuela = (historialMeta || {}).escuela || '';
    let planEscuela = (planMeta || {}).escuela || '';
    
    if (histEscuela.trim() && planEscuela.trim()) {
        schoolMatch = (histEscuela.trim().toLowerCase() === planEscuela.trim().toLowerCase());
    }
        
    let mismatch = false;
    let reasons = [];
    
    if (!schoolMatch) {
        mismatch = true;
        reasons.push(`Incompatibilidad de Carrera: El Historial pertenece a '${histEscuela.trim()}', mientras que el Plan pertenece a '${planEscuela.trim()}'.`);
    }
        
    if (matchPct < 40.0 && histCodes.size > 0) {
        mismatch = true;
        reasons.push(`Baja coincidencia de cursos: Solo ${overlap.size} de ${histCodes.size} asignaturas del Historial existen en el Plan de Estudios (${matchPct.toFixed(1)}% de coincidencia).`);
    }
        
    return {
        is_compatible: !mismatch,
        match_percentage: Math.round(matchPct * 10) / 10,
        matching_courses_count: overlap.size,
        total_historial_courses: histCodes.size,
        reasons: reasons,
        historial_meta: historialMeta,
        plan_meta: planMeta
    };
};

window.computeAllPonderados = function(periodsData, baseResumen = null) {
    let totalWeightedPoints = 0.0;
    let totalEvaluatedCredits = 0.0;

    let chartPeriods = [];
    let chartPpcs = [];
    let uniqueApprovedCourses = {};

    for (const period of periodsData) {
        let pName = period.period || '';
        let courses = period.courses || [];
        
        for (const c of courses) {
            let userEdited = c.user_edited || false;
            let enCurso = c.en_curso || false;
            
            let ep = parseInt(c.ep) || 0;
            let ec = parseInt(c.ec) || 0;
            let ef = parseInt(c.ef) || 0;
            
            let grades = window.calculateCourseGrade(ep, ec, ef);
            let exact = grades.exact;
            let rounded = grades.rounded;
            
            c.ep = ep;
            c.ec = ec;
            c.ef = ef;
            c.exact_grade = Math.round(exact * 100) / 100;
            
            if (!(enCurso && !userEdited && ep === 0 && ec === 0 && ef === 0)) {
                c.calificacion = rounded;
            } else if (c.calificacion === undefined) {
                c.calificacion = null;
            }
        }

        let bestIndicesInPeriod = new Set();
        let courseBestMap = {};
        
        for (let idx = 0; idx < courses.length; idx++) {
            let c = courses[idx];
            if (c.calificacion === null || c.calificacion === undefined) continue;
            
            let codeKey = (c.codigo || c.nombre || `c_${idx}`).trim();
            let grade = c.calificacion;
            let acta = c.acta || '';
            let isAplazado = acta.startsWith('A') || acta.includes('A -') || acta.includes('A-');

            if (!courseBestMap[codeKey]) {
                courseBestMap[codeKey] = { grade, isAplazado, idx };
            } else {
                let existing = courseBestMap[codeKey];
                if ((grade >= 11 && existing.grade < 11) || (grade > existing.grade) || (grade === existing.grade && isAplazado)) {
                    courseBestMap[codeKey] = { grade, isAplazado, idx };
                }
            }
        }

        for (const val of Object.values(courseBestMap)) {
            bestIndicesInPeriod.add(val.idx);
        }

        let periodWeightedPoints = 0.0;
        let periodEvaluatedCredits = 0.0;
        
        for (let idx = 0; idx < courses.length; idx++) {
            let c = courses[idx];
            let rounded = c.calificacion;
            let cred = parseFloat(c.creditos) || 0.0;
            
            if (rounded === null || rounded === undefined) continue;

            if (bestIndicesInPeriod.has(idx)) {
                c.evaluated_in_ppc = true;
                periodWeightedPoints += rounded * cred;
                periodEvaluatedCredits += cred;

                if (rounded >= 11) {
                    let codeKey = (c.codigo || c.nombre || `c_${idx}`).trim();
                    if (!uniqueApprovedCourses[codeKey] || rounded > uniqueApprovedCourses[codeKey].calificacion) {
                        uniqueApprovedCourses[codeKey] = {
                            calificacion: rounded,
                            creditos: cred,
                            tipo: c.tipo || 'O'
                        };
                    }
                }
            } else {
                c.evaluated_in_ppc = false;
            }
        }
        
        if (periodEvaluatedCredits > 0) {
            let ppc = Math.round((periodWeightedPoints / periodEvaluatedCredits) * 1000) / 1000;
            period.ppc = ppc;
            period.evaluated_credits = periodEvaluatedCredits;
            totalWeightedPoints += periodWeightedPoints;
            totalEvaluatedCredits += periodEvaluatedCredits;
            chartPeriods.push(pName);
            chartPpcs.push(ppc);
        } else {
            period.ppc = null;
            period.evaluated_credits = 0.0;
        }
    }

    let evalCourses = {};
    for (const period of periodsData) {
        let courses = period.courses || [];
        for (let idx = 0; idx < courses.length; idx++) {
            let c = courses[idx];
            if (c.evaluated_in_ppc && c.calificacion !== null && c.calificacion !== undefined) {
                let codeKey = (c.codigo || c.nombre || `c_${idx}`).trim();
                let grade = c.calificacion;
                let cred = parseFloat(c.creditos) || 0.0;
                let tipo = c.tipo || 'O';
                
                if (!evalCourses[codeKey] || grade > evalCourses[codeKey].calificacion) {
                    evalCourses[codeKey] = { calificacion: grade, creditos: cred, tipo: tipo };
                }
            }
        }
    }

    let ptsTotal = 0.0;
    let crTotal = 0.0;
    let approvedCredits = 0.0;
    
    let catCredits = {
        obligatorios: 0.0, especialidad: 0.0, electivos_generales: 0.0,
        electivos_especialidad: 0.0, optativos: 0.0, alternativos: 0.0,
        otra_especialidad: 0.0, mas_de_una_vez: 0.0, otros: 0.0
    };

    for (const [codeKey, cInfo] of Object.entries(evalCourses)) {
        let grade = cInfo.calificacion;
        let cr = cInfo.creditos;
        let t = cInfo.tipo;

        ptsTotal += grade * cr;
        crTotal += cr;

        if (grade >= 11) {
            approvedCredits += cr;
            if (t === 'E') {
                catCredits.electivos_generales += cr;
            } else if (t === 'O' || t === 'Ο') {
                catCredits.obligatorios += cr;
            } else {
                catCredits.otros += cr;
            }
        }
    }

    let required = (baseResumen && baseResumen.required_credits) ? parseFloat(baseResumen.required_credits) : 221.0;
    let obligatorios = catCredits.obligatorios;
    let electivosGenerales = catCredits.electivos_generales;
    let missingCredits = required > 0 ? Math.max(0.0, required - approvedCredits) : 0.0;
    let ppg = crTotal > 0 ? Math.round((ptsTotal / crTotal) * 1000) / 1000 : 0.0;

    let resumen = {
        required_credits: required,
        approved_credits: approvedCredits,
        obligatorios: obligatorios,
        especialidad: baseResumen ? (parseFloat(baseResumen.especialidad) || 0.0) : 0.0,
        electivos_generales: electivosGenerales,
        electivos_especialidad: baseResumen ? (parseFloat(baseResumen.electivos_especialidad) || 0.0) : 0.0,
        optativos: baseResumen ? (parseFloat(baseResumen.optativos) || 0.0) : 0.0,
        alternativos: baseResumen ? (parseFloat(baseResumen.alternativos) || 0.0) : 0.0,
        otra_especialidad: baseResumen ? (parseFloat(baseResumen.otra_especialidad) || 0.0) : 0.0,
        mas_de_una_vez: baseResumen ? (parseFloat(baseResumen.mas_de_una_vez) || 0.0) : 0.0,
        otros: baseResumen ? (parseFloat(baseResumen.otros) || 0.0) : 0.0,
        missing_credits: missingCredits,
        ppg: ppg
    };

    let chartData = {
        labels: chartPeriods,
        values: chartPpcs
    };

    return { periodsData, resumen, chartData };
};
