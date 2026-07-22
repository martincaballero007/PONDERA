import os
import math
from flask import Flask, render_template, request, jsonify
from pdf_parser import parse_historial_file, parse_plan_file, calculate_course_grade

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024

def enrich_historial_with_plan(periods, plan_cycles):
    if not plan_cycles or not periods:
        return periods
    
    plan_map = {}
    for cnum, courses in plan_cycles.items():
        for c in courses:
            c_code = c.get('codigo')
            c_name = c.get('nombre') or c.get('asignatura_full')
            if c_code and c_code != '--' and c_name:
                plan_map[c_code] = c_name
    
    for p in periods:
        for c in p.get('courses', []):
            code = c.get('codigo')
            if code and code in plan_map:
                official_name = plan_map[code]
                c['nombre'] = official_name
                c['asignatura_full'] = f"{code} - {official_name}"

    return periods

def validate_document_compatibility(historial_meta, plan_meta, periods_data, plan_cycles):
    hist_codes = set()
    for p in periods_data:
        for c in p.get('courses', []):
            code = c.get('codigo')
            if code and code != '--':
                hist_codes.add(code)
                
    plan_codes = set()
    for cnum, courses in plan_cycles.items():
        for c in courses:
            code = c.get('codigo')
            if code and code != '--':
                plan_codes.add(code)
                
    if len(hist_codes) == 0 or len(plan_codes) == 0:
        return {
            'is_compatible': True,
            'match_percentage': 100.0,
            'matching_courses_count': 0,
            'total_historial_courses': len(hist_codes),
            'reasons': [],
            'historial_meta': historial_meta or {},
            'plan_meta': plan_meta or {}
        }

    overlap = hist_codes.intersection(plan_codes)
    match_pct = (len(overlap) / len(hist_codes) * 100) if len(hist_codes) > 0 else 100.0
    
    school_match = True
    hist_escuela = (historial_meta or {}).get('escuela', '').strip()
    plan_escuela = (plan_meta or {}).get('escuela', '').strip()
    
    if hist_escuela and plan_escuela:
        school_match = (hist_escuela.lower() == plan_escuela.lower())
        
    mismatch = False
    reasons = []
    
    if not school_match:
        mismatch = True
        reasons.append(f"Incompatibilidad de Carrera: El Historial pertenece a '{hist_escuela}', mientras que el Plan pertenece a '{plan_escuela}'.")
        
    if match_pct < 40.0 and len(hist_codes) > 0:
        mismatch = True
        reasons.append(f"Baja coincidencia de cursos: Solo {len(overlap)} de {len(hist_codes)} asignaturas del Historial existen en el Plan de Estudios ({match_pct:.1f}% de coincidencia).")
        
    return {
        'is_compatible': not mismatch,
        'match_percentage': round(match_pct, 1),
        'matching_courses_count': len(overlap),
        'total_historial_courses': len(hist_codes),
        'reasons': reasons,
        'historial_meta': historial_meta,
        'plan_meta': plan_meta
    }

