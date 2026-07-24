// pdf-parser.js - Client side PDF parsing using PDF.js

function cleanPdfText(text) {
    if (!text) return "";
    text = text.replace(/\x00/g, '').replace(/\r/g, '');
    text = text.replace(/[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]/g, '-');
    return text;
}

function parseCourseCodeName(asigStr) {
    asigStr = cleanPdfText(asigStr.trim());
    asigStr = asigStr.replace(/^[-\s]+/, '');
    
    let parts = asigStr.split(/\s*-\s*(.+)/);
    if (parts.length >= 2 && /^[A-Za-z0-9]{3,12}$/.test(parts[0].trim())) {
        return [parts[0].trim(), parts[1].trim()];
    }
    
    let m = asigStr.match(/^([A-Za-z0-9]{3,12})\s*-\s*(.*)$/);
    if (m) return [m[1].trim(), m[2].trim()];
    
    let m2 = asigStr.match(/^([A-Za-z0-9]{5,12})\s+(.*)$/);
    if (m2) return [m2[1].trim(), m2[2].trim()];

    return ["", asigStr];
}

function extractHeaderMetadata(textLines) {
    let meta = { student_code: '', student_name: '', facultad: '', escuela: '', plan: '' };
    for (const line of textLines) {
        let line_s = line.trim();
        if ((line_s.includes('Código de Matrícula') || line_s.includes('Cdigo de Matrcula')) && line_s.includes(':')) {
            meta.student_code = line_s.split(':', 2)[1].trim();
        } else if (line_s.includes('Nombres y Apellidos') && line_s.includes(':')) {
            meta.student_name = line_s.split(':', 2)[1].trim();
        } else if (line_s.includes('Facultad') && line_s.includes(':')) {
            meta.facultad = line_s.split(':', 2)[1].trim();
        } else if (line_s.includes('Escuela') && line_s.includes(':')) {
            meta.escuela = line_s.split(':', 2)[1].trim();
        } else if (line_s.includes('Plan') && line_s.includes(':') && (line_s.includes('Plan De') || line_s.includes('202'))) {
            meta.plan = line_s.split(':', 2)[1].trim();
        }
    }
    return meta;
}

function extractCourseCodeFromActa(actaStr) {
    if (!actaStr) return "";
    let m_alpha = actaStr.match(/([A-Za-z]{3,6}\d{3})/);
    if (m_alpha) return m_alpha[1].toUpperCase();
    
    let m_num9 = actaStr.match(/20230(\d{9})/);
    if (m_num9) return m_num9[1];
    
    let m_course9 = actaStr.match(/\b(203\d{6}|\d{9})\b/);
    if (m_course9) {
        let found = m_course9[1];
        if (!found.startsWith('2024') && !found.startsWith('2025') && !found.startsWith('2026')) {
            return found;
        }
    }
    return "";
}

async function getPdfLines(pdfUrlOrData) {
    const loadingTask = pdfjsLib.getDocument(pdfUrlOrData);
    const pdf = await loadingTask.promise;
    
    let allLines = [];
    let isFirstPage = true;
    let metadataLines = [];
    
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let itemsByY = {};
        for (const item of textContent.items) {
            let y = Math.round(item.transform[5]);
            if (!itemsByY[y]) itemsByY[y] = [];
            itemsByY[y].push(item);
        }
        
        let yKeys = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
        let pageLines = [];
        
        for (const y of yKeys) {
            let items = itemsByY[y];
            items.sort((a, b) => a.transform[4] - b.transform[4]);
            
            let lineStr = "";
            let lastX = null;
            for (const it of items) {
                if (lastX !== null && (it.transform[4] - lastX) > 10) {
                    lineStr += " ";
                }
                lineStr += it.str;
                lastX = it.transform[4] + it.width;
            }
            pageLines.push(cleanPdfText(lineStr.trim()));
        }
        
        if (isFirstPage) {
            metadataLines = [...pageLines];
            isFirstPage = false;
        }
        allLines = allLines.concat(pageLines);
    }
    return { lines: allLines, metadataLines };
}

