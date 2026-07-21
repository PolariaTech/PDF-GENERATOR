const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784133755182.txt`, 'utf-8'));
const rd = data.data.resultData.runData;

const leer = rd['Leer Filas de Google Sheets1'][0].data.main[0];
console.log('Leer Filas de Google Sheets1 - items:', leer.length);
for (const it of leer) {
  console.log('  row_number:', it.json.row_number, 'Ciclo:', it.json['Ciclo (nombre en Linear)'], 'weekNumber:', it.json['weekNumber'], 'Procesado:', JSON.stringify(it.json['Procesado']), 'Plantilla:', it.json['Plantilla']);
}

const calc = rd['Calcular Horas y Corte de Agregados1'][0].data.main[0][0].json;
console.log();
console.log('Calc rowIndex:', calc.rowIndex, ' ciclo:', calc.ciclo, ' weekNumber:', calc.weekNumber, ' plantilla:', calc.plantilla);

const buscarPdfs = rd['Buscar PDFs Existentes en Carpeta'][0].data.main[0];
console.log();
console.log('Buscar PDFs Existentes en Carpeta - items:', buscarPdfs.length);
for (const it of buscarPdfs) console.log('  ', JSON.stringify(it.json));

const nombreBase = rd['Calcular Nombre Base del PDF'][0].data.main[0][0].json;
console.log();
console.log('nombreBase:', nombreBase.nombreBase);

const nombreFinal = rd['Calcular Nombre Final del PDF'][0].data.main[0][0].json;
console.log('nombreFinal:', nombreFinal.nombreFinal);

const marcar = rd['Marcar Fila como Procesada1'][0];
console.log();
console.log('Marcar Fila como Procesada1 output:', JSON.stringify(marcar.data.main[0][0].json));
