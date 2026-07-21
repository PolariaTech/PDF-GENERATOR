const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784145808571.txt`, 'utf-8'));
const rd = data.data.resultData.runData;

console.log('=== Leer Filas de Google Sheets1 ===');
for (const it of rd['Leer Filas de Google Sheets1'][0].data.main[0]) {
  console.log(' row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'week:', it.json.weekNumber, 'Plantilla:', JSON.stringify(it.json['Plantilla']), 'Procesado:', JSON.stringify(it.json['Procesado']));
}

console.log();
console.log('=== Calcular Horas y Corte de Agregados1 ===');
const calc = rd['Calcular Horas y Corte de Agregados1'][0].data.main[0][0].json;
console.log(' ciclo:', calc.ciclo, ' weekNumber:', calc.weekNumber, ' plantilla:', JSON.stringify(calc.plantilla));

console.log();
console.log('=== Subir PDF del Sprint a Drive1 OUTPUT ===');
console.log(JSON.stringify(rd['Subir PDF del Sprint a Drive1'][0].data.main[0][0].json, null, 2));

console.log();
console.log('=== Releer Sheet Antes de Marcar OUTPUT (rows) ===');
for (const it of rd['Releer Sheet Antes de Marcar'][0].data.main[0]) {
  console.log(' row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'week:', it.json.weekNumber, 'Plantilla:', JSON.stringify(it.json['Plantilla']), 'Procesado:', JSON.stringify(it.json['Procesado']));
}

console.log();
console.log('=== Calcular Row Number Fresco OUTPUT ===');
console.log(JSON.stringify(rd['Calcular Row Number Fresco'][0].data.main[0][0].json, null, 2));

console.log();
console.log('=== Marcar Fila como Procesada1 INPUT ===');
console.log(JSON.stringify(rd['Marcar Fila como Procesada1'][0].data.main[0][0].json, null, 2));
console.log('=== Marcar Fila como Procesada1 OUTPUT ===');
const marcarOut = rd['Marcar Fila como Procesada1'][0];
console.log(JSON.stringify(marcarOut, null, 2).slice(0, 3000));

console.log();
console.log('=== Preparar Registro de Ejecucion Exitosa1 OUTPUT ===');
console.log(JSON.stringify(rd['Preparar Registro de Ejecución Exitosa1'][0].data.main[0][0].json, null, 2));
