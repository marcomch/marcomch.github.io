const phone='51983983549';const beers=[['Blonde Ale','blonde'],['Red Ale','red'],['IPA','ipa'],['Hazy IPA','hazy'],['Stout','stout']];const amounts=Object.fromEntries(beers.map(b=>[b[0],0]));let capacity=12;
const $=id=>document.getElementById(id);let waContext='';const whatsapp=message=>{const url='https://wa.me/'+phone+'?text='+encodeURIComponent(message);window.open(url,'_blank','noopener');if(typeof onWhatsappOpened==='function')onWhatsappOpened(url)};
const setMenu=open=>{$('navlinks').classList.toggle('open',open);$('menu').setAttribute('aria-expanded',open);$('menu').setAttribute('aria-label',open?'Cerrar menú':'Abrir menú');$('menu').querySelector('use').setAttribute('href',open?'#i-close':'#i-menu')};
$('menu').onclick=()=>setMenu(!$('navlinks').classList.contains('open'));document.querySelectorAll('#navlinks a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));document.addEventListener('keydown',e=>{if(e.key==='Escape'){const was=$('navlinks').classList.contains('open');setMenu(false);if(was)$('menu').focus()}});
/* Los brujos: [artículo, nombre]. Para cambiar un nombre, edítalo aquí. */
/* Brujo 6 (EL VIAJERO) oculto por ahora. Para mostrarlo, agrega ,['EL','VIAJERO'] antes del ] de la lista. */
const witches=[['EL','CURANDERO'],['EL','HEREDERO'],['EL','VIAJERO'],['LA','HECHICERA'],['LA','APRENDIZ']];
$('bottleGallery').innerHTML=beers.map(([name,id])=>`<figure><img src="assets/botella_${id}.webp" alt="Cerveza ${name}"><figcaption>${name}</figcaption><a class="hit" href="assets/fichas/ficha_${id}.webp" data-lightbox="pocimas" data-title="${name} · Ficha técnica" aria-label="Ver ficha de ${name}"></a></figure>`).join('');$('characterGallery').innerHTML=witches.map(([art,name],i)=>`<figure><img src="assets/brujo_${i+1}.webp" alt=""><figcaption><small>${art}</small><strong>${name}</strong></figcaption><a class="hit" href="assets/fichas/brujo_${i+1}.webp" data-title="${art} ${name} · Ficha" aria-label="Ver ficha de ${art.toLowerCase()} ${name.toLowerCase()}"></a></figure>`).join('');
/* Flechas de los carruseles (visibles solo cuando la galería se desliza) */
document.querySelectorAll('.car-btn').forEach(b=>b.addEventListener('click',()=>{const t=$(b.dataset.target);t.scrollBy({left:Number(b.dataset.dir)*t.clientWidth*.8,behavior:'smooth'})}));
/* =====================================================================
   PRECIOS POR BOTELLA (en soles). Cambia aquí el precio de cada cerveza.
   Si todas valen igual, basta con cambiar los números; si un día cada una
   tiene un precio distinto, ponlo en su línea. El total se calcula solo.
   ===================================================================== */
/* Frasco de pócima para "Tu selección" */
let prevFrascos=0;
const FRASCO='M9.5 1h5v8c4.5 2 7.5 5.5 7.5 10.5a10 10 0 0 1-20 0C2 14.5 5 11 9.5 9z';
const frascoSVG=i=>`<svg viewBox="0 0 24 30" aria-hidden="true"><defs><clipPath id="fr${i}"><path d="${FRASCO}"/></clipPath></defs><path class="vidrio" d="${FRASCO}"/><g clip-path="url(#fr${i})"><rect class="liq" x="0" y="11" width="24" height="19"/><circle class="bub" cx="9" cy="22" r="1.3"/><circle class="bub" cx="14" cy="24" r="1"/><circle class="bub" cx="16" cy="20" r="1.5"/></g><rect class="tapon" x="8.5" y=".2" width="7" height="2.2" rx="1"/><path class="brillo" d="M6 17c-.8 2.5-.6 5 .6 7"/></svg>`;
const PRECIOS={'Blonde Ale':9,'Red Ale':9,'IPA':9,'Hazy IPA':9,'Stout':9};
const soles=n=>'S/ '+n.toFixed(2);
const totalPrecio=()=>beers.reduce((t,[name])=>t+amounts[name]*(PRECIOS[name]||0),0);
$('boxrows').innerHTML=beers.map(([name,id])=>`<div class="beer-row" data-id="${id}"><div class="tile"><img src="assets/botella_${id}.webp" alt="Cerveza ${name}"></div><div class="nm">${name}</div><span class="pr">S/ ${PRECIOS[name]}</span><div class="stepper"><button data-beer="${name}" data-step="-1" aria-label="Quitar ${name}">−</button><strong id="n-${id}">0</strong><button data-beer="${name}" data-step="1" aria-label="Agregar ${name}">+</button></div></div>`).join('');
function refresh(){const total=Object.values(amounts).reduce((a,b)=>a+b,0);$('boxcount').textContent=`${total} / ${capacity}`;$('boxstatus').textContent=total===capacity?'¡Tu caja está completa!':`Faltan ${capacity-total} botellas`;beers.forEach(([name,id])=>{$('n-'+id).textContent=amounts[name]});document.querySelectorAll('[data-step="1"]').forEach(b=>b.setAttribute('aria-disabled',String(total>=capacity)));renderBox()}
$('boxrows').addEventListener('click',e=>{const b=e.target.closest('[data-beer]');if(!b)return;const name=b.dataset.beer;const step=Number(b.dataset.step);const total=Object.values(amounts).reduce((a,c)=>a+c,0);if(step>0&&total>=capacity)return;amounts[name]=Math.max(0,amounts[name]+step);refresh()});$('boxsize').onchange=e=>{capacity=Number(e.target.value);beers.forEach(([name])=>amounts[name]=0);refresh()};$('sendbox').onclick=()=>whatsapp(`Hola, quiero solicitar una caja Embrujo de ${capacity} botellas:\n`+beers.filter(([name])=>amounts[name]).map(([name])=>`• ${name}: ${amounts[name]}`).join('\n')+`\nTotal estimado: ${soles(totalPrecio())} (no incluye delivery)`+'\n¿Podrían confirmarme precio y disponibilidad?');refresh();
$('beerchecks').innerHTML=beers.map(([name,id])=>`<label><input type="checkbox" value="${name}" name="estilos">${name}</label>`).join('');document.querySelector('[name="fecha"]').min=new Date().toLocaleDateString('en-CA');$('choppform').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;if(!validateChopp(f))return;waContext='chopp';const data=new FormData(f);const estilos=data.getAll('estilos');if(!estilos.length){validateChopp(f);return}whatsapp(`Hola, quisiera cotizar un chopp Embrujo para mi evento.\nFecha: ${data.get('fecha').split('-').reverse().join('/')}\nTipo: ${data.get('tipo')}\nInvitados: ${data.get('invitados')}\nUbicación: ${data.get('ubicacion')}\nEstilos: ${estilos.join(', ')}\nComentarios: ${data.get('comentarios')||'Ninguno'}\n¿Podrían indicarme disponibilidad y precio?`)});

