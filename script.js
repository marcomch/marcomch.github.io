const phone='51983983549';const beers=[['Blonde Ale','blonde'],['Red Ale','red'],['IPA','ipa'],['Hazy IPA','hazy'],['Stout','stout']];const amounts=Object.fromEntries(beers.map(b=>[b[0],0]));let capacity=12;
const $=id=>document.getElementById(id);let waContext='';const whatsapp=message=>{const url='https://wa.me/'+phone+'?text='+encodeURIComponent(message);window.open(url,'_blank','noopener');if(typeof onWhatsappOpened==='function')onWhatsappOpened(url)};
const setMenu=open=>{$('navlinks').classList.toggle('open',open);$('menu').setAttribute('aria-expanded',open);$('menu').setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');$('menu').querySelector('use').setAttribute('href',open?'#i-close':'#i-menu')};
$('menu').onclick=()=>setMenu(!$('navlinks').classList.contains('open'));document.querySelectorAll('#navlinks a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));document.addEventListener('keydown',e=>{if(e.key==='Escape'){const was=$('navlinks').classList.contains('open');setMenu(false);if(was)$('menu').focus()}});
/* Los brujos: [artículo, nombre]. Para cambiar un nombre, edítalo aquí. */
/* Brujo 6 (EL VIAJERO) oculto por ahora. Para mostrarlo, agrega ,['EL','VIAJERO'] antes del ] de la lista. */
const witches=[['EL','ALQUIMISTA'],['LA','HERBÓLOGA'],['EL','CERVECERO'],['EL','ERRANTE'],['EL','SABIO']];
$('bottleGallery').innerHTML=beers.map(([name,id])=>`<figure><img src="assets/botella_${id}.png" alt="Cerveza ${name}"><figcaption>${name}</figcaption></figure>`).join('');$('characterGallery').innerHTML=witches.map(([art,name],i)=>`<figure><img src="assets/brujo_${i+1}.webp" alt=""><figcaption><small>${art}</small><strong>${name}</strong></figcaption></figure>`).join('');
/* Flechas de los carruseles (visibles solo cuando la galería se desliza) */
document.querySelectorAll('.car-btn').forEach(b=>b.addEventListener('click',()=>{const t=$(b.dataset.target);t.scrollBy({left:Number(b.dataset.dir)*t.clientWidth*.8,behavior:'smooth'})}));
$('boxrows').innerHTML=beers.map(([name,id])=>`<div class="beer-row"><img src="assets/botella_${id}.png" alt=""><div><strong>${name}</strong><small>Selecciona unidades</small></div><div class="stepper"><button data-beer="${name}" data-step="-1" aria-label="Quitar ${name}">−</button><strong id="n-${id}">0</strong><button data-beer="${name}" data-step="1" aria-label="Agregar ${name}">+</button></div></div>`).join('');
function refresh(){const total=Object.values(amounts).reduce((a,b)=>a+b,0);$('boxcount').textContent=`${total} / ${capacity}`;$('boxstatus').textContent=total===capacity?'¡Tu caja está completa!':`Faltan ${capacity-total} botellas`;beers.forEach(([name,id])=>{$('n-'+id).textContent=amounts[name]});document.querySelectorAll('[data-step="1"]').forEach(b=>b.setAttribute('aria-disabled',String(total>=capacity)));renderBox()}
$('boxrows').addEventListener('click',e=>{const b=e.target.closest('[data-beer]');if(!b)return;const name=b.dataset.beer;const step=Number(b.dataset.step);const total=Object.values(amounts).reduce((a,c)=>a+c,0);if(step>0&&total>=capacity)return;amounts[name]=Math.max(0,amounts[name]+step);refresh()});$('boxsize').onchange=e=>{capacity=Number(e.target.value);beers.forEach(([name])=>amounts[name]=0);refresh()};$('sendbox').onclick=()=>whatsapp(`Hola, quiero solicitar una caja Embrujo de ${capacity} botellas:\n`+beers.filter(([name])=>amounts[name]).map(([name])=>`• ${name}: ${amounts[name]}`).join('\n')+'\n¿Podrían confirmarme precio y disponibilidad?');refresh();
$('beerchecks').innerHTML=beers.map(([name,id])=>`<label><input type="checkbox" value="${name}" name="estilos">${name}</label>`).join('');document.querySelector('[name="fecha"]').min=new Date().toLocaleDateString('en-CA');$('choppform').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!validateChopp(f))return;waContext='chopp';const data=new FormData(f);const estilos=data.getAll('estilos');if(!estilos.length){validateChopp(f);return}whatsapp(`Hola, quisiera cotizar un chopp Embrujo para mi evento.\nFecha: ${data.get('fecha').split('-').reverse().join('/')}\nTipo: ${data.get('tipo')}\nInvitados: ${data.get('invitados')}\nUbicación: ${data.get('ubicacion')}\nEstilos: ${estilos.join(', ')}\nComentarios: ${data.get('comentarios')||'Ninguno'}\n¿Podrían indicarme disponibilidad y precio?`)});

