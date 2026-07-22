import pdfplumber
import re
import math

def clean_pdf_text(text):
    if not text:
        return ""
    text = text.replace('\x00', '').replace('\r', '')
    # Normalize unicode dash variations (en-dash, em-dash, figure dash, etc.) to standard ASCII hyphen '-'
    text = re.sub(r'[\u2010\u2011\u2012\u2013\u2014\u2015\u2212]', '-', text)
    return text

def parse_course_code_name(asig_str):
    asig_str = clean_pdf_text(asig_str.strip())
    asig_str = re.sub(r'^[-\s]+', '', asig_str)
    
    # Try splitting by ' - ' or '-' with optional whitespace
    parts = re.split(r'\s*-\s*', asig_str, maxsplit=1)
    if len(parts) == 2 and re.match(r'^[A-Za-z0-9]{3,12}$', parts[0].strip()):
        return parts[0].strip(), parts[1].strip()
    
    m = re.match(r'^([A-Za-z0-9]{3,12})\s*-\s*(.*)$', asig_str)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    
    m2 = re.match(r'^([A-Za-z0-9]{5,12})\s+(.*)$', asig_str)
    if m2:
        return m2.group(1).strip(), m2.group(2).strip()

    return "", asig_str

def extract_header_metadata(text_lines):
    meta = {
        'student_code': '',
        'student_name': '',
        'facultad': '',
        'escuela': '',
        'plan': ''
    }
    for line in text_lines:
        line_s = line.strip()
        if ('Código de Matrícula' in line_s or 'Cdigo de Matrcula' in line_s) and ':' in line_s:
            parts = line_s.split(':', 1)
            meta['student_code'] = parts[1].strip()
        elif 'Nombres y Apellidos' in line_s and ':' in line_s:
            parts = line_s.split(':', 1)
            meta['student_name'] = parts[1].strip()
        elif 'Facultad' in line_s and ':' in line_s:
            parts = line_s.split(':', 1)
            meta['facultad'] = parts[1].strip()
        elif 'Escuela' in line_s and ':' in line_s:
            parts = line_s.split(':', 1)
            meta['escuela'] = parts[1].strip()
        elif 'Plan' in line_s and ':' in line_s and ('Plan De' in line_s or '202' in line_s):
            parts = line_s.split(':', 1)
            meta['plan'] = parts[1].strip()
    return meta

