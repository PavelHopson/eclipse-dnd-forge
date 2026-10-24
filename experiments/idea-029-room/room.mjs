import {freshState,freshCamera,moveCamera,geometry,viewProjection,pick} from './scene.mjs';
const canvas=document.querySelector('#scene'),reply=document.querySelector('#reply'),controls=document.querySelector('#controls');
const objectButtons=[...document.querySelectorAll('[data-object]')],abort=new AbortController(),signal=abort.signal;
let state=freshState(),camera=freshCamera(),gl,program,buffer,frame=0,vertices=0,ready=false,disposed=false,drag=null;
const shaders=[],samples=[];
const metrics={frames:0,cpuSubmitMs:0,vertices:0};
const motion=matchMedia('(prefers-reduced-motion: reduce)');
function listen(el,type,fn,options={}){el.addEventListener(type,fn,{...options,signal})}
const descriptions={lamp:['Жаровня погашена. Остался холодный свет сверху.','Жаровня зажжена. Тёплый свет ложится на соседние плиты.'],chest:['Крышка сундука закрыта.','В сундуке лежит медная печать смотрителя.'],gate:['Решётка опущена. Проход закрыт.','Решётка поднята. За ней — проход к старому маяку.']};
const labels={lamp:['Разжечь жаровню','Погасить жаровню','Погашена','Горит'],chest:['Открыть сундук','Закрыть сундук','Закрыт','Открыт'],gate:['Поднять решётку','Опустить решётку','Опущена','Поднята']};
function ui(){for(const b of objectButtons){const value=Number(state[b.dataset.object]),l=labels[b.dataset.object];b.setAttribute('aria-pressed',String(!!value));b.querySelector('strong').textContent=l[value];b.querySelector('.state').textContent=l[value+2]}}
function upload(){const mesh=geometry(state);vertices=mesh.length/9;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);metrics.vertices=vertices}
function act(id){if(!ready||!Object.hasOwn(state,id))return;state[id]=!state[id];ui();reply.textContent=descriptions[id][Number(state[id])];upload();schedule()}
function change(action){if(!ready)return;camera=moveCamera(camera,action);schedule()}
function reset(){if(!ready)return;state=freshState();camera=freshCamera();ui();upload();reply.textContent='Комната и камера возвращены в исходное состояние.';schedule()}
function fail(message){ready=false;cancelAnimationFrame(frame);frame=0;controls.disabled=true;objectButtons.forEach(b=>b.disabled=true);document.querySelector('#failure').hidden=false;document.querySelector('#failure-text').textContent=message;document.querySelector('#render-state').textContent='3D недоступно';reply.textContent='Предметы недоступны до повторного запуска.';canvas.tabIndex=-1}
function shader(type,source){const s=gl.createShader(type);if(!s)throw Error('shader allocation');shaders.push(s);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('shader compilation');return s}
function schedule(){if(!ready||disposed||document.hidden||frame)return;frame=requestAnimationFrame(draw)}
function draw(){
  frame=0;if(!ready||disposed||document.hidden)return;
  const start=performance.now(),rect=canvas.getBoundingClientRect(),ratio=Math.min(devicePixelRatio||1,1.5);
  const w=Math.max(1,Math.round(rect.width*ratio)),h=Math.max(1,Math.round(rect.height*ratio));
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
  gl.viewport(0,0,w,h);gl.clearColor(.125,.16,.175,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  gl.uniformMatrix4fv(gl.getUniformLocation(program,'vp'),false,viewProjection(camera,w/h));
  gl.uniform1f(gl.getUniformLocation(program,'lit'),state.lamp?1:0);
  gl.drawArrays(gl.TRIANGLES,0,vertices);
  metrics.frames++;metrics.cpuSubmitMs=performance.now()-start;samples.push(metrics.cpuSubmitMs);if(samples.length>120)samples.shift();
  // Observable diagnostic values, not a claimed FPS or GPU render duration.
  canvas.dataset.frames=String(metrics.frames);canvas.dataset.cpuSubmitMs=metrics.cpuSubmitMs.toFixed(3);canvas.dataset.vertices=String(vertices);canvas.dataset.camera=JSON.stringify(camera);
}
function dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);frame=0;resize.disconnect();abort.abort();if(gl){if(buffer)gl.deleteBuffer(buffer);if(program)gl.deleteProgram(program);shaders.forEach(s=>gl.deleteShader(s))}canvas.dataset.disposed='true'}
const resize=new ResizeObserver(schedule);resize.observe(canvas);
listen(window,'pagehide',dispose);listen(window,'pageshow',e=>{if(e.persisted)location.reload()});
listen(document.querySelector('#retry'),'click',()=>location.reload());
listen(canvas,'webglcontextlost',e=>{e.preventDefault();fail('Графический контекст потерян. Повторите запуск — комната начнётся заново.')});
listen(document,'visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;drag=null}else schedule()});
function motionUI(){drag=null;document.querySelector('#motion').textContent=motion.matches?'Уменьшение движения включено: камера меняется шагами кнопками и клавиатурой.':'Нет автоматического движения. Камера движется только по вашему действию.'}
listen(motion,'change',motionUI);motionUI();
objectButtons.forEach(b=>listen(b,'click',()=>act(b.dataset.object)));
document.querySelectorAll('[data-camera]').forEach(b=>listen(b,'click',()=>change(b.dataset.camera)));
listen(document.querySelector('#reset'),'click',reset);
const keys={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down',w:'north',a:'west',s:'south',d:'east','+':'in','=':'in','-':'out'};
listen(canvas,'keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;const key=e.key.length===1?e.key.toLowerCase():e.key;if(keys[key]){e.preventDefault();change(keys[key])}else if(key==='r'){e.preventDefault();reset()}});
listen(canvas,'pointerdown',e=>{if(!ready||!e.isPrimary||e.button!==0)return;canvas.focus({preventScroll:true});drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,id:e.pointerId};canvas.setPointerCapture(e.pointerId)});
listen(canvas,'pointermove',e=>{if(!drag||e.pointerId!==drag.id)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(e.clientX-drag.startX,e.clientY-drag.startY)>5)drag.moved=true;if(!motion.matches&&drag.moved){camera=moveCamera({...camera,yaw:camera.yaw+dx*.006,pitch:camera.pitch+dy*.006},'clamp');schedule()}drag.x=e.clientX;drag.y=e.clientY});
listen(canvas,'pointerup',e=>{if(!drag||e.pointerId!==drag.id)return;const click=!drag.moved;drag=null;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);if(click){const r=canvas.getBoundingClientRect(),id=pick(camera,r.width/r.height,2*(e.clientX-r.left)/r.width-1,1-2*(e.clientY-r.top)/r.height);if(id)act(id);else reply.textContent='Выберите жаровню, сундук или решётку. Кнопки справа доступны всегда.'}});
listen(canvas,'pointercancel',()=>drag=null);listen(canvas,'lostpointercapture',()=>drag=null);
listen(canvas,'wheel',e=>{if(!ready||motion.matches)return;e.preventDefault();change(e.deltaY<0?'in':'out')},{passive:false});
try{
  gl=canvas.getContext('webgl',{alpha:false,antialias:true,preserveDrawingBuffer:false});
  if(!gl)throw Error('WebGL unavailable');
  program=gl.createProgram();buffer=gl.createBuffer();if(!program||!buffer)throw Error('GPU allocation');
  gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec3 position;attribute vec3 normal;attribute vec3 color;uniform mat4 vp;varying vec3 p;varying vec3 n;varying vec3 c;void main(){p=position;n=normal;c=color;gl_Position=vp*vec4(position,1.);}`));
  gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec3 p;varying vec3 n;varying vec3 c;uniform float lit;void main(){vec3 d=vec3(-3.,2.3,.7)-p;float falloff=1./(1.+dot(d,d)*.09);float sun=max(dot(normalize(n),normalize(vec3(2.,7.,3.))),0.);float fire=max(dot(normalize(n),normalize(d)),0.)*falloff*lit;vec3 light=vec3(.40,.48,.52)+vec3(.55,.60,.63)*sun+vec3(1.6,.8,.24)*fire;gl_FragColor=vec4(c*light,1.);}`));
  gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader link');
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  ['position','normal','color'].forEach((name,i)=>{const a=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,36,i*12)});
  upload();ready=true;controls.disabled=false;objectButtons.forEach(b=>b.disabled=false);ui();reply.textContent='Зажгите жаровню или откройте один из предметов.';document.querySelector('#render-state').textContent='WEBGL · ПО ДЕЙСТВИЮ';schedule();
}catch{fail('Браузер не смог запустить WebGL. Проверьте аппаратное ускорение или откройте preview в другом браузере. Данные кампаний не затронуты.')}