window.parseHistorialFile = async function(file) {
    const arrayBuffer = await file.arrayBuffer();
    const { lines, metadataLines } = await getPdfLines(arrayBuffer);
    
    let periods = [];
    let current_period = null;
    let resumen = {
        required_credits: 221.0, approved_credits: 0.0, obligatorios: 0.0, especialidad: 0.0,
        electivos_generales: 0.0, electivos_especialidad: 0.0, optativos: 0.0, alternativos: 0.0,
        otra_especialidad: 0.0, mas_de_una_vez: 0.0, otros: 0.0, missing_credits: 221.0, ppg: 0.0
    };
    
    let metadata = extractHeaderMetadata(metadataLines);

    for (const l of lines) {
        let l_str = l.trim();
        let nums;
        if (l_str.includes('Creditaje Requerido para Egresar')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.required_credits = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Creditaje Apobrado') || l_str.includes('Creditaje Aprobado')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.approved_credits = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Obligatorios') && !l_str.includes('Creditaje')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.obligatorios = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('De Especialidad')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.especialidad = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Electivos Generales')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.electivos_generales = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Electivos de Especialidad')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.electivos_especialidad = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Optativos')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.optativos = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Alternativos')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.alternativos = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('De Otra Especialidad')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.otra_especialidad = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Más de una vez') || l_str.includes('Ms de una vez')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.mas_de_una_vez = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Otros')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.otros = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Creditaje Faltante')) {
            nums = l_str.match(/\d+\.?\d*/g); if (nums) resumen.missing_credits = parseFloat(nums[nums.length-1]);
        } else if (l_str.includes('Promedio Ponderado') && !l_str.includes('General')) {
            nums = l_str.match(/\d+\.\d+/g); if (nums) resumen.ppg = parseFloat(nums[nums.length-1]);
        }
    }

    let pending_course = null;
    let last_added_course = null;
    let unbound_course_header = null;

    for (let line of lines) {
        let line_s = line.replace(/\s+/g, ' ').trim();
        if (!line_s) continue;

        let m_period = line_s.match(/Periodo Acad[eé]mico\s+(\d{4}-\d)/i);
        if (m_period) {
            let p_name = m_period[1];
            current_period = periods.find(p => p.period === p_name);
            if (!current_period) {
                current_period = { period: p_name, courses: [] };
                periods.push(current_period);
            }
            pending_course = null;
            last_added_course = null;
            unbound_course_header = null;
            continue;
        }

        if (!current_period) continue;

        let m_start = line_s.match(/^(\d+)\s+(\d{4})\s+([OEΟ])(?:\s+(.*))?$/);
        if (m_start) {
            let ciclo = m_start[1];
            let plan = m_start[2];
            let tipo = m_start[3];
            let rest = (m_start[4] || '').trim();

            if (unbound_course_header) {
                rest = (unbound_course_header + " " + rest).trim();
                unbound_course_header = null;
            }

            let m_end = rest ? rest.match(/(?:(\d{1,2})\s+)?(\d+\.\d)\s+(\d+)\s+([PA]\s*-\s*\S+)$/) : null;
            if (m_end) {
                let calif = m_end[1];
                let cred = m_end[2];
                let sec = m_end[3];
                let acta = m_end[4];
                let asig = rest.slice(0, m_end.index).trim().replace(/\s+/g, ' ');
                let calif_val = calif ? parseInt(calif) : null;
                
                let [code, name] = parseCourseCodeName(asig);
                if (!code && acta) code = extractCourseCodeFromActa(acta);

                sec = sec || '1';
                let c_id = `${current_period.period}_${code}_${sec}`;
                let existing = current_period.courses.find(c => c.id === c_id);
                if (!existing) {
                    let new_c = {
                        id: c_id, ciclo: parseInt(ciclo), plan: plan, tipo: tipo,
                        codigo: code, nombre: name, asignatura_full: asig,
                        calificacion: calif_val, creditos: parseFloat(cred), seccion: sec, acta: acta,
                        ep: calif_val !== null ? calif_val : 0,
                        ec: calif_val !== null ? calif_val : 0,
                        ef: calif_val !== null ? calif_val : 0,
                        en_curso: calif_val === null, user_edited: false
                    };
                    current_period.courses.push(new_c);
                    last_added_course = new_c;
                } else {
                    last_added_course = existing;
                }
                pending_course = null;
            } else {
                pending_course = { period: current_period, ciclo: parseInt(ciclo), plan: plan, tipo: tipo, prefix: rest };
                last_added_course = null;
            }
        } else if (pending_course) {
            let m_end = line_s.match(/(?:(\d{1,2})\s+)?(\d+\.\d)\s+(\d+)\s+([PA]\s*-\s*\S+)$/);
            if (m_end) {
                let calif = m_end[1];
                let cred = m_end[2];
                let sec = m_end[3];
                let acta = m_end[4];
                
                let suffix = line_s.slice(0, m_end.index).trim();
                let full_asig = (pending_course.prefix + " " + suffix).trim().replace(/\s+/g, ' ');
                let calif_val = calif ? parseInt(calif) : null;
                
                let [code, name] = parseCourseCodeName(full_asig);
                if (!code && acta) code = extractCourseCodeFromActa(acta);

                let target_period = pending_course.period;
                let c_id = `${target_period.period}_${code}_${sec}`;
                let existing = target_period.courses.find(c => c.id === c_id);
                if (!existing) {
                    let new_c = {
                        id: c_id, ciclo: pending_course.ciclo, plan: pending_course.plan, tipo: pending_course.tipo,
                        codigo: code, nombre: name, asignatura_full: full_asig,
                        calificacion: calif_val, creditos: parseFloat(cred), seccion: sec, acta: acta,
                        ep: calif_val !== null ? calif_val : 0,
                        ec: calif_val !== null ? calif_val : 0,
                        ef: calif_val !== null ? calif_val : 0,
                        en_curso: calif_val === null, user_edited: false
                    };
                    target_period.courses.push(new_c);
                    last_added_course = new_c;
                } else {
                    last_added_course = existing;
                }
                pending_course = null;
            } else {
                pending_course.prefix = (pending_course.prefix + " " + line_s).trim();
            }
        } else {
            let has_course_code = /(?:^[A-Za-z0-9]{3,12}\s*-\s*|^\d{9}\s*-\s*)/.test(line_s);
            let is_metadata = ['Página', 'Documento Verificable', 'Ciclo Plan', 'Creditaje', 'Resumen', 'Periodo'].some(k => line_s.includes(k));

            if (has_course_code && !is_metadata) {
                unbound_course_header = line_s;
                last_added_course = null;
            } else if (last_added_course) {
                if (!is_metadata) {
                    let full_asig = (last_added_course.asignatura_full + " " + line_s).trim().replace(/\s+/g, ' ');
                    let [code, name] = parseCourseCodeName(full_asig);
                    let full_code = code || (last_added_course.codigo || '');
                    let full_name = name || full_asig;
                    last_added_course.asignatura_full = full_asig;
                    if (full_code) last_added_course.codigo = full_code;
                    if (full_name) last_added_course.nombre = full_name;
                }
                last_added_course = null;
            }
        }
    }

    return { periods, resumen, metadata };
};

