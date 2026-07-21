const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784144335341.txt`, 'utf-8'));
const rd = data.data.resultData.runData;
const leer = rd['Leer Filas de Google Sheets1'][0].data.main[0];
for (const it of leer) {
  console.log('row_number:', it.json.row_number, typeof it.json.row_number,
    '| weekNumber:', JSON.stringify(it.json.weekNumber), typeof it.json.weekNumber,
    '| Plantilla:', JSON.stringify(it.json['Plantilla']), typeof it.json['Plantilla']);
}
const marcarInput = rd['Marcar Fila como Procesada1'][0].data.main[0][0].json;
console.log();
console.log('Marcar input weekNumber:', JSON.stringify(marcarInput.weekNumber), typeof marcarInput.weekNumber);

// also check the node's own parameters as executed
console.log();
console.log('--- source node executionData? ---');
console.log(Object.keys(data.data.executionData || {}));
