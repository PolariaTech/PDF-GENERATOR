const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784132987003.txt`, 'utf-8'));
const rd = data.data.resultData.runData;
console.log('nodes:', Object.keys(rd));

const leer = rd['Leer Filas de Google Sheets1'];
if (leer) {
  const items = leer[0].data.main[0];
  console.log();
  console.log('Leer Filas de Google Sheets1 - items:', items.length);
  for (const it of items) {
    console.log('  row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'weekNumber:', it.json['weekNumber'], 'Procesado:', JSON.stringify(it.json['Procesado']));
  }
}

const calc = rd['Calcular Horas y Corte de Agregados1'];
if (calc) {
  const j = calc[0].data.main[0][0].json;
  console.log();
  console.log('Calc ciclo:', j.ciclo, ' weekNumber:', j.weekNumber, ' plantilla:', j.plantilla);
}

const marcar = rd['Marcar Fila como Procesada1'];
if (marcar) {
  console.log();
  console.log('Marcar Fila como Procesada1 - status:', marcar[0].executionStatus, ' error:', marcar[0].error ? JSON.stringify(marcar[0].error).slice(0,300) : 'none');
  console.log('output items:', marcar[0].data.main.map(b => b ? b.length : null));
  if (marcar[0].data.main[0] && marcar[0].data.main[0].length > 0) {
    console.log('output json:', JSON.stringify(marcar[0].data.main[0][0].json));
  }
} else {
  console.log();
  console.log('Marcar Fila como Procesada1 NOT in runData (did not execute)');
}