/* ===== Etapa 3: capa de interfaz de los configuradores (resumen, estados y avisos).
   No cambia cantidades, reglas de selección ni el contenido de los mensajes a WhatsApp. ===== */
function renderBox(){
  const total=Object.values(amounts).reduce((a,b)=>a+b,0),full=total===capacity;
  $('boxlist').innerHTML=beers.filter(([n])=>amounts[n]).map(([n])=>`<li><span>${n}</span><b>× ${amounts[n]}</b></li>`).join('');
  /* Frascos de pócima: uno por botella de la caja, relleno con el color de su cerveza (colores en styles.css, bloque V4.26) */
  $('boxnotches').className='notches'+(capacity>12?' g24':'');
  const seq=[];beers.forEach(([n,id])=>{for(let k=0;k<amounts[n];k++)seq.push(id)});
  $('boxnotches').innerHTML=Array.from({length:capacity},(_,i)=>{
    const on=i<total,nuevo=on&&i>=prevFrascos;
    return `<div class="fr${on?' on':''}${nuevo?' nuevo':''}"${on?` style="--c:var(--c-${seq[i]})"`:''}>${frascoSVG(i)}</div>`}).join('');
  prevFrascos=total;
  $('miniCount').textContent=$('boxcount').textContent;$('miniLeft').textContent=$('boxstatus').textContent;
  $('boxtotal').textContent=soles(totalPrecio());
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


/* ===== FICHAS DE PÓCIMAS Y BRUJOS (visor integrado, sin librerías) =====
   Pócimas: assets/fichas/ficha_<id>.webp · Brujos: assets/fichas/brujo_<n>.webp. Al hacer clic se abre sobre la misma
   página, con fondo oscuro, flechas (carrusel), contador, Esc y deslizar en móvil. */
function iniciarVisor(galeria){
  const links=[...document.querySelectorAll(galeria+' a.hit')];
  if(!links.length)return;
  const dlg=document.createElement('dialog');dlg.className='ficha-dlg';dlg.setAttribute('aria-label','Ficha técnica');
  dlg.innerHTML='<div class="fl-box"><img class="fl-img" alt=""><div class="fl-bar"><div><div class="fl-cap"></div><div class="fl-num"></div></div><button type="button" class="fl-x" aria-label="Cerrar">&times;</button></div></div><button type="button" class="fl-nav fl-prev" aria-label="Ficha anterior">&#8249;</button><button type="button" class="fl-nav fl-next" aria-label="Ficha siguiente">&#8250;</button>';
  document.body.appendChild(dlg);
  const img=dlg.querySelector('.fl-img'),cap=dlg.querySelector('.fl-cap'),num=dlg.querySelector('.fl-num');
  let cur=0;
  function show(i){
    cur=(i+links.length)%links.length;const a=links[cur];
    img.classList.remove('is-in');img.src=a.href;img.alt=a.dataset.title||'Ficha técnica';
    cap.textContent=a.dataset.title||'';num.textContent='Ficha '+(cur+1)+' de '+links.length;
    img.onload=()=>img.classList.add('is-in');if(img.complete)img.classList.add('is-in');
    [(cur+1)%links.length,(cur-1+links.length)%links.length].forEach(k=>{new Image().src=links[k].href});
  }
  links.forEach((a,i)=>a.addEventListener('click',e=>{e.preventDefault();show(i);dlg.showModal();document.documentElement.classList.add('fl-lock')}));
  dlg.querySelector('.fl-x').onclick=()=>dlg.close();
  dlg.querySelector('.fl-prev').onclick=()=>show(cur-1);
  dlg.querySelector('.fl-next').onclick=()=>show(cur+1);
  dlg.addEventListener('click',e=>{if(e.target===dlg||e.target.classList.contains('fl-box'))dlg.close()});
  dlg.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')show(cur-1);if(e.key==='ArrowRight')show(cur+1)});
  dlg.addEventListener('close',()=>document.documentElement.classList.remove('fl-lock'));
  let x0=null;
  dlg.addEventListener('touchstart',e=>{x0=e.touches[0].clientX},{passive:true});
  dlg.addEventListener('touchend',e=>{if(x0===null)return;const dx=e.changedTouches[0].clientX-x0;x0=null;if(Math.abs(dx)>50)show(cur+(dx<0?1:-1))});
}
iniciarVisor('#bottleGallery');   /* Nuestras pócimas */
iniciarVisor('#characterGallery'); /* Los brujos */


/* =====================================================================
   ARAÑA DE "ARMA TU CAJA": recorre los dos paneles una vez y desaparece.
   AJUSTES (cámbialos aquí):
     velocidad -> píxeles por segundo. MÁS BAJO = MÁS LENTA (ej. 90 lenta, 150 normal, 260 rápida).
     espera    -> milisegundos antes de poder repetirse al volver a ver la sección (20000 = 20 s).
     retraso   -> milisegundos desde que aparece la sección hasta que sale la araña.
     tamano    -> tamaño en píxeles (se cambia también en .arana del CSS).
   ===================================================================== */
const ARANA={velocidad:150,espera:20000,retraso:500,tamano:44};
(()=>{
  const zona=$('caja'),sel=document.querySelector('#caja .sel-panel'),sum=document.querySelector('#caja .summary');
  if(!zona||!sel||!sum||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const sp=document.createElement('div');sp.className='arana';sp.setAttribute('aria-hidden','true');
  sp.innerHTML='<svg viewBox="0 0 40 40"><g stroke="#1b110c" stroke-width="1.6" fill="none" stroke-linecap="round" stroke-linejoin="round"><g class="la"><path d="M16 20L7 14L3 6M16 24L5 24L1 31M16 27L8 35L6 39M17 17L10 8L9 3"/></g><g class="lb"><path d="M24 20L33 14L37 6M24 24L35 24L39 31M24 27L32 35L34 39M23 17L30 8L31 3"/></g></g><ellipse cx="20" cy="25" rx="6.5" ry="9" fill="#1b110c"/><circle cx="20" cy="13" r="4.4" fill="#1b110c"/><path d="M20 20v9" stroke="#7d291e" stroke-width="1.6"/><circle cx="18.3" cy="12" r=".9" fill="#ead6b7"/><circle cx="21.7" cy="12" r=".9" fill="#ead6b7"/></svg>';
  sp.style.width=sp.style.height=ARANA.tamano+'px';zona.appendChild(sp);
  /* Recorrido como fracciones (0 a 1) del ancho y alto de cada panel. */
  const RUTA_SEL=[[.03,.03],[.25,.05],[.5,.02],[.78,.06],[.95,.2],[.85,.4],[.55,.35],[.25,.45],[.08,.62],[.2,.8],[.5,.75],[.8,.85],[.95,.97]];
  const RUTA_SUM=[[.05,.03],[.5,.06],[.9,.1],[.7,.3],[.3,.4],[.15,.6],[.5,.72],[.85,.85],[1.08,1.06]];
  let corriendo=false,ultima=-1e9,visible=false;
  function correr(){
    if(corriendo)return;corriendo=true;ultima=performance.now();
    const z=zona.getBoundingClientRect(),pts=[];
    [[sel,RUTA_SEL],[sum,RUTA_SUM]].forEach(([el,r])=>{const b=el.getBoundingClientRect();r.forEach(([fx,fy])=>pts.push([b.left-z.left+fx*b.width,b.top-z.top+fy*b.height]))});
    const L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const T=L[L.length-1],dur=T/ARANA.velocidad*1000,t0=performance.now(),m=ARANA.tamano/2;let ang=0;
    (function paso(t){
      const e=t-t0;if(e>=dur){sp.style.opacity=0;corriendo=false;return}
      const d=e/dur*T;let k=1;while(k<L.length-1&&L[k]<d)k++;
      const u=(d-L[k-1])/(L[k]-L[k-1]||1),x=pts[k-1][0]+(pts[k][0]-pts[k-1][0])*u,y=pts[k-1][1]+(pts[k][1]-pts[k-1][1])*u;
      const tg=Math.atan2(pts[k][1]-pts[k-1][1],pts[k][0]-pts[k-1][0])*180/Math.PI+90,df=((tg-ang+540)%360)-180;ang+=df*.15;
      sp.style.transform=`translate(${x-m}px,${y-m}px) rotate(${ang}deg)`;
      sp.style.opacity=Math.min(1,e/400,(dur-e)/700);requestAnimationFrame(paso);
    })(t0);
  }
  new IntersectionObserver(es=>{const v=es[0].intersectionRatio>=.4;if(v&&!visible&&performance.now()-ultima>ARANA.espera)setTimeout(correr,ARANA.retraso);visible=v},{threshold:[0,.4]}).observe(zona);
})();

/* =====================================================================
   ANIMACIÓN CHOPP · calavera, murciélagos y fantasmas sobre el formulario "Reserva tu chopp"
   >>> CAMBIA LOS TIEMPOS AQUÍ (todo en SEGUNDOS) <<<
   cada   = cada cuántos segundos se repite
   primera = espera antes de la primera aparición, desde que cargas la página
   ===================================================================== */
(()=>{
  const ANIM={
    calavera:{cada:12,primera:2.5,duracionRisa:2.5},  /* la calavera está fija y se ríe cada 12 s (duracionRisa = cuánto dura la risa) */
    murcielagos:{cada:22,primera:7},                  /* los murciélagos cruzan el formulario cada 22 s */
    fantasmas:{cada:16,primera:11,vida:8}             /* los fantasmas aparecen y se desvanecen lentamente; vida = duración total de cada aparición */
  };
  /* Murciélagos: [altura en px, duración del cruce en s, retraso en s, tamaño]. Más segundos de cruce = más lentos. */
  const BATS=[[70,5.2,0,.2],[40,6.4,.6,.5],[100,4.6,1.2,.8]];
  /* Fantasmas: [posición horizontal en %, retraso, altura]. Están a la derecha para no tapar el título. */
  const GHOSTS=[[64,0,0],[76,-1.5,1.5],[89,-3,.5]];
  const f=document.getElementById('choppform');if(!f)return;
  const reduce=matchMedia('(prefers-reduced-motion:reduce)').matches;
  var BAT='<svg viewBox="0 0 40 24"><g fill="#1b110c"><path class="wl" d="M20 14C16 6 8 4 1 8c4 1 5 4 5 8 3-3 6-3 8-1 1-1 3-1 6-1z"/><path class="wr" d="M20 14C24 6 32 4 39 8c-4 1-5 4-5 8-3-3-6-3-8-1-1-1-3-1-6-1z"/><ellipse cx="20" cy="15" rx="3.2" ry="5"/><path d="M17.500 11l-.8-4 3 2 3-2-.8 4z"/></g><circle cx="19" cy="14" r=".6" fill="#ead6b7"/><circle cx="21" cy="14" r=".6" fill="#ead6b7"/></svg>';
  var SKULL='<svg viewBox="0 0 80 90"><path d="M8 40C8 14 72 14 72 40c0 12-8 16-10 22H18C16 56 8 52 8 40z" fill="#e8dcc0" stroke="#1b110c" stroke-width="2.200" stroke-linejoin="round"/><ellipse cx="27" cy="38" rx="9" ry="10.500" fill="#1b110c"/><ellipse cx="53" cy="38" rx="9" ry="10.500" fill="#1b110c"/><path d="M40 47l-4 8h8z" fill="#1b110c"/><path d="M22 62h36" stroke="#1b110c" stroke-width="2"/><g stroke="#1b110c" stroke-width="1.600"><path d="M28 56v6M34 56v6M40 56v6M46 56v6M52 56v6"/></g><g class="jaw"><path d="M20 62h40l-2 16c-6 8-30 8-36 0z" fill="#e8dcc0" stroke="#1b110c" stroke-width="2.200" stroke-linejoin="round"/><g stroke="#1b110c" stroke-width="1.600"><path d="M28 62v9M34 62v10M40 62v10M46 62v10M52 62v9"/></g></g></svg>';
  var GH='<svg viewBox="0 0 40 50"><path d="M20 2C9 2 4 11 4 22v26l6-5 5 5 5-5 5 5 5-5 6 5V22C36 11 31 2 20 2z" fill="#f2ead8" stroke="#1b110c" stroke-width="1.800" stroke-linejoin="round"/><ellipse cx="14" cy="21" rx="3" ry="4" fill="#1b110c"/><ellipse cx="26" cy="21" rx="3" ry="4" fill="#1b110c"/><ellipse cx="20" cy="31" rx="3" ry="4.500" fill="#1b110c"/></svg>';
  const mk=(cls,html)=>{const d=document.createElement('div');d.className='ch-deco '+cls;d.setAttribute('aria-hidden','true');d.innerHTML=html;f.appendChild(d);return d};
  const sk=mk('ch-sk','<span class="ja">\u00a1Ja, ja, ja!</span>'+SKULL);
  const bt=mk('ch-bt',BATS.map(b=>`<div class="bat" style="top:${b[0]}px;--t:${b[1]}s;--d:${b[2]}s;width:${40+b[3]*10}px">${BAT}</div>`).join(''));
  const gh=mk('ch-gh',GHOSTS.map(g=>`<div class="gh" style="left:${g[0]}%;top:${g[2]*12}px">${GH}</div>`).join(''));
  let tl=0;
  const laugh=()=>{clearTimeout(tl);sk.classList.remove('laugh');void sk.offsetWidth;sk.classList.add('laugh');tl=setTimeout(()=>sk.classList.remove('laugh'),ANIM.calavera.duracionRisa*1000)};
  const bats=()=>{if(reduce)return;bt.classList.remove('go');void bt.offsetWidth;bt.classList.add('go')};
  const ghosts=()=>{if(reduce)return;gh.querySelectorAll('.gh').forEach((g,i)=>{g.classList.remove('show');void g.offsetWidth;g.style.setProperty('--vida',ANIM.fantasmas.vida+'s');g.style.animationDelay=(i*.8)+'s';g.classList.add('show')})};
  sk.addEventListener('click',laugh);
  const loop=(fn,c)=>setTimeout(()=>{fn();setInterval(fn,c.cada*1000)},c.primera*1000);
  /* Solo se activa cuando el formulario está a la vista (ahorra recursos) */
  let started=false;
  new IntersectionObserver((e,o)=>{if(started||!e[0].isIntersecting)return;started=true;o.disconnect();
    setTimeout(()=>sk.classList.add('up'),200);loop(laugh,ANIM.calavera);loop(bats,ANIM.murcielagos);loop(ghosts,ANIM.fantasmas)},{threshold:.2}).observe(f);
})();

/* =====================================================================
   AMBIENTES ANIMADOS POR SECCIÓN (canvas)
   >>> PARA CAMBIAR UN EFECTO O SU NIVEL, EDITA SOLO LA LISTA AMBIENTES DE ABAJO <<<
     seccion : selector CSS de la sección donde se dibuja
     efecto  : murcielagos · relampagos · bruja · runas · circulo
     nivel   : 'baja' · 'media' · 'alta'   (más nivel = más frecuencia y cantidad)
   Se pausan fuera de pantalla y se apagan si el visitante activó "reducir movimiento".
   Todo es nivel MEDIA. La lluvia de #historia y la neblina del footer siguen funcionando aparte.
   ===================================================================== */
(()=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const AMBIENTES=[
    {seccion:'#historia',     efecto:'murcielagos', nivel:'media'},   /* Nuestra historia: murciélagos (+ lluvia existente) */
    {seccion:'#pocimas',      efecto:'relampagos',  nivel:'media'},   /* Nuestras pócimas: relámpagos */
    {seccion:'.site-footer',  efecto:'bruja',       nivel:'media'},   /* Footer: bruja en escoba (+ neblina existente) */
    {seccion:'#experiencias', efecto:'runas',       nivel:'media'},   /* Experiencias: runas y estrellas */
    {seccion:'#brujos',       efecto:'circulo',     nivel:'media'}    /* Los brujos: círculo mágico (a la altura del título; ver CIRCULO) */
  ];
  const NIVELES={baja:1,media:2,alta:3},TAU=Math.PI*2,R=Math.random,rr=(a,b)=>a+R()*(b-a);
  const EFECTOS={
    /* Murciélagos: bandadas de 1-3 que cruzan cada 7-13 s (según nivel) */
    murcielagos(ctx,I){let W,H,b,cd;return{
      init(w,h){W=w;H=h;b=[];cd=1},
      step(dt,t){cd-=dt;if(cd<=0){cd=rr(7,13)/(I*.5+.5);const n=1+Math.floor(R()*3),dir=R()<.5?1:-1,y0=rr(H*.08,H*.5);for(let i=0;i<n;i++)b.push({x:dir>0?-40-i*50:W+40+i*50,y:y0+rr(-30,30),v:dir*rr(110,190),ph:rr(0,TAU),s:rr(11,18),dir,bob:rr(0,TAU)})}
        b.forEach(o=>{o.x+=o.v*dt;o.y+=Math.sin(t*2+o.bob)*18*dt});b=b.filter(o=>o.x>-120&&o.x<W+120)},
      draw(t){b.forEach(o=>{const f=.25+.75*Math.abs(Math.sin(t*11+o.ph)),s=o.s;ctx.save();ctx.translate(o.x,o.y);ctx.scale(o.dir,1);ctx.fillStyle='#07050a';ctx.strokeStyle='rgba(217,170,101,.28)';ctx.lineWidth=1;
        ctx.beginPath();ctx.moveTo(0,0);ctx.quadraticCurveTo(-s*.6,-s*1.1*f,-s*1.6,-s*.5*f);ctx.quadraticCurveTo(-s*1.2,-s*.1,-s*1.05,s*.35);ctx.quadraticCurveTo(-s*.75,s*.1,-s*.5,s*.4);ctx.quadraticCurveTo(-s*.3,s*.15,0,s*.45);ctx.quadraticCurveTo(s*.3,s*.15,s*.5,s*.4);ctx.quadraticCurveTo(s*.75,s*.1,s*1.05,s*.35);ctx.quadraticCurveTo(s*1.2,-s*.1,s*1.6,-s*.5*f);ctx.quadraticCurveTo(s*.6,-s*1.1*f,0,0);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.beginPath();ctx.ellipse(0,s*.1,s*.28,s*.45,0,0,TAU);ctx.fill();ctx.beginPath();ctx.moveTo(-s*.2,-s*.3);ctx.lineTo(-s*.15,-s*.7);ctx.lineTo(0,-s*.4);ctx.lineTo(s*.15,-s*.7);ctx.lineTo(s*.2,-s*.3);ctx.fill();ctx.restore()})}}},
    /* Relámpagos: destello morado suave + rayo ramificado cada 8-14 s (nunca estroboscópico) */
    relampagos(ctx,I){let W,H,cd,fl,bolt;const mk=()=>{let x=rr(W*.1,W*.9),y=0;const pts=[[x,y]],segs=[],ty=rr(H*.5,H*.75);while(y<ty){y+=rr(14,30);x+=rr(-22,22);pts.push([x,y]);if(R()<.22){let bx=x,by=y;const br=[[bx,by]];for(let i=0;i<4;i++){bx+=rr(-4,26)*(R()<.5?-1:1);by+=rr(10,20);br.push([bx,by])}segs.push(br)}}segs.push(pts);return segs};
      return{init(w,h){W=w;H=h;cd=2;fl=0;bolt=null},
      step(dt){cd-=dt;if(cd<=0){cd=rr(8,14)/(I*.4+.6);fl=1;bolt=mk()}if(fl>0)fl-=dt*1.1},
      draw(t){if(fl<=0)return;let a=fl>.6?(1-fl)/.4:fl/.6;a=Math.max(0,Math.min(1,a))*(.55+.1*Math.sin(t*40));ctx.fillStyle='rgba(185,160,255,'+a*.26+')';ctx.fillRect(0,0,W,H);ctx.save();ctx.strokeStyle='rgba(240,232,255,'+a+')';ctx.shadowColor='rgba(170,140,255,1)';ctx.shadowBlur=16;bolt.forEach((s,i)=>{ctx.beginPath();s.forEach((p,j)=>j?ctx.lineTo(p[0],p[1]):ctx.moveTo(p[0],p[1]));ctx.lineWidth=i===bolt.length-1?2:1;ctx.stroke()});ctx.restore()}}},
    /* Bruja en escoba: cruza cada 15-25 s dejando chispas doradas */
    bruja(ctx,I){let W,H,w,cd,sp;return{
      init(a,b){W=a;H=b;w=null;cd=2;sp=[]},
      step(dt,t){if(!w){cd-=dt;if(cd<=0){const dir=R()<.5?1:-1;w={x:dir>0?-80:W+80,y:rr(H*.1,H*.42),v:dir*rr(120,170),dir,s:rr(18,24)};cd=rr(15,25)/(I*.4+.6)}}
        if(w){w.x+=w.v*dt;w.y+=Math.sin(t*2)*14*dt;if(R()<dt*40)sp.push({x:w.x-w.dir*w.s*1.6,y:w.y+w.s*.5,l:0,m:rr(.8,1.6),vx:rr(-12,12),vy:rr(5,22)});if(w.x<-120||w.x>W+120)w=null}
        sp.forEach(p=>{p.l+=dt;p.x+=p.vx*dt;p.y+=p.vy*dt});sp=sp.filter(p=>p.l<p.m)},
      draw(t){ctx.globalCompositeOperation='lighter';sp.forEach(p=>{const a=1-p.l/p.m;ctx.fillStyle='rgba(242,196,106,'+a+')';ctx.beginPath();ctx.arc(p.x,p.y,1.6*a+.4,0,TAU);ctx.fill()});ctx.globalCompositeOperation='source-over';
        if(!w)return;const s=w.s;ctx.save();ctx.translate(w.x,w.y);ctx.scale(w.dir,1);ctx.fillStyle='#060407';ctx.strokeStyle='#060407';ctx.lineWidth=2.4;ctx.lineCap='round';
        ctx.beginPath();ctx.moveTo(-s*1.7,s*.55);ctx.lineTo(s*1.2,s*.05);ctx.stroke();ctx.lineWidth=1;for(let i=-3;i<=3;i++){ctx.beginPath();ctx.moveTo(-s*1.7,s*.55);ctx.lineTo(-s*2.5,s*.55+i*s*.14);ctx.stroke()}
        ctx.beginPath();ctx.moveTo(-s*.1,-s*.1);ctx.quadraticCurveTo(-s*.9,-s*.2,-s*1.1,s*.35+Math.sin(t*8)*s*.05);ctx.quadraticCurveTo(-s*.5,s*.25,s*.15,s*.3);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.ellipse(0,-s*.25,s*.28,s*.4,.3,0,TAU);ctx.fill();ctx.beginPath();ctx.arc(s*.28,-s*.72,s*.2,0,TAU);ctx.fill();
        ctx.beginPath();ctx.moveTo(s*.02,-s*.8);ctx.lineTo(s*.2,-s*1.65);ctx.lineTo(s*.55,-s*.85);ctx.closePath();ctx.fill();ctx.beginPath();ctx.ellipse(s*.3,-s*.82,s*.45,s*.09,-.1,0,TAU);ctx.fill();ctx.restore()}}},
    /* Runas y estrellas: estrellas que titilan, estrella fugaz cada 6-11 s y runas doradas que flotan */
    runas(ctx,I){let W,H,s,u,cd,sh,cs;return{
      init(w,h){W=w;H=h;s=[];const n=Math.round(W*H/5200);for(let i=0;i<n;i++)s.push({x:rr(0,W),y:rr(0,H*.75),r:rr(.4,1.4),p:rr(0,TAU),v:rr(.8,2.4)});u=[];cd=0;sh=null;cs=3},
      step(dt){cd-=dt;if(cd<=0){cd=rr(1.4,2.4)/(I*.4+.6);const G='ᚠᚢᚦᚨᚱᚲᚷᚹᛁᛇ';u.push({x:rr(W*.05,W*.95),y:rr(H*.35,H*.9),g:G[Math.floor(R()*G.length)],l:0,m:rr(4,6),sz:rr(18,30)})}
        u.forEach(o=>{o.l+=dt;o.y-=14*dt});u=u.filter(o=>o.l<o.m);cs-=dt;if(cs<=0){cs=rr(6,11);sh={x:rr(W*.3,W*.9),y:rr(0,H*.3),l:0,v:rr(380,520)}}if(sh){sh.l+=dt;sh.x-=sh.v*dt;sh.y+=sh.v*.45*dt;if(sh.l>1)sh=null}},
      draw(t){s.forEach(o=>{ctx.fillStyle='rgba(255,236,200,'+(.25+.6*(.5+.5*Math.sin(t*o.v+o.p)))+')';ctx.beginPath();ctx.arc(o.x,o.y,o.r,0,TAU);ctx.fill()});
        if(sh){const a=1-sh.l,g=ctx.createLinearGradient(sh.x,sh.y,sh.x+90,sh.y-40);g.addColorStop(0,'rgba(255,240,210,'+a+')');g.addColorStop(1,'rgba(255,240,210,0)');ctx.strokeStyle=g;ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(sh.x,sh.y);ctx.lineTo(sh.x+90,sh.y-40);ctx.stroke()}
        u.forEach(o=>{const k=o.l/o.m,a=Math.sin(Math.PI*k);ctx.save();ctx.globalAlpha=a*.85;ctx.font='700 '+o.sz+'px serif';ctx.textAlign='center';ctx.fillStyle='#e8b868';ctx.shadowColor='#f2a33a';ctx.shadowBlur=14;ctx.fillText(o.g,o.x,o.y);ctx.restore()})}}}
    ,
    /* Círculo mágico: aros de runas que giran despacio y pulsan.
       CIRCULO.x = posición horizontal del centro (0.17 = 17 % del ancho, detrás del título; sube el número para moverlo hacia los personajes). La altura se alinea sola con el título "LOS BRUJOS".
       CIRCULO.tam = tamaño (1 = normal, 1.2 = 20 % más grande). CIRCULO.giro = velocidad de giro de las runas. */
    circulo(ctx,I,sec){const CIRCULO={x:.17,tam:1,giro:.12};
      const G='\u16a0\u16a2\u16a6\u16a8\u16b1\u16b2\u16b7\u16b9\u16c1\u16c7\u16c9\u16d2';let W,H,cy;
      return{init(w,h){W=w;H=h;const t=sec.querySelector('h2');cy=h/2;if(t){const a=t.getBoundingClientRect(),b=sec.getBoundingClientRect();cy=a.top-b.top+a.height/2}},
      step(){},
      draw(t){const cx=W*CIRCULO.x,r=Math.min(H*.46,W*.28)*CIRCULO.tam,pu=.5+.5*Math.sin(t*1.2);ctx.save();ctx.translate(cx,cy);ctx.strokeStyle='rgba(217,170,101,'+(.22+.12*pu)+')';ctx.shadowColor='#d9aa65';ctx.shadowBlur=10;ctx.lineWidth=1.2;[r,r*.86,r*.5].forEach(x=>{ctx.beginPath();ctx.arc(0,0,x,0,TAU);ctx.stroke()});
        ctx.save();ctx.rotate(t*CIRCULO.giro);ctx.font='600 '+r*.1+'px serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(232,184,104,'+(.4+.25*pu)+')';for(let i=0;i<G.length;i++){ctx.save();ctx.rotate(i/G.length*TAU);ctx.translate(0,-r*.93);ctx.fillText(G[i],0,0);ctx.restore()}ctx.restore();
        ctx.rotate(-t*.08);ctx.beginPath();for(let i=0;i<5;i++){const a=i*TAU*2/5-Math.PI/2;ctx.lineTo(Math.cos(a)*r*.5,Math.sin(a)*r*.5)}ctx.closePath();ctx.stroke();ctx.restore()}}}
  };
  const inst=[];let raf=0,last=0;
  AMBIENTES.forEach(cfg=>{
    const sec=document.querySelector(cfg.seccion);if(!sec||!EFECTOS[cfg.efecto])return;
    const cv=document.createElement('canvas');cv.className='amb-cv amb-'+cfg.efecto;cv.setAttribute('aria-hidden','true');sec.classList.add('amb-sec');sec.insertBefore(cv,sec.firstChild);
    const ctx=cv.getContext('2d');if(!ctx)return;
    const o={sec,cv,ctx,fx:EFECTOS[cfg.efecto](ctx,NIVELES[cfg.nivel]||2,sec),vis:false,W:0,H:0};
    const size=()=>{const dpr=Math.min(devicePixelRatio||1,1.5);o.W=sec.clientWidth;o.H=sec.clientHeight;if(!o.W||!o.H)return;cv.width=o.W*dpr;cv.height=o.H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0);o.fx.init(o.W,o.H)};
    if('ResizeObserver' in window)new ResizeObserver(size).observe(sec);else addEventListener('resize',size);
    new IntersectionObserver(e=>{o.vis=e[0].isIntersecting;go()},{threshold:0}).observe(sec);
    size();inst.push(o);
  });
  function frame(now){
    raf=requestAnimationFrame(frame);const dt=Math.min((now-last)/1000||0,.05);last=now;let any=false;
    inst.forEach(o=>{if(!o.vis||!o.W)return;any=true;o.ctx.clearRect(0,0,o.W,o.H);o.fx.step(dt,now/1000);o.fx.draw(now/1000)});
    if(!any){cancelAnimationFrame(raf);raf=0}
  }
  function go(){if(!raf&&!document.hidden&&inst.some(o=>o.vis)){last=performance.now();raf=requestAnimationFrame(frame)}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0}else go()});
})();
