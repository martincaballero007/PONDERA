# **Campos y Datos del Reporte de Historial Académico (UNMSM)**

En el documento del **Sistema Único de Matrícula (SUM)**, las asignaturas registradas dentro de cada periodo académico (Periodo Académico YYYY-X) contienen las siguientes columnas con información detallada de la matrícula y la calificación del estudiante:

## **1\. Ciclo (Ciclo)**

* **Descripción:** Indica el nivel o ciclo académico al que pertenece la asignatura dentro de la estructura curricular del Plan de Estudios del estudiante.  
* **Valores comunes:** Números del 1 al 10 (por ejemplo, 1 para el primer semestre, 2 para el segundo, etc.).

## **2\. Plan (Plan)**

* **Descripción:** Código del año del plan de estudios bajo el cual se cursó la materia.  
* **Ejemplos:** 2023 (correspondiente al Plan de Estudios 2023 de la carrera).

## **3\. Tipo de Asignatura (Tipo)**

* **Descripción:** Clasificación del curso según la obligatoriedad en el plan de estudios.  
* **Valores:**  
  * O / Ο: **Obligatorio** (Cursos indispensables de la carrera o estudios generales).  
  * E: **Electivo** (Cursos optativos elegidos por el estudiante).

## **4\. Asignatura (Asignatura)**

* **Descripción:** Identificación oficial del curso. Combina el **código alfanumérico único** de la materia con su **nombre o denominación oficial**.  
* **Ejemplos:**  
  * INE002-PROGRAMACIÓN Y COMPUTACIÓN  
  * INO104-CÁLCULO I  
  * 203230401-ALGORITMOS Y ESTRUCTURAS DE DATOS

## **5\. Calificación (Calif.)**

* **Descripción:** Nota cuantitativa final en la escala vigesimal (0 a 20\) obtenida por el estudiante al culminar el semestre. Si el periodo académico está en curso o recién matriculado (como en el 2026-1), la casilla permanece vacía.  
* **Ejemplos:** 11, 14, 18, 19 (Aprobados, ![][image1]) o 09, 10 (Desaprobados, ![][image2]).

## **6\. Créditos (Créd.)**

* **Descripción:** Valor académico o peso en créditos de la asignatura. Se utiliza directamente como ponderador para el cálculo del Promedio Ponderado por Ciclo (PPC) y el Promedio Ponderado General (PPG).  
* **Ejemplos:** 2.0, 3.0, 4.0 o 10.0 (en el caso de Prácticas Preprofesionales).

## **7\. Sección (Sec.)**

* **Descripción:** Número o identificador de la aula/grupo/sección en la que se matriculó el estudiante para llevar la clase.  
* **Ejemplos:** 1, 2, 3, 6\.

## **8\. Código de Acta (Acta)**

* **Descripción:** Identificador único del acta oficial de evaluación emitida por la universidad donde queda asentada la nota del curso.  
* **Estructura del Código:**  
  * **Prefijo:** P- (Acta Promocional / regular) o A- (Acta de Aplazados / subsanación).  
  * **Cuerpo:** Incluye el periodo (ej. 20241), código de la facultad/carrera (203), plan (2023), código de la materia (INE002) y sección (1P).  
* **Ejemplos:**  
  * P-2024120320230INO1016P  
  * A-2024220320230INO2041A

## **Resumen Estructurado por Columna**

| Columna | Ejemplo en el Reporte | Significado / Uso |
| :---- | :---- | :---- |
| **Ciclo** | 1 | Perteneciente al 1.º ciclo curricular |
| **Plan** | 2023 | Cursado bajo el Plan de Estudios 2023 |
| **Tipo** | O | Materia obligatoria |
| **Asignatura** | INO104-CÁLCULO I | Código INO104, Nombre *CÁLCULO I* |
| **Calif.** | 12 | Nota final obtenida (Aprobado) |
| **Créd.** | 4.0 | Peso académico de 4 créditos |
| **Sec.** | 6 | Matriculado en la Sección 6 |
| **Acta** | P-2024120320230INO1046P | Código del acta oficial en el SUM |

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAZCAYAAABHLbxYAAABUklEQVR4Xu2VPUvDUBSGE4qDqJOEIPkmSMDFIYiTS3ehv6B/wdGl4CzOjg4K/gTB0a3gUhBcugluzrrqczCRcDCmrUmm+8BLQ857Tt7m5iaWZTAYhAGy9UmN53m+67ob+vwPYRjuobM0TQNd+w+O42wGQXAURdFUjnVdyPN8zff9XTyX6I0cufb8CuYEzeI4HskQXV8WZu2gl7qgJVzvGt/7wkEFlmCbpgnNcxpP/lyOBjoNWsKSrNM4ZsAzupA/oD1N9BK0woAhQ4Y98nvDc5dqQx19By2f3Ss0ZeihrtfRV1BbQtF8LyoCNr5mqnQaVHY7jSMaZ8VdTLRnUToLKjucpjlNk1U2j6b1oBIK8zl6kt2u66vSatAkSfYx3aGh9f25aw35LDL3NcuyLV2rYOO5RR+8UQ50sVOKO/SpxR07LT0cH+t6oYemFTAYDAbDcnwBx3pq9bi+Kl0AAAAASUVORK5CYII=>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAZCAYAAABHLbxYAAABOklEQVR4XmNgGAWjYBSAADMQM6ILogNpaWkZcXFxbnRxmgNRUVEeWVlZW3l5+eMgNro8CBgbG7PKyMioAtVMBeLXcnJyxuhqSAZAHwsDDSpTUFBIRJfDBYCWSwLxQ1wOhQGgmQuB6r5S5FBFRUV1qEHHgdiJARKVRAF6OJQZqNEKaMAhIL0GaIAWAxHpDB3Q1KFATRFATReAuA9kEbo8KYAmDlVRUeEDpUEQBrHR5ckBVHUoMNcJARX1gkIRFJro8pQAqjpUSkpKBBrNg9uhMAAqbIEK8wdt1KMDaGa6Ig8phAdfZkID4OIJiLfLU1A8gapFoP4n6urqvOhySIARqGYpEH8D1mSm6JJEA6ABikA8G4gPyxNZ4END6D86Bnq4HKYGyPZFl4fiA4RiAC8gpwodBaNgFIyCYQ4AMPdsPh6EXl8AAAAASUVORK5CYII=>