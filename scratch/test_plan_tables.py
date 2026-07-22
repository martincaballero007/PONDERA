import pdfplumber
import re

def clean_str(s):
    if not s:
        return ""
    s = s.replace('\x00', '').replace('\n', ' ').strip()
    return s

def parse_plan_perfect_tables(pdf_file_or_path):
    cycles = {}
    
    with pdfplumber.open(pdf_file_or_path) as pdf:
        for page in pdf.pages:
            text = (page.extract_text() or "").replace('\x00', '')
            tables = page.extract_tables()
            
            # Find cycle markers on the page
            cycle_matches = list(re.finditer(r'CICLO\s+(\d+)', text, re.IGNORECASE))
            
            for table in tables:
                for row in table:
                    if not row or len(row) < 4:
                        continue
                    if row[0] == 'Esp.' or 'Asignatura' in row[1]:
                        continue
                    
                    esp = clean_str(row[0])
                    asig_str = clean_str(row[1])
                    cred_str = clean_str(row[2])
                    tipo_str = clean_str(row[3])
                    grupo_str = clean_str(row[4]) if len(row) > 4 else '--'
                    prereq_str = clean_str(row[5]) if len(row) > 5 else '--'
                    
                    if not asig_str or not cred_str:
                        continue
                    
                    try:
                        cred = float(cred_str)
                    except ValueError:
                        continue
                    
                    # Split code and name
                    parts = asig_str.split(' - ', 1)
                    if len(parts) == 2:
                        code, name = parts[0].strip(), parts[1].strip()
                    else:
                        code, name = "", asig_str.strip()

                    # Deduce cycle from code or cycle markers
                    c_num = 1
                    # In UNMSM codes like 203230301, 5th digit after prefix indicates cycle (e.g. 20323 03 01 -> 3, 20323 04 01 -> 4, 20323 05 01 -> 5, 20323 10 01 -> 10)
                    m_code_cycle = re.search(r'20323(\d{2})\d{2}', code)
                    if m_code_cycle:
                        c_num = int(m_code_cycle.group(1))
                    elif code.startswith('INE0') or code.startswith('INO1'):
                        c_num = 1
                    elif code.startswith('INO2'):
                        c_num = 2
                    
                    if c_num not in cycles:
                        cycles[c_num] = []
                    
                    cycles[c_num].append({
                        'esp': int(esp) if esp.isdigit() else 0,
                        'codigo': code,
                        'nombre': name,
                        'asignatura_full': asig_str,
                        'creditos': cred,
                        'tipo': tipo_str,
                        'grupo': grupo_str or '--',
                        'prerequisito': prereq_str or '--'
                    })
                    
    return cycles

if __name__ == '__main__':
    cycles = parse_plan_perfect_tables('Plan-Estudios.pdf')
    for cnum in sorted(cycles.keys()):
        print(f"\n=== CICLO {cnum} ({len(cycles[cnum])} courses) ===")
        for c in cycles[cnum][:3]:
            print(f"  code: '{c['codigo']}' | name: '{c['nombre']}' | prereq: '{c['prerequisito']}'")
