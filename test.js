const h = require('http');
const d = JSON.stringify({ query: '4495/322/712' });
const r = h.request(
  { hostname:'localhost', port:3000, path:'/api/analyze', method:'POST',
    headers:{ 'Content-Type':'application/json', 'Content-Length': Buffer.byteLength(d) } },
  res => { let b=''; res.on('data', c => b+=c); res.on('end', () => { try { const p=JSON.parse(b); console.log(JSON.stringify(p,null,2)); } catch(e){ console.log(b); } }); }
);
r.write(d); r.end();
