(()=>{
'use strict';const KEY='multitracks-remote-reaper-hosts',$=id=>document.getElementById(id);let editing=null,stations=[],busy=false,cancelled=false,controller=null;
function msg(t,type=''){$('status').textContent=t;$('status').className=type;}
function normalize(s){if(!s||typeof s!=='object')throw Error('Dispositivo no válido');const host=String(s.host||'').trim(),port=Number(s.port),p=host.split('.');if(p.length!==4||!p.every(v=>/^\d{1,3}$/.test(v)&&Number(v)<=255)||!Number.isInteger(port)||port<1||port>65535)throw Error('Escribe una IPv4 y un puerto válidos.');let route=String(s.route||'').trim();if(route&&!route.startsWith('/'))route='/'+route;if(route.startsWith('//')||/[\s\\\x00-\x1f]/.test(route))throw Error('Ruta no válida.');return {host,port,route,name:String(s.name||host).trim().slice(0,80)||host,favorite:Boolean(s.favorite),lastUsed:Math.max(0,Number(s.lastUsed)||0)};}
function id(s){return s.host+':'+s.port+(s.route||'');}function url(s){return 'http://'+id(s);}
function store(){try{localStorage.setItem(KEY,JSON.stringify(stations));return true;}catch{msg('No se pudo guardar. Exporta un respaldo.','error');return false;}}
function values(){return normalize({name:$('name').value,host:$('host').value,port:$('port').value,route:$('route').value,favorite:$('favorite').checked});}
function reset(){editing=null;$('form').reset();$('port').value=8080;msg('Nuevo dispositivo.');}
function fill(s){editing=id(s);$('name').value=s.name;$('host').value=s.host;$('port').value=s.port;$('route').value=s.route;$('favorite').checked=s.favorite;msg('Editando: '+s.name);$('name').focus();}
function saveCurrent(){const s=values(),old=stations.find(x=>id(x)===id(s)||id(x)===editing);s.lastUsed=old?old.lastUsed:0;stations=stations.filter(x=>id(x)!==editing&&id(x)!==id(s));stations.unshift(s);editing=id(s);store();render();return s;}
function modal(title,text,confirmText='Aceptar',danger=false,cancelText='Cancelar'){
 return new Promise(resolve=>{const d=$('modal');$('modalTitle').textContent=title;$('modalText').textContent=text;$('modalConfirm').textContent=confirmText;$('modalCancel').textContent=cancelText;$('modalConfirm').className=danger?'danger':'primary';$('modalIcon').textContent=danger?'✕':'!';function finish(v){$('modalConfirm').onclick=null;$('modalCancel').onclick=null;d.removeEventListener('cancel',cancel);d.close();resolve(v);}function cancel(e){e.preventDefault();finish(false);}$('modalConfirm').onclick=()=>finish(true);$('modalCancel').onclick=()=>finish(false);d.addEventListener('cancel',cancel);d.showModal();$('modalCancel').focus();});
}
function navigate(s){s.lastUsed=Date.now();store();msg('Abriendo '+s.name+'…','success');location.href=url(s);}
async function open(s){
 if(busy)return;busy=true;cancelled=false;controller=new AbortController();const limit=Number($('timeout').value)||6000;let expired=false;const start=performance.now();
 $('loadAddress').textContent=s.name+'\n'+url(s);$('loadTime').textContent='Solicitando respuesta…';$('loading').showModal();
 const timer=setInterval(()=>{$('loadTime').textContent=((performance.now()-start)/1000).toFixed(1)+' s · máximo '+(limit/1000)+' s';},100);
 const timeout=setTimeout(()=>{expired=true;controller.abort();},limit);let failure=null;
 try{
  if(location.protocol==='https:')throw Error('Esta página está en HTTPS y la dirección de REAPER es HTTP. El navegador puede bloquear la comprobación.');
  const r=await fetch(url(s),{mode:'no-cors',cache:'no-store',credentials:'omit',signal:controller.signal});
  if(r.type!=='opaque'&&!r.ok)throw Error('El servidor respondió con HTTP '+r.status+'.');
 }catch(e){failure=e;}
 finally{clearInterval(timer);clearTimeout(timeout);$('loading').close();controller=null;}
 if(cancelled){busy=false;msg('Comprobación cancelada.');return;}
 if(!failure){busy=false;msg('El servicio respondió. Abriendo interfaz…','success');navigate(s);return;}
 msg(expired?'Sin respuesta dentro del tiempo indicado.':'No se pudo comprobar la conexión.','error');
 const details=expired?'La PC o el puerto no respondió en '+(limit/1000)+' segundos.':failure.message;
 const manual=await modal('No se pudo comprobar la conexión',details+'\n\nRevisa REAPER, la IP, el puerto, el firewall y los permisos de red local. Esto también puede ser un bloqueo del navegador, no necesariamente una PC desconectada.','Abrir sin comprobar',false,'Volver');
 busy=false;if(manual)navigate(s);
}
function cancelLoading(){cancelled=true;if(controller)controller.abort();}
$('cancelLoad').onclick=cancelLoading;$('loading').addEventListener('cancel',e=>{e.preventDefault();cancelLoading();});
function button(text,title,fn,cls=''){const b=document.createElement('button');b.type='button';b.textContent=text;b.title=title;b.className=cls;b.onclick=fn;return b;}
function render(){
 $('count').textContent=stations.length;const term=$('search').value.toLowerCase().trim(),order=$('sort').value;const list=stations.filter(s=>(s.name+' '+s.host+':'+s.port).toLowerCase().includes(term)).sort((a,b)=>order==='name'?a.name.localeCompare(b.name):order==='favorite'?(Number(b.favorite)-Number(a.favorite)||a.name.localeCompare(b.name)):b.lastUsed-a.lastUsed);const root=$('devices');root.replaceChildren();
 if(!list.length){const e=document.createElement('div');e.className='empty';e.textContent=stations.length?'No hay resultados.':'Sin dispositivos guardados.';root.append(e);return;}
 list.forEach(s=>{const card=document.createElement('article');card.className='device'+(s.favorite?' favorite':'');const info=document.createElement('div'),title=document.createElement('h3'),address=document.createElement('div'),used=document.createElement('div');title.textContent=s.name;address.className='address';address.textContent=id(s);used.className='used';used.textContent=s.lastUsed?'Última apertura: '+new Date(s.lastUsed).toLocaleString():'Todavía no abierto';info.append(title,address,used);const actions=document.createElement('div');actions.className='device-actions';actions.append(button('▶ Abrir','Comprobar y abrir '+s.name,()=>open(s),'primary'),button(s.favorite?'★':'☆','Cambiar favorito',()=>{s.favorite=!s.favorite;store();render();}),button('Editar','Editar dispositivo',()=>fill(s)),button('✕','Eliminar dispositivo',async()=>{if(busy)return;if(!await modal('Eliminar dispositivo','¿Eliminar “'+s.name+'”?\n'+id(s)+'\n\nSolo se quitará de los guardados. No afecta a REAPER.','Sí, eliminar',true))return;stations=stations.filter(x=>id(x)!==id(s));store();if(editing===id(s))reset();render();msg('Dispositivo eliminado.','success');}));card.append(info,actions);root.append(card);});
}
$('form').onsubmit=e=>{e.preventDefault();try{open(saveCurrent());}catch(err){msg(err.message,'error');}};$('save').onclick=()=>{try{const s=saveCurrent();msg('Guardado: '+s.name,'success');}catch(e){msg(e.message,'error');}};$('clear').onclick=reset;$('search').oninput=render;$('sort').onchange=render;
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({version:1,devices:stations},null,2)],{type:'application/json'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='multitracks-dispositivos.json';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);msg('Respaldo exportado.','success');};$('import').onclick=()=>$('importFile').click();$('importFile').onchange=async()=>{const f=$('importFile').files[0];if(!f)return;try{if(f.size>1000000)throw Error('Respaldo demasiado grande.');const raw=JSON.parse(await f.text()),list=Array.isArray(raw)?raw:raw.devices;if(!Array.isArray(list)||list.length>500)throw Error('Formato no válido.');const imported=list.map(normalize);let count=0;imported.forEach(s=>{if(!stations.some(x=>id(x)===id(s))){stations.push(s);count++;}});store();render();msg(count+' dispositivos añadidos.','success');}catch(e){msg('Importación: '+e.message,'error');}finally{$('importFile').value='';}};
try{const list=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(list))list.forEach(s=>{try{const v=normalize(s);if(!stations.some(x=>id(x)===id(v)))stations.push(v);}catch{}});}catch{msg('No se pudieron leer los guardados.','error');}
window.addEventListener('pageshow',()=>{busy=false;cancelled=false;try{if($('loading').open)$('loading').close();}catch{}render();});render();
})();