window.parsePlanFile = async function(file) {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument(arrayBuffer);
    const pdf = await loadingTask.promise;
    
    let cycles = {};
    let metadata = {};
    let current_detected_cycle = 1;
    let isFirstPage = true;

    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        
        let itemsByY = {};
        for (const item of textContent.items) {
            let y = Math.round(item.transform[5] / 2) * 2;
            if (!itemsByY[y]) itemsByY[y] = [];
            itemsByY[y].push(item);
        }
        
        let yKeys = Object.keys(itemsByY).map(Number).sort((a, b) => b - a);
        let pageLines = [];
        
        for (const y of yKeys) {
            let items = itemsByY[y];
            items.sort((a, b) => a.transform[4] - b.transform[4]);
            
            let cols = [];
            let currentCol = "";
            let lastX = null;
            
            for (const it of items) {
                if (lastX !== null && (it.transform[4] - lastX) > 15) {
                    cols.push(currentCol.trim());
                    currentCol = "";
                } else if (lastX !== null && (it.transform[4] - lastX) > 3) {
                    currentCol += " ";
                }
                currentCol += it.str;
                lastX = it.transform[4] + it.width;
            }
            if (currentCol) cols.push(currentCol.trim());
            
            let fullStr = cleanPdfText(cols.join("   "));
            pageLines.push(fullStr);
            
            if (cols.length >= 4) {
                let row_str_full = fullStr;
                if (row_str_full.includes('Esp.') && row_str_full.includes('Asignatura')) continue;
                
                let esp = cleanPdfText(cols[0]);
                let asig_str = cleanPdfText(cols[1]).replace(/\n/g, ' ');
                let cred_str = cleanPdfText(cols[2]);
                let tipo_str = cleanPdfText(cols[3]);
                let grupo_str = cols.length > 4 ? cleanPdfText(cols[4]) : '--';
                let prereq_str = cols.length > 5 ? cleanPdfText(cols[5]).replace(/\n/g, ' ').replace(/\s+/g, ' ') : '--';
                
                let cred = parseFloat(cred_str);
                if (!asig_str || !cred_str || isNaN(cred)) continue;
                
                let [code, name] = parseCourseCodeName(asig_str);
                let c_num = current_detected_cycle;
                
                let m_code_cycle = code.match(/\d{5}(\d{2})\d{2}/);
                if (m_code_cycle) {
                    let parsed_c = parseInt(m_code_cycle[1]);
                    if (parsed_c >= 1 && parsed_c <= 12) {
                        c_num = parsed_c;
                        current_detected_cycle = c_num;
                    }
                } else if (code.startsWith('INE0') || code.startsWith('INO1')) {
                    c_num = 1;
                } else if (code.startsWith('INO2')) {
                    c_num = 2;
                }
                
                if (!cycles[c_num]) cycles[c_num] = [];
                
                cycles[c_num].push({
                    esp: !isNaN(parseInt(esp)) ? parseInt(esp) : 0,
                    codigo: code || '--',
                    nombre: name,
                    asignatura_full: asig_str,
                    creditos: cred,
                    tipo: tipo_str,
                    grupo: grupo_str || '--',
                    prerequisito: prereq_str || '--'
                });
            }
        }
        
        if (isFirstPage) {
            metadata = extractHeaderMetadata(pageLines);
            isFirstPage = false;
        }
    }

    return { cycles, metadata };
};
