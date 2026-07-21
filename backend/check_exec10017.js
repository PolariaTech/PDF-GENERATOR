const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784144335341.txt`, 'utf-8'));
const rd = data.data.resultData.runData;

console.log('=== Leer Filas de Google Sheets1 ===');
const leer = rd['Leer Filas de Google Sheets1'][0].data.main[0];
for (const it of leer) {
  console.log(' row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'week:', it.json.weekNumber, 'Plantilla:', JSON.stringify(it.json['Plantilla']), 'Procesado:', JSON.stringify(it.json['Procesado']));
}

console.log();
console.log('=== Calcular Horas y Corte de Agregados1 ===');
const calc = rd['Calcular Horas y Corte de Agregados1'][0].data.main[0][0].json;
console.log(' ciclo:', calc.ciclo, ' weekNumber:', calc.weekNumber, ' plantilla:', JSON.stringify(calc.plantilla), ' rowIndex:', calc.rowIndex);

console.log();
console.log('=== Marcar Fila como Procesada1 - INPUT ===');
const marcarNode = rd['Marcar Fila como Procesada1'][0];
console.log(JSON.stringify(marcarNode.data.main[0][0].json, null, 2));

console.log();
console.log('=== Marcar Fila como Procesada1 node params snapshot (from pinData/executionData if present) ===');
