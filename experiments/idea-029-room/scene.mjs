// Original geometry and small, bounded camera math. No engine or campaign imports.
export const freshState=()=>({lamp:false,chest:false,gate:false});
export const freshCamera=()=>({yaw:.55,pitch:.78,distance:19,x:0,z:0});
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function moveCamera(c,action){
  const n={...c};
  if(action==='left')n.yaw-=.15;if(action==='right')n.yaw+=.15;
  if(action==='up')n.pitch+=.08;if(action==='down')n.pitch-=.08;
  if(action==='in')n.distance-=1;if(action==='out')n.distance+=1;
  if(action==='west')n.x-=.4;if(action==='east')n.x+=.4;
  if(action==='north')n.z-=.4;if(action==='south')n.z+=.4;
  return {...n,yaw:clamp(n.yaw,-.9,1.35),pitch:clamp(n.pitch,.35,1.25),distance:clamp(n.distance,12,27),x:clamp(n.x,-2,2),z:clamp(n.z,-2,2)};
}
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
export const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const norm=a=>{const d=Math.hypot(...a)||1;return a.map(v=>v/d)};
export function cameraBasis(c){
  const target=[c.x,.7,c.z],eye=[c.x+Math.sin(c.yaw)*Math.cos(c.pitch)*c.distance,.7+Math.sin(c.pitch)*c.distance,c.z+Math.cos(c.yaw)*Math.cos(c.pitch)*c.distance];
  const back=norm(sub(eye,target)),right=norm(cross([0,1,0],back)),up=cross(back,right);
  return {eye,back,right,up};
}
export function viewProjection(c,aspect){
  const {eye,back:b,right:r,up:u}=cameraBasis(c),v=[r[0],u[0],b[0],0,r[1],u[1],b[1],0,r[2],u[2],b[2],0,-dot(r,eye),-dot(u,eye),-dot(b,eye),1];
  const f=1/Math.tan(Math.PI/8),p=[f/aspect,0,0,0,0,f,0,0,0,0,-101/99,-1,0,0,-200/99,0];
  return new Float32Array(Array.from({length:16},(_,i)=>{const row=i%4,col=Math.floor(i/4);let s=0;for(let k=0;k<4;k++)s+=p[k*4+row]*v[col*4+k];return s}));
}
export const targets=[{id:'lamp',min:[-3.7,0,0],max:[-2.3,2.5,1.4]},{id:'chest',min:[1.3,0,.9],max:[3.7,2,2.6]},{id:'gate',min:[.3,0,-4.5],max:[3.3,4.5,-3.8]}];
export function rayBox(origin,dir,min,max){
  let near=0,far=Infinity;
  for(let i=0;i<3;i++){if(Math.abs(dir[i])<1e-8){if(origin[i]<min[i]||origin[i]>max[i])return Infinity;continue}const a=(min[i]-origin[i])/dir[i],b=(max[i]-origin[i])/dir[i];near=Math.max(near,Math.min(a,b));far=Math.min(far,Math.max(a,b));if(near>far)return Infinity}return near;
}
export function pick(c,aspect,nx,ny){
  const {eye,back,right,up}=cameraBasis(c),t=Math.tan(Math.PI/8),dir=norm(back.map((v,i)=>-v+right[i]*nx*t*aspect+up[i]*ny*t));
  const hits=targets.map(o=>({id:o.id,d:rayBox(eye,dir,o.min,o.max)})).sort((a,b)=>a.d-b.d);
  return Number.isFinite(hits[0].d)?hits[0].id:null;
}
export function geometry(s){
  const data=[],stone=[.39,.44,.43],trim=[.52,.52,.45],iron=[.15,.21,.23],wood=[.36,.19,.10];
  function box(x,y,z,w,h,d,color,angle=0){
    const verts=[[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]].map(([a,b,c])=>{const py=b*h/2,pz=c*d/2;return[x+a*w/2,y+py*Math.cos(angle)-pz*Math.sin(angle),z+py*Math.sin(angle)+pz*Math.cos(angle)]});
    for(const q of [[0,3,2,1],[4,5,6,7],[0,4,7,3],[1,2,6,5],[3,7,6,2],[0,1,5,4]]){const n=norm(cross(sub(verts[q[1]],verts[q[0]]),sub(verts[q[2]],verts[q[0]])));for(const j of [0,1,2,0,2,3])data.push(...verts[q[j]],...n,...color)}
  }
  box(0,-.4,0,12,.7,10,[.19,.25,.26]);
  for(let x=0;x<10;x++)for(let z=0;z<8;z++){const c=.29+((x*7+z*3)%5)*.018;box(-5.4+x*1.2,-.01,-4.3+z*1.2,1.16,.18,1.16,[c,c+.06,c+.055])}
  // Two cutaway walls keep the room legible; the opening is real geometry.
  for(let row=0;row<4;row++)for(let col=0;col<10;col++){const x=-5.4+col*1.2;if(x>.2&&x<3.4&&row<3)continue;box(x,.5+row*.95,-4.55,1.16,.9,.5,stone)}
  for(let row=0;row<3;row++)for(let col=0;col<8;col++)box(-5.7,.5+row*.95,-4.2+col*1.2,.5,.9,1.16,stone);
  for(const x of [-5.2,-.1,3.7,5.3]){box(x,1.8,-4.2,.65,3.6,.85,trim);box(x,3.65,-4.2,.9,.22,1,trim);box(x,.15,-4.2,.95,.3,1,trim)}
  box(1.8,3.45,-4.1,3.9,.5,.9,trim);box(1.8,.12,-4.7,3.2,.16,1.4,trim);
  const lift=s.gate?2.65:0;
  for(let i=0;i<7;i++)box(.5+i*.43,1.45+lift,-4.05,.10,2.9,.12,iron);
  for(const y of [.5,2.5])box(1.8,y+lift,-4.05,2.8,.13,.15,iron);
  // Copper brazier: extinguished coals or a faceted flame, plus shader light.
  box(-3,.22,.7,1.3,.4,1.3,trim);box(-3,.85,.7,.46,1,.46,iron);box(-3,1.42,.7,1.3,.22,1.3,[.46,.28,.14]);
  box(-3,1.56,.7,.9,.1,.9,s.lamp?[1,.55,.10]:[.11,.12,.12]);
  if(s.lamp){box(-3,1.85,.7,.36,.6,.4,[1,.69,.2],.2);box(-3.2,1.75,.85,.18,.45,.22,[1,.38,.06],-.3)}
  // Chest rim, hollow interior and visibly raised lid.
  box(2.5,.2,1.7,2.25,.3,1.4,wood);
  for(const z of [1.05,2.35])box(2.5,.62,z,2.25,.72,.12,wood);
  for(const x of [1.45,3.55])box(x,.62,1.7,.14,.72,1.4,wood);
  box(2.5,s.chest?1.58:1.04,s.chest?1.12:1.7,2.25,.18,1.4,[.45,.26,.13],s.chest?-1.25:0);
  for(const x of [1.7,3.3])box(x,.65,2.43,.12,.7,.04,[.69,.52,.24]);
  box(2.5,.57,1.7,.7,.2,.6,[.77,.63,.28]);
  // Quiet environmental details, not extra interactive props.
  for(const [x,z] of [[-4,-3],[-4.5,-2.7],[4,-2],[4.6,-1.8]])box(x,.16,z,.55,.3,.65,stone);
  box(-.7,.13,-.4,1.1,.13,2.7,[.28,.17,.13]);
  return new Float32Array(data);
}
