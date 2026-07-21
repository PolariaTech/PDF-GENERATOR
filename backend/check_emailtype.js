const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_workflow_details-1784150585501.txt`, 'utf-8'));
const nodes = data.workflow.nodes;
const informe = nodes.find(n => n.name === 'Enviar Informe de PDF Generado');
console.log('all keys:', Object.keys(informe.parameters));
console.log(JSON.stringify(informe.parameters, null, 2).slice(0, 800));