def compute_all_ponderados(periods_data, base_resumen=None):
    total_weighted_points = 0.0
    total_evaluated_credits = 0.0

    chart_periods = []
    chart_ppcs = []

    # Map to track unique approved courses globally for Approved Credit KPIs (92.0 cr)
    unique_approved_courses = {}

    for period in periods_data:
        p_name = period.get('period', '')
        courses = period.get('courses', [])
        
        # 1. Calculate grade for each course entry
        for c in courses:
            user_edited = c.get('user_edited', False)
            en_curso = c.get('en_curso', False)
            
            ep = int(c.get('ep', 0))
            ec = int(c.get('ec', 0))
            ef = int(c.get('ef', 0))
            
            exact, rounded = calculate_course_grade(ep, ec, ef)
            c['ep'] = ep
            c['ec'] = ec
            c['ef'] = ef
            c['exact_grade'] = round(exact, 2)
            if not (en_curso and not user_edited and ep == 0 and ec == 0 and ef == 0):
                c['calificacion'] = rounded

        # 2. Deduplicate attempts WITHIN THE SAME PERIOD (Aplazados vs Regular in same cycle)
        best_indices_in_period = set()
        course_best_map = {}
        for idx, c in enumerate(courses):
            if c.get('calificacion') is None:
                continue
            code_key = (c.get('codigo') or c.get('nombre') or f"c_{idx}").strip()
            grade = c['calificacion']
            acta = c.get('acta', '')
            is_aplazado = 'A' in acta[:2] or 'A -' in acta or 'A-' in acta

            if code_key not in course_best_map:
                course_best_map[code_key] = (grade, is_aplazado, idx)
            else:
                ex_grade, ex_aplazado, ex_idx = course_best_map[code_key]
                if (grade >= 11 and ex_grade < 11) or (grade > ex_grade) or (grade == ex_grade and is_aplazado):
                    course_best_map[code_key] = (grade, is_aplazado, idx)

        for key, val in course_best_map.items():
            best_indices_in_period.add(val[2])

        period_weighted_points = 0.0
        period_evaluated_credits = 0.0
        
        for idx, c in enumerate(courses):
            rounded = c.get('calificacion')
            cred = float(c.get('creditos', 0.0))
            
            if rounded is None:
                continue

            if idx in best_indices_in_period:
                c['evaluated_in_ppc'] = True
                period_weighted_points += rounded * cred
                period_evaluated_credits += cred

                # Track unique approved course globally for credit category breakdown (92.0 cr)
                if rounded >= 11:
                    code_key = (c.get('codigo') or c.get('nombre') or f"c_{idx}").strip()
                    if code_key not in unique_approved_courses or rounded > unique_approved_courses[code_key]['calificacion']:
                        unique_approved_courses[code_key] = {
                            'calificacion': rounded,
                            'creditos': cred,
                            'tipo': c.get('tipo', 'O')
                        }
            else:
                c['evaluated_in_ppc'] = False
        
        if period_evaluated_credits > 0:
            ppc = round(period_weighted_points / period_evaluated_credits, 3)
            period['ppc'] = ppc
            period['evaluated_credits'] = period_evaluated_credits
            total_weighted_points += period_weighted_points
            total_evaluated_credits += period_evaluated_credits
            chart_periods.append(p_name)
            chart_ppcs.append(ppc)
        else:
            period['ppc'] = None
            period['evaluated_credits'] = 0.0

    # Track evaluated courses (best attempt per course globally, taking highest approved grade or latest attempt)
    eval_courses = {}
    for period in periods_data:
        for idx, c in enumerate(period.get('courses', [])):
            if c.get('evaluated_in_ppc') and c.get('calificacion') is not None:
                code_key = (c.get('codigo') or c.get('nombre') or f"c_{idx}").strip()
                grade = c['calificacion']
                cred = float(c.get('creditos', 0.0))
                tipo = c.get('tipo', 'O')
                
                if code_key not in eval_courses:
                    eval_courses[code_key] = {'calificacion': grade, 'creditos': cred, 'tipo': tipo}
                else:
                    if grade > eval_courses[code_key]['calificacion']:
                        eval_courses[code_key] = {'calificacion': grade, 'creditos': cred, 'tipo': tipo}

    pts_total = 0.0
    cr_total = 0.0
    approved_credits = 0.0
    
    cat_credits = {
        'obligatorios': 0.0, 'especialidad': 0.0, 'electivos_generales': 0.0,
        'electivos_especialidad': 0.0, 'optativos': 0.0, 'alternativos': 0.0,
        'otra_especialidad': 0.0, 'mas_de_una_vez': 0.0, 'otros': 0.0
    }

    for code_key, c_info in eval_courses.items():
        grade = c_info['calificacion']
        cr = c_info['creditos']
        t = c_info['tipo']

        pts_total += grade * cr
        cr_total += cr

        if grade >= 11:
            approved_credits += cr
            if t == 'E':
                cat_credits['electivos_generales'] += cr
            elif t == 'O' or t == 'Ο':
                cat_credits['obligatorios'] += cr
            else:
                cat_credits['otros'] += cr

    required = float(base_resumen.get('required_credits', 221.0)) if base_resumen and base_resumen.get('required_credits') else 221.0
    obligatorios = cat_credits['obligatorios']
    electivos_generales = cat_credits['electivos_generales']
    missing_credits = max(0.0, required - approved_credits) if required > 0 else 0.0
    ppg = round(pts_total / cr_total, 3) if cr_total > 0 else 0.0

    resumen = {
        'required_credits': required,
        'approved_credits': approved_credits,
        'obligatorios': obligatorios,
        'especialidad': float(base_resumen.get('especialidad', 0.0)) if base_resumen else 0.0,
        'electivos_generales': electivos_generales,
        'electivos_especialidad': float(base_resumen.get('electivos_especialidad', 0.0)) if base_resumen else 0.0,
        'optativos': float(base_resumen.get('optativos', 0.0)) if base_resumen else 0.0,
        'alternativos': float(base_resumen.get('alternativos', 0.0)) if base_resumen else 0.0,
        'otra_especialidad': float(base_resumen.get('otra_especialidad', 0.0)) if base_resumen else 0.0,
        'mas_de_una_vez': float(base_resumen.get('mas_de_una_vez', 0.0)) if base_resumen else 0.0,
        'otros': float(base_resumen.get('otros', 0.0)) if base_resumen else 0.0,
        'missing_credits': missing_credits,
        'ppg': ppg
    }

    chart_data = {
        'labels': chart_periods,
        'values': chart_ppcs
    }

    return periods_data, resumen, chart_data


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/initial-data', methods=['GET'])
def get_initial_data():
    empty_resumen = {
        'required_credits': 0.0,
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
        'missing_credits': 0.0,
        'ppg': 0.0
    }
    return jsonify({
        'success': True,
        'is_empty': True,
        'periods': [],
        'resumen': empty_resumen,
        'chart_data': {'labels': [], 'values': []},
        'plan_cycles': {},
        'compatibility': {'is_compatible': True, 'reasons': []}
    })


