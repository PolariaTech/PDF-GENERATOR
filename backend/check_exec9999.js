const fs = require('fs');
const data = JSON.parse(fs.readFileSync(String.raw`C:\Users\DG\.claude\projects\D--POLARIA-PDF-GENERATOR\00567d3d-f882-443d-938a-fde00e39629d\tool-results\mcp-claude_ai_n8n-get_execution-1784133755182.txt`, 'utf-8'));
const rd = data.data.resultData.runData;
console.log('lastNodeExecuted:', data.data.resultData.lastNodeExecuted);
for (const name of Object.keys(rd)) {
  const runs = rd[name];
  const r = runs[runs.length - 1];
  let itemCounts = null;
  if (r.data && r.data.main) itemCounts = r.data.main.map(b => b ? b.length : null);
  console.log('-', name, '| status:', r.executionStatus, '| items:', JSON.stringify(itemCounts), '| error:', r.error ? (r.error.message || JSON.stringify(r.error)).slice(0,200) : 'none');
}
