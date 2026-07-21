const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_workflow_details-1784150585501.txt`, 'utf-8'));
const nodes = data.workflow.nodes;

function findNode(name) {
  return nodes.find(n => n.name === name);
}

console.log('=== Normalizar y Validar Fila del Sprint1 ===');
const norm = findNode('Normalizar y Validar Fila del Sprint1');
console.log(norm.parameters.jsCode.includes('esValida: false') ? 'TIENE el fix (esValida:false en el caso 0 pendientes)' : 'NO tiene el fix -- sigue con return [];');
console.log('--- primeras 300 chars ---');
console.log(norm.parameters.jsCode.slice(0, 400));

console.log();
console.log('=== Marcar Fila como Procesada1 ===');
const marcar = findNode('Marcar Fila como Procesada1');
console.log('matchingColumns:', JSON.stringify(marcar.parameters.columns.matchingColumns));
console.log('value:', JSON.stringify(marcar.parameters.columns.value));

console.log();
console.log('=== Calcular Row Number Fresco ===');
const calcRow = findNode('Calcular Row Number Fresco');
console.log(calcRow ? 'EXISTE' : 'NO EXISTE');
console.log(calcRow.parameters.jsCode.includes('calc.rowIndex') ? 'usa calc.rowIndex (fix correcto)' : 'no usa rowIndex');

console.log();
console.log('=== Folders cachedResultName ===');
const buscarSub = findNode('Buscar Subcarpeta del Sprint en Drive1');
console.log('Buscar Subcarpeta folderId.cachedResultName:', buscarSub.parameters.filter.folderId.cachedResultName);
const crearSub = findNode('Crear Subcarpeta del Sprint en Drive1');
console.log('Crear Subcarpeta folderId.cachedResultName:', crearSub.parameters.folderId.cachedResultName);

console.log();
console.log('=== Enviar Informe de PDF Generado ===');
const informe = findNode('Enviar Informe de PDF Generado');
console.log('emailType:', informe.parameters.emailType);
console.log('contiene 01_SPRINTS:', informe.parameters.message.includes('01_SPRINTS'));
console.log('contiene filasExtraHtml:', informe.parameters.message.includes('filasExtraHtml'));

console.log();
console.log('=== Preparar Datos del Correo ===');
const prepDatos = findNode('Preparar Datos del Correo');
console.log(prepDatos ? 'EXISTE' : 'NO EXISTE');
console.log('contiene APODOS:', prepDatos.parameters.jsCode.includes('APODOS'));
console.log('contiene Lucho/Mauro/Dani:', prepDatos.parameters.jsCode.includes('Lucho'));

console.log();
console.log('=== 4 correos de notificacion de error: emailType ===');
for (const name of ['Enviar Notificación de Ciclo Sin Issues1','Enviar Notificación de Ciclo No Encontrado1','Enviar Notificación de Fila Inválida1','Enviar Notificación de Error del Backend1']) {
  const n = findNode(name);
  console.log(name, '->', n.parameters.emailType, '| tiene HTML tags:', n.parameters.message.includes('<div'));
}

console.log();
console.log('=== Connections check: Registrar Ejecucion Exitosa1 -> ? ===');
console.log(JSON.stringify(data.workflow.connections['Registrar Ejecución Exitosa1']));
console.log('Subir PDF del Sprint a Drive1 ->', JSON.stringify(data.workflow.connections['Subir PDF del Sprint a Drive1']));
