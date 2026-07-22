import pdfplumber
import re

def clean_text(text):
    if not text:
        return ""
    # Fix common PDF encoding artifact characters if present
    replacements = {
        '': 'Ñ',
        'CLCULO': 'CÁLCULO',
        'FSICA': 'FÍSICA',
        'QUMICA': 'QUÍMICA',
        'INTRODUCCIN': 'INTRODUCCIÓN',
        'INVESTIGACIN': 'INVESTIGACIÓN',
        'PROGRAMACIN': 'PROGRAMACIÓN',
        'TCNICAS': 'TÉCNICAS',
        'COMUNICACIN': 'COMUNICACIÓN',
        'MTODOS': 'MÉTODOS',
        'BIOLOGA': 'BIOLOGÍA',
        'INGENIERA': 'INGENIERÍA',
        'LGEBRA': 'ÁLGEBRA',
        'GEOMETRA': 'GEOMETRÍA',
        'INGENIERA': 'INGENIERÍA',
        'ECONMICA': 'ECONÓMICA',
        'PTICA': 'ÓPTICA',
        'ESTADSTICA': 'ESTADÍSTICA',
        'ANLISIS': 'ANÁLISIS',
        'NUMRICO': 'NUMÉRICO',
        'TEORA': 'TEORÍA',
        'DISEO': 'DISEÑO',
        'TPICOS': 'TÓPICOS',
        'ESTOCSTICOS': 'ESTOCÁSTICOS',
        'INTERACCIN': 'INTERACCIÓN',
        'GRAFICA': 'GRÁFICA',
        'HEURSTICAS': 'HEURÍSTICAS',
        'INNOVACIN': 'INNOVACIÓN',
        'TECNOLOGA': 'TECNOLOGÍA',
        'BIOINFORMTICA': 'BIOINFORMÁTICA',
        'BIOESTADSTICA': 'BIOESTADÍSTICA'
    }
    for k, v in replacements.items():
        text = text.replace(k, v)
    return text

def parse_course_code_name(asig_str):
    asig_str = clean_text(asig_str.strip())
    # Remove leading dashes or weird spaces
    asig_str = re.sub(r'^[-\s]+', '', asig_str)
    
    # Pattern 1: Code - Name (e.g., "INO101 - REDACCIÓN...")
    m = re.match(r'^([A-Z0-9]+)\s*-\s*(.*)$', asig_str)
    if m:
        return m.group(1).strip(), m.group(2).strip()
    
    # Pattern 2: Just Code or Just Name
    m2 = re.match(r'^([A-Z0-9]{5,10})\s+(.*)$', asig_str)
    if m2:
        return m2.group(1).strip(), m2.group(2).strip()
        
    return "", asig_str

if __name__ == '__main__':
    code, name = parse_course_code_name("203230301 - INTRODUCCIÓN A LA CIENCIA DE LA COMPUTACIÓN")
    print(f"Code: '{code}', Name: '{name}'")
