(()=>{
'use strict';
const KEY='multitracks-remote-reaper-hosts', $=id=>document.getElementById(id);
let editing=null,stations=[];
function message(t,type=''){ $('status').textContent=t;$('status').className=type; }
function ipv4(h){const p=h.split('.');return p.length===4&&p.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255);}
function normalize(s){
 if(!s||typeof s!=='object')throw Error('Dispositivo no válido');
 const host=String(s.host||'').trim();const port=Number(s.port);
 if(!ipv4(host)||!Number.isInteger(port)||port<1||port>65535)throw Error('IP o puerto no válido');
 let route=String(s.route||'').trim();if(route&&!route.startsWith('/'))route='/'+route;
 if(route.startsWith('//')||/[\s\\\x00-\x1f]/.test(route))throw Error('Ruta no válida');
 return {host,port,route,name:String(s.name||host).trim().slice(0,80)||host,favorite:Boolean(s.favorite),lastUsed:Math.max(0,Number(s.lastUsed)||0)};
}
function id(s){return s.host+':'+s.port+(s.route||'');}
function read(){try{const raw=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(raw))raw.forEach(s=>{try{const v=normalize(s);if(!stations.some(x=>id(x)===id(v)))stations.push(v);}catch{}});}catch{message('No se pudieron leer los dispositivos guardados.','error');}}
function store(){try{localStorage.setItem(KEY,JSON.stringify(stations));return true;}catch{message('El navegador no permitió guardar. Exporta un respaldo.','error');return false;}}
function values(){return normalize({name:$('name').value,host:$('host').value,port:$('port').value,route:$('route').value,favorite:$('favorite').checked});}
function fill(s){editing=id(s);$('name').value=s.name;$('host').value=s.host;$('port').value=s.port;$('route').value=s.route||'';$('favorite').checked=s.favorite;message('Editando: '+s.name);$('name').focus();}
function reset(){editing=null;$('form').reset();$('port').value=8080;message('Nuevo dispositivo.');}
function saveCurrent(){const s=values();const existing=stations.find(x=>id(x)===id(s)||id(x)===editing);s.lastUsed=existing?existing.lastUsed:0;stations=stations.filter(x=>id(x)!==editing&&id(x)!==id(s));stations.unshift(s);editing=id(s);store();render();return s;}
function open(s){s.lastUsed=Date.now();store();message('Abriendo '+s.name+'…','success');location.href='http://'+s.host+':'+s.port+(s.route||'');}
function button(text,title,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.className=cls;b.onclick=fn;return b;}
function render(){
 $('count').textContent=stations.length;
 const term=$('search').value.toLowerCase().trim(),order=$('sort').value;
 const list=stations.filter(s=>(s.name+' '+s.host+':'+s.port).toLowerCase().includes(term)).sort((a,b)=>order==='name'?a.name.localeCompare(b.name):order==='favorite'?(Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name)):b.lastUsed-a.lastUsed);
 const root=$('devices');root.replaceChildren();
 if(!list.length){const e=document.createElement('div');e.className='empty';e.textContent=stations.length?'No hay resultados para esa búsqueda.':'Sin dispositivos guardados. Añade tu primera estación.';root.append(e);return;}
 list.forEach(s=>{const card=document.createElement('article');card.className='device'+(s.favorite?' favorite':'');const info=document.createElement('div');const title=document.createElement('h3');title.textContent=s.name;const address=document.createElement('div');address.className='address';address.textContent=s.host+':'+s.port+(s.route||'');const used=document.createElement('div');used.className='used';used.textContent=s.lastUsed?'Última apertura: '+new Date(s.lastUsed).toLocaleString():'Todavía no abierto desde este panel';info.append(title,address,used);const actions=document.createElement('div');actions.className='device-actions';actions.append(button('▶ Abrir','Abrir '+s.name,()=>open(s),'open'),button(s.favorite?'★':'☆','Cambiar favorito',()=>{s.favorite=!s.favorite;store();render();}),button('Editar','Editar dispositivo',()=>fill(s)),button('✕','Eliminar dispositivo',()=>{if(!confirm('¿Eliminar "'+s.name+'" de los guardados?'))return;stations=stations.filter(x=>id(x)!==id(s));store();render();if(editing===id(s))reset();}));card.append(info,actions);root.append(card);});
}
$('form').onsubmit=e=>{e.preventDefault();try{open(saveCurrent());}catch(err){message(err.message,'error');}};
$('save').onclick=()=>{try{const s=saveCurrent();message('Dispositivo guardado: '+s.name,'success');}catch(e){message(e.message,'error');}};
$('clear').onclick=reset;$('search').oninput=render;$('sort').onchange=render;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,devices:stations},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='multitracks-dispositivos.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);message('Respaldo exportado.','success');};
$('import').onclick=()=>$('importFile').click();
$('importFile').onchange=async()=>{const f=$('importFile').files[0];if(!f)return;try{if(f.size>1000000)throw Error('Respaldo demasiado grande');const raw=JSON.parse(await f.text());const list=Array.isArray(raw)?raw:raw.devices;if(!Array.isArray(list)||list.length>500)throw Error('Formato de respaldo no válido');const imported=list.map(normalize);let count=0;imported.forEach(s=>{if(!stations.some(x=>id(x)===id(s))){stations.push(s);count++;}});store();render();message(count+' dispositivos añadidos. Los existentes se conservaron.','success');}catch(e){message('Importación: '+e.message,'error');}finally{$('importFile').value='';}};
window.addEventListener('pageshow',()=>{render();});read();render();
})();