/* ===== Etapa 3: capa de interfaz de los configuradores (resumen, estados y avisos).
   No cambia cantidades, reglas de selección ni el contenido de los mensajes a WhatsApp. ===== */
function renderBox(){
  const total=Object.values(amounts).reduce((a,b)=>a+b,0),full=total===capacity;
  $('boxlist').innerHTML=beers.filter(([n])=>amounts[n]).map(([n])=>`<li><span>${n}</span><b>× ${amounts[n]}</b></li>`).join('');
  $('boxnotches').innerHTML=Array.from({length:capacity},(_,i)=>`<i${i<total?' class="on"':''}></i>`).join('');
  $('miniCount').textContent=$('boxcount').textContent;$('miniLeft').textContent=$('boxstatus').textContent;
  $('boxhint').textContent=full?'Se abrirá WhatsApp con tu selección.':'';
  $('sendbox').setAttribute('aria-disabled',String(!full));
  $('boxnote').textContent='';$('boxnote').classList.remove('is-warn');
  document.querySelector('.box-config .summary').classList.toggle('is-complete',full);
  document.querySelectorAll('[data-step="-1"]').forEach(b=>b.setAttribute('aria-disabled',String(amounts[b.dataset.beer]<=0)));
}
/* Botón de enviar con estado "suave": sigue enfocable y explica qué falta; la regla (caja completa) es la misma. */
$('sendbox').addEventListener('click',e=>{
  const total=Object.values(amounts).reduce((a,b)=>a+b,0);
  if(total!==capacity){
    e.preventDefault();e.stopImmediatePropagation();
    const n=capacity-total;
    $('boxnote').classList.add('is-warn');
    $('boxnote').textContent=n===1?`Aún falta 1 botella para completar tu caja de ${capacity}.`:`Aún faltan ${n} botellas para completar tu caja de ${capacity}.`;
    return;
  }
  waContext='box';
},true);
/* Móvil: el botón flotante de WhatsApp se oculta mientras se ven los configuradores y el footer,
   que ya tienen sus propios accesos a WhatsApp, para que no tape botones ni texto. */
(()=>{
  const wa=document.querySelector('.wa');
  if(!wa||!('IntersectionObserver' in window))return;
  const seen=new Set();
  const io=new IntersectionObserver(es=>{
    es.forEach(e=>e.isIntersecting?seen.add(e.target):seen.delete(e.target));
    wa.classList.toggle('is-hidden',seen.size>0);
  });
  document.querySelectorAll('.configurators,footer').forEach(z=>io.observe(z));
})();
/* Aviso al abrir WhatsApp (con enlace de respaldo hacia el mismo mensaje). */
function onWhatsappOpened(url){
  const box=waContext==='box',el=$(box?'boxnote':'choppnote');
  el.classList.remove('is-warn');
  el.textContent=(box?'Abriendo WhatsApp con tu caja… ':'Abriendo WhatsApp con tu solicitud… ');
  const a=document.createElement('a');a.href=url;a.target='_blank';a.rel='noopener';a.textContent='Si no se abrió, toca aquí';el.appendChild(a);
}
/* Validación en línea del chopp (mismas reglas que antes: campos obligatorios, mínimo 1 invitado, fecha desde hoy, al menos un estilo). */
function validateChopp(f){
  f.querySelectorAll('.field-error').forEach(n=>n.remove());
  f.querySelectorAll('[aria-invalid]').forEach(n=>{n.removeAttribute('aria-invalid');n.removeAttribute('aria-describedby')});
  $('choppnote').textContent='';
  let first=null;
  const fail=(el,host,id,msg)=>{
    const m=document.createElement('span');m.className='field-error';m.id='err-'+id;m.textContent=msg;host.appendChild(m);
    el.setAttribute('aria-invalid','true');el.setAttribute('aria-describedby',m.id);
    if(!first)first=el;
  };
  const msgs={
    fecha:v=>v.rangeUnderflow?'Elige una fecha desde hoy.':'Elige la fecha del evento.',
    tipo:()=>'Completa este campo.',
    invitados:()=>'Indica al menos 1 invitado.',
    ubicacion:()=>'Completa este campo.'
  };
  ['fecha','tipo','invitados','ubicacion'].forEach(name=>{
    const el=f.elements[name];
    if(!el.checkValidity())fail(el,el.closest('label'),name,msgs[name](el.validity));
  });
  const fs=f.querySelector('fieldset');
  if(!fs.querySelector('input[name="estilos"]:checked'))fail(fs.querySelector('input[name="estilos"]'),fs,'estilos','Selecciona al menos un estilo de cerveza.');
  if(first)first.focus();
  return !first;
}
['input','change'].forEach(ev=>$('choppform').addEventListener(ev,e=>{
  const host=e.target.name==='estilos'?e.target.closest('fieldset'):e.target.closest('label');if(!host)return;
  const err=host.querySelector('.field-error');
  if(err&&(e.target.name!=='estilos'||host.querySelector('input[name="estilos"]:checked'))){
    err.remove();
    (e.target.name==='estilos'?host.querySelectorAll('input[name="estilos"]'):[e.target]).forEach(n=>{n.removeAttribute('aria-invalid');n.removeAttribute('aria-describedby')});
  }
}));

