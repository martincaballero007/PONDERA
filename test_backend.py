import os
from pdf_parser import parse_historial_file, parse_plan_file, calculate_course_grade

def test_parser():
    print("Testing parse_historial_file...")
    periods, resumen = parse_historial_file("historial-academico.pdf")
    assert len(periods) > 0, "Periods should not be empty"
    print(f"Parsed {len(periods)} periods successfully.")
    
    print("\nTesting parse_plan_file...")
    cycles = parse_plan_file("Plan-Estudios.pdf")
    assert len(cycles) > 0, "Plan cycles should not be empty"
    print(f"Parsed {len(cycles)} plan cycles successfully.")
    
    print("\nTesting grade rounding...")
    exact, rounded = calculate_course_grade(10, 11, 10) # 0.3(10)+0.4(11)+0.3(10) = 3 + 4.4 + 3 = 10.4 -> 10
    assert rounded == 10, f"Expected 10, got {rounded}"
    
    exact2, rounded2 = calculate_course_grade(10, 11, 11) # 0.3(10)+0.4(11)+0.3(11) = 3 + 4.4 + 3.3 = 10.7 -> 11
    assert rounded2 == 11, f"Expected 11, got {rounded2}"
    print("Grade calculation tests passed!")

if __name__ == '__main__':
    test_parser()
