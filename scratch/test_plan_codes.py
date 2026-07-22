import sys
sys.path.append('.')
from pdf_parser import parse_plan_file

cycles = parse_plan_file('Plan-Estudios.pdf')
for cnum, courses in cycles.items():
    print(f"\n=== CICLO {cnum} ===")
    for c in courses:
        print(f"  code: '{c['codigo']}' | name: '{c['nombre']}' | full: '{c['asignatura_full']}'")