/* ===== LLUVIA EN "NUESTRA HISTORIA" (solo esa sección) =====
   Tres capas con profundidad. Para ajustar: LLUVIA.layers (n = cantidad,
   len = largo, sp = velocidad px/s, a = opacidad, w = grosor) y LLUVIA.wind (inclinación). */
(function(){
  const sec=document.getElementById('historia');
  if(!sec||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const cv=document.createElement('canvas');cv.className='rain-cv';cv.setAttribute('aria-hidden','true');
  sec.insertBefore(cv,sec.firstChild);
  const cx=cv.getContext('2d');if(!cx)return;
  const LLUVIA={wind:.14,layers:[
    {n:60,len:[6,10],sp:[380,460],a:.14,w:.8},   /* lejos  */
    {n:45,len:[12,18],sp:[640,760],a:.24,w:1.1}, /* medio  */
    {n:22,len:[24,36],sp:[1100,1300],a:.4,w:1.7} /* cerca  */
  ]};
  let W=0,H=0,drops=[],raf=0,last=0,vis=false;
  const rnd=(a,b)=>a+Math.random()*(b-a);
  function mk(o){return{x:rnd(-60,W+60),y:rnd(-H,H),l:rnd(...o.len),v:rnd(...o.sp),a:o.a,w:o.w}}
  function make(){
    const s=Math.max(.45,Math.min(1,W*H/(1400*440)));drops=[];
    LLUVIA.layers.forEach(o=>{for(let k=0,n=Math.round(o.n*s*1.6);k<n;k++)drops.push(mk(o))});
  }
  function size(){
    const dpr=Math.min(devicePixelRatio||1,1.5);W=sec.clientWidth;H=sec.clientHeight;
    cv.width=W*dpr;cv.height=H*dpr;cx.setTransform(dpr,0,0,dpr,0,0);cx.lineCap='round';make();
  }
  function frame(t){
    raf=requestAnimationFrame(frame);
    const dt=Math.min((t-last)/1000,.05);last=t;cx.clearRect(0,0,W,H);
    const wd=LLUVIA.wind;
    for(const d of drops){
      d.y+=d.v*dt;d.x+=d.v*wd*dt;
      if(d.y>H+40){d.y=-d.l-rnd(0,H*.3);d.x=rnd(-60,W+60)}
      cx.strokeStyle='rgba(234,214,183,'+d.a+')';cx.lineWidth=d.w;
      cx.beginPath();cx.moveTo(d.x,d.y);cx.lineTo(d.x-d.l*wd,d.y-d.l);cx.stroke();
    }
  }
  const start=()=>{if(!raf&&vis&&!document.hidden){last=performance.now();raf=requestAnimationFrame(frame)}};
  const stop=()=>{cancelAnimationFrame(raf);raf=0};
  new ResizeObserver(size).observe(sec);
  new IntersectionObserver(e=>{vis=e[0].isIntersecting;vis?start():stop()}).observe(sec);
  document.addEventListener('visibilitychange',()=>document.hidden?stop():start());
  size();
})();
