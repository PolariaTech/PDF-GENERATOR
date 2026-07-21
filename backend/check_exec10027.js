const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784146235700.txt`, 'utf-8'));
const rd = data.data.resultData.runData;

console.log('=== Leer Filas de Google Sheets1 ===');
for (const it of rd['Leer Filas de Google Sheets1'][0].data.main[0]) {
  console.log(' row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'week:', it.json.weekNumber, 'Plantilla:', JSON.stringify(it.json['Plantilla']), 'Procesado:', JSON.stringify(it.json['Procesado']));
}

console.log();
console.log('=== Calcular Row Number Fresco OUTPUT ===');
console.log(JSON.stringify(rd['Calcular Row Number Fresco'][0].data.main[0][0].json, null, 2));

console.log();
console.log('=== Marcar Fila como Procesada1 INPUT/OUTPUT ===');
console.log(JSON.stringify(rd['Marcar Fila como Procesada1'][0].data.main[0][0].json, null, 2));

console.log();
console.log('=== Preparar Registro de Ejecucion Exitosa1 OUTPUT ===');
console.log(JSON.stringify(rd['Preparar Registro de Ejecución Exitosa1'][0].data.main[0][0].json, null, 2));

console.log();
console.log('=== Enviar Informe de PDF Generado status ===');
console.log('status:', rd['Enviar Informe de PDF Generado'][0].executionStatus, 'error:', JSON.stringify(rd['Enviar Informe de PDF Generado'][0].error || null));