@app.route('/api/upload-historial', methods=['POST'])
def upload_historial():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    try:
        periods, raw_resumen, historial_meta = parse_historial_file(file)
        periods, resumen, chart_data = compute_all_ponderados(periods, raw_resumen)
        
        compat_info = validate_document_compatibility(historial_meta, {}, periods, {})

        return jsonify({
            'success': True,
            'is_empty': False,
            'periods': periods,
            'resumen': resumen,
            'chart_data': chart_data,
            'historial_meta': historial_meta,
            'compatibility': compat_info
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/upload-plan', methods=['POST'])
def upload_plan():
    if 'file' not in request.files:
        return jsonify({'success': False, 'error': 'No file uploaded'}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({'success': False, 'error': 'Empty filename'}), 400

    try:
        plan_cycles, plan_meta = parse_plan_file(file)
        compat_info = validate_document_compatibility({}, plan_meta, [], plan_cycles)

        return jsonify({
            'success': True,
            'is_empty': False,
            'plan_cycles': plan_cycles,
            'plan_meta': plan_meta,
            'compatibility': compat_info
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/recalculate', methods=['POST'])
def recalculate():
    try:
        data = request.json or {}
        periods = data.get('periods', [])
        base_resumen = data.get('resumen', {})
        plan_cycles = data.get('plan_cycles', {})
        
        if plan_cycles:
            periods = enrich_historial_with_plan(periods, plan_cycles)
            
        periods, resumen, chart_data = compute_all_ponderados(periods, base_resumen)
        
        return jsonify({
            'success': True,
            'periods': periods,
            'resumen': resumen,
            'chart_data': chart_data
        })
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    debug_mode = os.environ.get('FLASK_ENV') == 'development'
    print(f"Starting Pondera Flask Web Server on port {port} (debug={debug_mode})")
    app.run(host='0.0.0.0', port=port, debug=debug_mode)