def parse_historial_file(pdf_file_or_path):
    """
    Parses an UNMSM Historial Académico PDF file.
    Returns (periods, resumen, metadata).
    """
    periods = []
    current_period = None
    resumen = {
        'required_credits': 221.0,
        'approved_credits': 0.0,
        'obligatorios': 0.0,
        'especialidad': 0.0,
        'electivos_generales': 0.0,
        'electivos_especialidad': 0.0,
        'optativos': 0.0,
        'alternativos': 0.0,
        'otra_especialidad': 0.0,
        'mas_de_una_vez': 0.0,
        'otros': 0.0,
        'missing_credits': 221.0,
        'ppg': 0.0
    }
    metadata = {}

    with pdfplumber.open(pdf_file_or_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            raw_text = page.extract_text() or ""
            text = clean_pdf_text(raw_text)
            lines = text.split('\n')
            
            if page_idx == 0:
                metadata = extract_header_metadata(lines)
            
            for l in lines:
                l_str = l.strip()
                if 'Creditaje Requerido para Egresar' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['required_credits'] = float(nums[-1])
                elif 'Creditaje Apobrado' in l_str or 'Creditaje Aprobado' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['approved_credits'] = float(nums[-1])
                elif 'Obligatorios' in l_str and 'Creditaje' not in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['obligatorios'] = float(nums[-1])
                elif 'De Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['especialidad'] = float(nums[-1])
                elif 'Electivos Generales' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['electivos_generales'] = float(nums[-1])
                elif 'Electivos de Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['electivos_especialidad'] = float(nums[-1])
                elif 'Optativos' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['optativos'] = float(nums[-1])
                elif 'Alternativos' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['alternativos'] = float(nums[-1])
                elif 'De Otra Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['otra_especialidad'] = float(nums[-1])
                elif 'Más de una vez' in l_str or 'Ms de una vez' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['mas_de_una_vez'] = float(nums[-1])
def parse_historial_file(pdf_file_or_path):
    """
    Parses an UNMSM Historial Académico PDF file.
    Returns (periods, resumen, metadata).
    """
    periods = []
    current_period = None
    resumen = {
        'required_credits': 221.0,
        'approved_credits': 0.0,
        'obligatorios': 0.0,
        'especialidad': 0.0,
        'electivos_generales': 0.0,
        'electivos_especialidad': 0.0,
        'optativos': 0.0,
        'alternativos': 0.0,
        'otra_especialidad': 0.0,
        'mas_de_una_vez': 0.0,
        'otros': 0.0,
        'missing_credits': 221.0,
        'ppg': 0.0
    }
    metadata = {}

    with pdfplumber.open(pdf_file_or_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            raw_text = page.extract_text() or ""
            text = clean_pdf_text(raw_text)
            lines = text.split('\n')
            
            if page_idx == 0:
                metadata = extract_header_metadata(lines)
            
            for l in lines:
                l_str = l.strip()
                if 'Creditaje Requerido para Egresar' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['required_credits'] = float(nums[-1])
                elif 'Creditaje Apobrado' in l_str or 'Creditaje Aprobado' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['approved_credits'] = float(nums[-1])
                elif 'Obligatorios' in l_str and 'Creditaje' not in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['obligatorios'] = float(nums[-1])
                elif 'De Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['especialidad'] = float(nums[-1])
                elif 'Electivos Generales' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['electivos_generales'] = float(nums[-1])
                elif 'Electivos de Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['electivos_especialidad'] = float(nums[-1])
                elif 'Optativos' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['optativos'] = float(nums[-1])
                elif 'Alternativos' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['alternativos'] = float(nums[-1])
                elif 'De Otra Especialidad' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['otra_especialidad'] = float(nums[-1])
                elif 'Más de una vez' in l_str or 'Ms de una vez' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['mas_de_una_vez'] = float(nums[-1])
                elif 'Otros' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['otros'] = float(nums[-1])
                elif 'Creditaje Faltante' in l_str:
                    nums = re.findall(r'\d+\.?\d*', l_str)
                    if nums: resumen['missing_credits'] = float(nums[-1])
                elif 'Promedio Ponderado' in l_str and 'General' not in l_str:
                    m = re.findall(r'\d+\.\d+', l_str)
                    if m: resumen['ppg'] = float(m[-1])

            pending_course = None

            for line in lines:
                line_s = line.strip()
                m_period = re.search(r'Periodo Acad[eé]mico\s+(\d{4}-\d)', line_s, re.IGNORECASE)
                if m_period:
                    p_name = m_period.group(1)
                    current_period = next((p for p in periods if p['period'] == p_name), None)
                    if not current_period:
                        current_period = {'period': p_name, 'courses': []}
                        periods.append(current_period)
                    pending_course = None
                    continue
                
                if not current_period:
                    continue

                m_start = re.match(r'^(\d+)\s+(\d{4})\s+([OEΟ])(?:\s+(.*))?$', line_s)
                if m_start:
                    ciclo, plan, tipo, rest = m_start.groups()
                    rest = (rest or '').strip()
                    # Strictly match standard UNMSM acta ending [PA]\s*-\s*\S+
                    m_end = re.search(r'(?:(\d{1,2})\s+)?(\d+\.\d)\s+(\d+)\s+([PA]\s*-\s*\S+)$', rest) if rest else None
                    if m_end:
                        calif, cred, sec, acta = m_end.groups()
                        asig = rest[:m_end.start()].strip()
                        calif_val = int(calif) if calif else None
                        code, name = parse_course_code_name(asig)

                        current_period['courses'].append({
                            'id': f"{p_name}_{code}_{sec}",
                            'ciclo': int(ciclo),
                            'plan': plan,
                            'tipo': tipo,
                            'codigo': code,
                            'nombre': name,
                            'asignatura_full': asig,
                            'calificacion': calif_val,
                            'creditos': float(cred),
                            'seccion': sec,
                            'acta': acta,
                            'ep': calif_val if calif_val is not None else 0,
                            'ec': calif_val if calif_val is not None else 0,
                            'ef': calif_val if calif_val is not None else 0,
                            'en_curso': (calif_val is None),
                            'user_edited': False
                        })
                        pending_course = None
                    else:
                        pending_course = {'ciclo': int(ciclo), 'plan': plan, 'tipo': tipo, 'prefix': rest}
                elif pending_course:
                    m_end = re.search(r'(?:(\d{1,2})\s+)?(\d+\.\d)\s+(\d+)\s+([PA]\s*-\s*\S+)$', line_s)
                    if m_end:
                        calif, cred, sec, acta = m_end.groups()
                        suffix = line_s[:m_end.start()].strip()
                        full_asig = (pending_course['prefix'] + " " + suffix).strip()
                        calif_val = int(calif) if calif else None
                        code, name = parse_course_code_name(full_asig)

                        current_period['courses'].append({
                            'id': f"{current_period['period']}_{code}_{sec}",
                            'ciclo': pending_course['ciclo'],
                            'plan': pending_course['plan'],
                            'tipo': pending_course['tipo'],
                            'codigo': code,
                            'nombre': name,
                            'asignatura_full': full_asig,
                            'calificacion': calif_val,
                            'creditos': float(cred),
                            'seccion': sec,
                            'acta': acta,
                            'ep': calif_val if calif_val is not None else 0,
                            'ec': calif_val if calif_val is not None else 0,
                            'ef': calif_val if calif_val is not None else 0,
                            'en_curso': (calif_val is None),
                            'user_edited': False
                        })
                        pending_course = None
                    else:
                        pending_course['prefix'] = (pending_course['prefix'] + " " + line_s).strip()

    return periods, resumen, metadata

    return periods, resumen, metadata

def parse_plan_file(pdf_file_or_path):
    """
    Parses an UNMSM Plan de Estudios PDF file.
    Returns (cycles, metadata).
    """
    cycles = {}
    metadata = {}
    current_detected_cycle = 1
    
    with pdfplumber.open(pdf_file_or_path) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            raw_text = page.extract_text() or ""
            text = clean_pdf_text(raw_text)
            lines = text.split('\n')
            
            if page_idx == 0:
                metadata = extract_header_metadata(lines)

            tables = page.extract_tables()
            
            for table in tables:
                for row in table:
                    if not row or len(row) < 4:
                        continue
                    row_str_full = " ".join([clean_pdf_text(str(cell or '')) for cell in row])
                    if 'Esp.' in row_str_full and 'Asignatura' in row_str_full:
                        continue
                    
                    esp = clean_pdf_text(str(row[0] or '')).strip()
                    asig_str = clean_pdf_text(str(row[1] or '')).replace('\n', ' ').strip()
                    cred_str = clean_pdf_text(str(row[2] or '')).strip()
                    tipo_str = clean_pdf_text(str(row[3] or '')).strip()
                    grupo_str = clean_pdf_text(str(row[4] or '')).strip() if len(row) > 4 else '--'
                    prereq_str = clean_pdf_text(str(row[5] or '')).replace('\n', ' ').strip() if len(row) > 5 else '--'
                    prereq_str = re.sub(r'\s+', ' ', prereq_str)
                    
                    if not asig_str or not cred_str:
                        continue
                    
                    try:
                        cred = float(cred_str)
                    except ValueError:
                        continue
                    
                    code, name = parse_course_code_name(asig_str)

                    c_num = current_detected_cycle
                    # Generic UNMSM 9-digit code regex: \d{5}(\d{2})\d{2} -> 6th and 7th digits are the cycle number!
                    m_code_cycle = re.search(r'\d{5}(\d{2})\d{2}', code)
                    if m_code_cycle:
                        parsed_c = int(m_code_cycle.group(1))
                        if 1 <= parsed_c <= 12:
                            c_num = parsed_c
                            current_detected_cycle = c_num
                    elif code.startswith('INE0') or code.startswith('INO1'):
                        c_num = 1
                    elif code.startswith('INO2'):
                        c_num = 2
                    
                    if c_num not in cycles:
                        cycles[c_num] = []
                    
                    cycles[c_num].append({
                        'esp': int(esp) if esp.isdigit() else 0,
                        'codigo': code or '--',
                        'nombre': name,
                        'asignatura_full': asig_str,
                        'creditos': cred,
                        'tipo': tipo_str,
                        'grupo': grupo_str or '--',
                        'prerequisito': prereq_str or '--'
                    })
                    
    return cycles, metadata

def calculate_course_grade(ep, ec, ef):
    ep = max(0, min(20, int(ep)))
    ec = max(0, min(20, int(ec)))
    ef = max(0, min(20, int(ef)))
    
    exact = 0.30 * ep + 0.40 * ec + 0.30 * ef
    rounded = math.floor(exact + 0.5)
    return exact, rounded
