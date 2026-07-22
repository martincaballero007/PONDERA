# **Campos y Datos del Reporte de Plan de Estudios (UNMSM)**

En el documento del **Sistema Único de Matrícula (SUM)**, cada asignatura o curso dentro de un ciclo académico contiene la siguiente información organizada en columnas:

## **1\. Especialidad (Esp.)**

* **Descripción:** Indica el código numérico de la especialidad o mención a la que pertenece la asignatura.  
* **Valores comunes:**  
  * 0: Asignatura de la carrera base o del tronco común / Estudios Generales.

## **2\. Asignatura (Asignatura)**

* **Descripción:** Contiene la identificación única del curso. Combina el **código alfanumérico** oficial de la materia con su **nombre o denominación completa**.  
* **Ejemplos:**  
  * INE002-PROGRAMACIÓN Y COMPUTACIÓN  
  * INO104-CÁLCULO I  
  * 203230401-ALGORITMOS Y ESTRUCTURAS DE DATOS

## **3\. Créditos (Créd.)**

* **Descripción:** El valor o peso académico en créditos que otorga la materia al ser aprobada. Este valor determina su ponderación directa en el cálculo del Promedio Ponderado por Ciclo (PPC) y General (PPG).  
* **Ejemplos:** 2.0, 3.0, 4.0 o 10.0 (en el caso de Prácticas Preprofesionales).

## **4\. Tipo de Asignatura (Tipo)**

* **Descripción:** Clasificación de la materia según la estructura curricular del plan de estudios.  
* **Valores:**  
  * O / Ο: **Obligatorio** (Cursos indispensables para completar el plan).  
  * E: **Electivo** (Cursos elegibles dentro de un pool o grupo de opciones).

## **5\. Grupo (Grupo)**

* **Descripción:** Asignación o agrupación temática del curso, principalmente utilizada para clasificar los electivos.  
* **Ejemplos:**  
  * GEE: Grupo de Electivos Generales / Estudios Generales de Ingeniería.

## **6\. Pre-Requisito (Pre-Requisito)**

* **Descripción:** Indica la asignatura (o asignaturas) previa que el estudiante debe haber cursado y aprobado obligatoriamente para quedar habilitado para matricularse en dicho curso.  
* **Ejemplos:**  
  * Para **INO204-CÁLCULO II** el pre-requisito es INO104-CÁLCULO I.  
  * Para **203230401-ALGORITMOS Y ESTRUCTURAS DE DATOS** el pre-requisito es 203230302-PROGRAMACIÓN DE COMPUTADORAS I.  
  * Si la casilla está vacía, la asignatura no requiere prerrequisitos formales.

## **7\. Grupo del Pre-Requisito (Grupo)**

* **Descripción:** Columna secundaria asociada a la restricción o agrupación específica del requisito previo (por ejemplo, condicionales de sección o modalidad específica).  
* **Ejemplo:** Códigos de control interno del SUM como GAM o campos vacíos por defecto.

## **Resumen de la Estructura por Fila**

| Campo | Ejemplo en el Reporte | Interpretación |
| :---- | :---- | :---- |
| **Esp.** | 0 | Asignatura común / Estudios Generales |
| **Asignatura** | INO204-CÁLCULO II | Código INO204, Nombre *CÁLCULO II* |
| **Créd.** | 4.0 | Vale 4 créditos académicos |
| **Tipo** | O | Materia de carácter obligatorio |
| **Grupo** | *(vacío)* | No requiere grupo electivo especial |
| **Pre-Requisito** | INO104-CÁLCULO I | Requiere haber aprobado Cálculo I |
| **Grupo Pre-Req.** | *(vacío)* | Sin subgrupo condicional |

