(()=>{
'use strict';
/* ========== 기본 수학 ========== */
const CX=500, CY=500, CAR_L=72, CAR_W=36, KMH=4.44;
const V=(x,y)=>({x,y});
const add=(a,b)=>V(a.x+b.x,a.y+b.y), sub=(a,b)=>V(a.x-b.x,a.y-b.y), mul=(a,k)=>V(a.x*k,a.y*k);
const len=a=>Math.hypot(a.x,a.y), neg=a=>V(-a.x,-a.y);
const rightOf=h=>V(-h.y,h.x);
const eqv=(a,b)=>Math.abs(a.x-b.x)<1e-6&&Math.abs(a.y-b.y)<1e-6;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const lerp=(a,b,t)=>a+(b-a)*t;
const sstep=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const smooth=(a,b,x)=>sstep((x-a)/(b-a));
const norm=a=>{const l=len(a)||1;return V(a.x/l,a.y/l);};
const D2R=Math.PI/180;
const inView=(p,m=0)=>p.x>-m&&p.x<1000+m&&p.y>-m&&p.y<1000+m;

const ARMS={N:V(0,-1),S:V(0,1),E:V(1,0),W:V(-1,0)};
const ARMDEG={E:0,S:90,W:180,N:270};
const CROSS={hwV:70,hwH:70,lanesV:[35],lanesH:[35]};
const MAPS={
  sig:Object.assign({name:'신호 교차로',kind:'cross',lights:['G','Y','L','R'],limit:50,snap:true},CROSS),
  sig4:{name:'왕복 4차로 사거리',kind:'cross',hwV:124,hwH:124,lanesV:[31,93],lanesH:[31,93],lights:['G','Y','L','R'],limit:60,snap:true},
  flash:Object.assign({name:'점멸 신호',kind:'cross',lights:['YF','RF'],limit:50,snap:true,flash:true,first:true},CROSS),
  nosig_eq:Object.assign({name:'신호 없는 교차로',kind:'cross',limit:50,snap:true,first:true},CROSS),
  nosig_main:{name:'대로와 소로',kind:'cross',hwV:62,hwH:124,lanesV:[31],lanesH:[31,93],mainH:true,limit:50,snap:true,first:true},
  tee:Object.assign({name:'삼거리',kind:'cross',tee:true,limit:50,snap:true,first:true},CROSS),
  round:{name:'회전교차로',kind:'round',limit:30},
  road2:{name:'편도 2차로',kind:'road',lanes:[460,540],limit:60,snap:true},
  road3:{name:'편도 3차로',kind:'road',lanes:[420,500,580],limit:80,snap:true},
  two:{name:'왕복 2차로',kind:'two',limit:50,snap:true},
  park:{name:'주차장',kind:'park',limit:10}
};
const MAN={straight:'직진',left:'좌회전',right:'우회전',uturn:'유턴'};
const UT={signal:'신호 유턴',always:'상시 유턴',illegal:'유턴 금지 구역'};
const LIGHT={G:'녹색',Y:'황색',L:'좌회전 신호',R:'적색',YF:'황색 점멸',RF:'적색 점멸'};
const ARMNAME={N:'위쪽',S:'아래쪽',E:'오른쪽',W:'왼쪽'};

/* ========== 경로 ========== */
function makePath(pts){const s=[0];for(let i=1;i<pts.length;i++)s.push(s[i-1]+len(sub(pts[i],pts[i-1])));return{pts,s,L:s[s.length-1]};}
function lineS(a,b,step=8){const n=Math.max(1,Math.ceil(len(sub(b,a))/step));const o=[];for(let i=0;i<=n;i++)o.push(V(lerp(a.x,b.x,i/n),lerp(a.y,b.y,i/n)));return o;}
function bezS(p0,p1,p2,p3,n){const o=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;o.push(V(u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y));}return o;}
const cat=(...ls)=>{const o=[];for(const l of ls){for(const p of l){const q=o[o.length-1];if(!q||len(sub(p,q))>.5)o.push(p);}}return o;};
function pathAt(p,d){
  if(d<=0)return p.pts[0]; if(d>=p.L)return p.pts[p.pts.length-1];
  let lo=0,hi=p.s.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(p.s[m]<=d)lo=m;else hi=m;}
  const t=(d-p.s[lo])/((p.s[hi]-p.s[lo])||1);return V(lerp(p.pts[lo].x,p.pts[hi].x,t),lerp(p.pts[lo].y,p.pts[hi].y,t));
}
function pathAng(p,d){const a=pathAt(p,clamp(d-8,0,p.L-16)),b=pathAt(p,clamp(d+8,16,p.L));return Math.atan2(b.y-a.y,b.x-a.x);}
function nearestS(p,q){let best=0,bd=1e18;for(let i=0;i<p.pts.length;i++){const d=len(sub(p.pts[i],q));if(d<bd){bd=d;best=p.s[i];}}return best;}
function viewRange(p,m=0){let a=null,b=null;for(let i=0;i<p.pts.length;i++)if(inView(p.pts[i],m)){if(a===null)a=p.s[i];b=p.s[i];}return a===null?[0,p.L]:[a,b];}
function resample(pts,step){
  if(pts.length<2)return pts.slice();const o=[pts[0]];let acc=0,prev=pts[0];
  for(let i=1;i<pts.length;i++){let cur=pts[i],d=len(sub(cur,prev));
    while(acc+d>=step){const t=(step-acc)/d;const np=V(lerp(prev.x,cur.x,t),lerp(prev.y,cur.y,t));o.push(np);prev=np;d=len(sub(cur,prev));acc=0;}
    acc+=d;prev=cur;}
  const l=pts[pts.length-1];if(len(sub(l,o[o.length-1]))>step*.4)o.push(l);return o;
}
function smoothPts(pts,pass=4,w=3){let a=pts.slice();for(let k=0;k<pass;k++){const b=a.slice();for(let i=1;i<a.length-1;i++){let sx=0,sy=0,n=0;for(let j=-w;j<=w;j++){const q=a[clamp(i+j,0,a.length-1)];sx+=q.x;sy+=q.y;n++;}b[i]=V(sx/n,sy/n);}a=b;}return a;}
function extendPts(pts){
  const n=pts.length,k=Math.min(4,n-1);
  const d0=norm(sub(pts[0],pts[k])),d1=norm(sub(pts[n-1],pts[n-1-k]));
  return cat(lineS(add(pts[0],mul(d0,1100)),pts[0],10),pts,lineS(pts[n-1],add(pts[n-1],mul(d1,1100)),10));
}
function extendFor(mk,pts,info){
  if(MAPS[mk].kind!=='round'||!info||info.role!=='ring')return extendPts(pts);
  const p0=pts[0],r=clamp(len(sub(p0,V(CX,CY))),120,215),a0=Math.atan2(p0.y-CY,p0.x-CX),arc=[];
  for(let i=60;i>=1;i--){const a=a0+i*4*D2R;arc.push(V(CX+r*Math.cos(a),CY+r*Math.sin(a)));}
  const e=extendPts(pts);const k=e.findIndex(q=>len(sub(q,p0))<.6);
  return cat(arc,e.slice(k<0?0:k));
}
function clipPts(path){
  let best=[],cur=[];for(const p of path.pts){if(inView(p,90))cur.push(p);else{if(cur.length>best.length)best=cur;cur=[];}}
  if(cur.length>best.length)best=cur;return best;
}

const vertV=v=>Math.abs(v.x)<.5;
const UZONE=150;
const lanesOf=(g,dir)=>vertV(dir)?g.lanesV:g.lanesH;
function defLane(g,dir,man,isOut){const L=lanesOf(g,dir);if(L.length===1)return 1;if(man==='left')return 1;if(man==='right')return L.length;if(man==='uturn')return isOut?L.length:1;return L.length;}
function exitDir(arm,man){const h=neg(ARMS[arm]);return man==='straight'?h:man==='left'?neg(rightOf(h)):man==='right'?rightOf(h):neg(h);}
function exitArm(arm,man){const e=exitDir(arm,man);return Object.keys(ARMS).find(k=>eqv(ARMS[k],e));}
function crossPath(g,arm,man,li,lo){
  const d=ARMS[arm],h=neg(d),e=exitDir(arm,man),C=V(CX,CY);
  const Lin=lanesOf(g,h),Lout=lanesOf(g,e);
  const offIn=Lin[clamp((li||defLane(g,h,man,false))-1,0,Lin.length-1)],offOut=Lout[clamp((lo||defLane(g,e,man,true))-1,0,Lout.length-1)];
  const alIn=vertV(h)?g.hwH:g.hwV, alOut=vertV(e)?g.hwH:g.hwV;
  const rin=rightOf(h), rout=rightOf(e);
  const start=add(add(C,mul(rin,offIn)),mul(h,-1300));
  const entry=add(add(C,mul(rin,offIn)),mul(h,-alIn));
  const exit=add(add(C,mul(rout,offOut)),mul(e,alOut));
  const end=add(add(C,mul(rout,offOut)),mul(e,1300));
  if(man==='uturn'){
    // 실제처럼 교차로 안이 아니라 정지선 앞 유턴 구역에서 돈다
    const cw=g.lights&&!g.flash?40:0,stop=alIn+cw+20,Ls=Math.max(60,(offIn+offOut)*.8),k=Ls/.75;
    const p0=add(add(C,mul(rin,offIn)),mul(h,-(stop+Ls))),p3=add(add(C,mul(rout,offOut)),mul(e,stop+Ls));
    return makePath(cat(lineS(start,p0),bezS(p0,add(p0,mul(h,k)),sub(p3,mul(e,k)),p3,60),lineS(p3,end)));
  }
  if(man==='straight'){
    if(Math.abs(offIn-offOut)<1)return makePath(lineS(start,end));
    return makePath(cat(lineS(start,entry),bezS(entry,add(entry,mul(h,alIn*.7)),sub(exit,mul(e,alOut*.7)),exit,30),lineS(exit,end)));
  }
  const k=len(sub(exit,entry))*.52;
  return makePath(cat(lineS(start,entry),bezS(entry,add(entry,mul(h,k)),sub(exit,mul(e,k)),exit,56),lineS(exit,end)));
}
function roadPath(m,lane,to,zone=480){
  const x1=m.lanes[lane-1],x2=m.lanes[to-1];
  if(lane===to)return makePath(lineS(V(x1,1600),V(x1,-600)));
  const z0=zone+115,z1=zone-115,mid=[];
  for(let i=0;i<=48;i++){const t=i/48;mid.push(V(lerp(x1,x2,sstep(t)),lerp(z0,z1,t)));}
  return makePath(cat(lineS(V(x1,1600),V(x1,z0)),mid,lineS(V(x2,z1),V(x2,-600))));
}
function twoPath(dir,invade,zone=700){
  if(dir==='down')return makePath(lineS(V(460,-600),V(460,1600)));
  if(!invade)return makePath(lineS(V(540,1600),V(540,-600)));
  const mid=[];for(let i=0;i<=40;i++){const t=i/40;mid.push(V(lerp(540,460,sstep(t)),lerp(zone,zone-150,t)));}
  return makePath(cat(lineS(V(540,1600),V(540,zone)),mid,lineS(V(460,zone-150),V(460,-600))));
}
function ringPath(from,to){
  const C=V(CX,CY),R=158,d=ARMS[from],h=neg(d),rin=rightOf(h);
  const far=add(add(C,mul(rin,35)),mul(d,1300)),a1=add(add(C,mul(rin,35)),mul(d,250));
  const th=a=>V(CX+R*Math.cos(a*D2R),CY+R*Math.sin(a*D2R)), tan=a=>V(Math.sin(a*D2R),-Math.cos(a*D2R));
  const tin=ARMDEG[from]-28,tout=ARMDEG[to]+28;
  let delta=((tin-tout)%360+360)%360;if(delta<20)delta+=360;
  const pin=th(tin),arc=[];const n=Math.ceil(delta/3);for(let i=0;i<=n;i++)arc.push(th(tin-delta*i/n));
  const pout=th(tin-delta),e=ARMS[to],rout=rightOf(e),b1=add(add(C,mul(rout,35)),mul(e,250));
  return makePath(cat(lineS(far,a1),bezS(a1,add(a1,mul(h,60)),sub(pin,mul(tan(tin),55)),pin,24),arc,
    bezS(pout,add(pout,mul(tan(tin-delta),55)),sub(b1,mul(e,60)),b1,24),lineS(b1,add(add(C,mul(rout,35)),mul(e,1300)))));
}
function parkPath(role,dir){
  if(role==='aisle')return dir==='W'?makePath(lineS(V(1600,480),V(-600,480))):makePath(lineS(V(-600,520),V(1600,520)));
  return makePath(cat(lineS(V(640,1300),V(640,600)),bezS(V(640,600),V(640,520),V(600,480),V(530,480),24),lineS(V(530,480),V(-600,480))));
}
function templatePath(m,c){
  if(m.kind==='cross')return crossPath(m,c.arm,c.man,c.li,c.lo);
  if(m.kind==='road')return roadPath(m,c.lane,c.to,c.zone);
  if(m.kind==='two')return twoPath(c.dir,c.invade,c.zone);
  if(m.kind==='round')return ringPath(c.from,c.to);
  return parkPath(c.role,c.dir);
}

/* ========== 궤적 판별 ========== */
function classify(mk,pts){
  const m=MAPS[mk];
  if(!pts||pts.length<4)return{err:'조금 더 길게 그려주세요'};
  const first=pts[0],last=pts[pts.length-1];
  if(m.kind==='cross'){
    const C=V(CX,CY),far=pts.filter(p=>len(sub(p,C))>150);
    if(far.length<2)return{err:'교차로 바깥 길에서 시작해 다른 길로 빠져나가게 그려주세요'};
    const armOf=p=>{const dx=p.x-CX,dy=p.y-CY;return Math.abs(dx)>Math.abs(dy)?(dx>0?'E':'W'):(dy>0?'S':'N');};
    const a0=armOf(far[0]),a1=armOf(far[far.length-1]);
    if(m.tee&&(a0==='N'||a1==='N'))return{err:'삼거리라 위쪽 길은 없어요'};
    const h=neg(ARMS[a0]),e=ARMS[a1];
    const man=a0===a1?'uturn':eqv(e,h)?'straight':eqv(e,rightOf(h))?'right':'left';
    const laneIdx=(L,off)=>{let bi=0;L.forEach((x,i)=>{if(Math.abs(off-x)<Math.abs(off-L[bi]))bi=i;});return bi+1;};
    const li=laneIdx(lanesOf(m,h),Math.max(0,(far[0].x-CX)*rightOf(h).x+(far[0].y-CY)*rightOf(h).y));
    const fl=far[far.length-1],lo=laneIdx(lanesOf(m,e),Math.max(0,(fl.x-CX)*rightOf(e).x+(fl.y-CY)*rightOf(e).y));
    return{arm:a0,man,li,lo};
  }
  if(m.kind==='road'){
    let ps=pts;if(first.y<last.y)ps=pts.slice().reverse();
    const a=ps[0],b=ps[ps.length-1];if(a.y-b.y<150)return{err:'아래에서 위로 길게 그려주세요'};
    const ln=x=>{let bi=0;m.lanes.forEach((lx,i)=>{if(Math.abs(x-lx)<Math.abs(x-m.lanes[bi]))bi=i;});return bi+1;};
    const lane=ln(a.x),to=ln(b.x);let zone=480;
    if(lane!==to){const mx=(m.lanes[lane-1]+m.lanes[to-1])/2;for(const p of ps)if((m.lanes[to-1]-mx)*(p.x-mx)>0){zone=clamp(p.y,250,800);break;}}
    return{lane,to,y0:a.y,zone,flip:ps!==pts};
  }
  if(m.kind==='two'){
    if(Math.abs(first.y-last.y)<150)return{err:'위아래 방향으로 길게 그려주세요'};
    const dir=first.y>last.y?'up':'down';
    const vis=pts.filter(p=>inView(p));const wrong=vis.filter(p=>dir==='up'?p.x<492:p.x>508).length;
    return{dir,invade:wrong/Math.max(1,vis.length)>.15,y0:first.y};
  }
  if(m.kind==='round'){
    const r=len(sub(first,V(CX,CY)));
    if(len(sub(first,last))<120)return{err:'조금 더 길게 그려주세요'};
    return{role:r<235&&r>85?'ring':'enter'};
  }
  if(len(sub(first,last))<120)return{err:'조금 더 길게 그려주세요'};
  return{role:Math.abs(first.y-500)>75?'exit':'aisle'};
}
/* ---- 도로 안 + 차선 자석 + 회전반경 제한 ---- */
const MARGIN=20,MAGNET=.6,MIN_R=100;
function nearestOf(v,arr){let b=arr[0];for(const a of arr)if(Math.abs(v-a)<Math.abs(v-b))b=a;return b;}
function projectRoad(m,p){
  const C=V(CX,CY);
  if(m.kind==='road'){const x0=m.lanes[0]-42+MARGIN,x1=m.lanes[m.lanes.length-1]+42-MARGIN;return V(clamp(p.x,x0,x1),p.y);}
  if(m.kind==='two')return V(clamp(p.x,418+MARGIN,582-MARGIN),p.y);
  if(m.kind==='park')return V(p.x,clamp(p.y,262,738));
  if(m.kind==='round'){
    const hw=70-MARGIN,rIn=106+MARGIN,rOut=220-MARGIN,d=sub(p,C),r=len(d);
    const inStrip=Math.abs(d.x)<=hw||Math.abs(d.y)<=hw;
    if(r<rIn){return add(C,mul(norm(r>1?d:V(1,0)),rIn));}
    if(r<=rOut||inStrip)return p;
    const cands=[add(C,mul(norm(d),rOut))];
    if(Math.abs(d.y)>rIn)cands.push(V(CX+clamp(d.x,-hw,hw),p.y));
    if(Math.abs(d.x)>rIn)cands.push(V(p.x,CY+clamp(d.y,-hw,hw)));
    let b=cands[0];for(const q of cands)if(len(sub(q,p))<len(sub(b,p)))b=q;return b;
  }
  const hv=m.hwV-MARGIN*.9,hh=m.hwH-MARGIN*.9,dx=p.x-CX,dy=p.y-CY;
  const inV=Math.abs(dx)<=hv&&(!m.tee||dy>=-hh),inH=Math.abs(dy)<=hh;
  if(inV||inH)return p;
  const c1=V(CX+clamp(dx,-hv,hv),m.tee?Math.max(p.y,CY-hh):p.y),c2=V(p.x,CY+clamp(dy,-hh,hh));
  return len(sub(c1,p))<len(sub(c2,p))?c1:c2;
}
function magnet(m,p){
  const C=V(CX,CY),dx=p.x-CX,dy=p.y-CY;
  if(m.kind==='road')return V(lerp(p.x,nearestOf(p.x,m.lanes),MAGNET),p.y);
  if(m.kind==='two')return V(lerp(p.x,nearestOf(p.x,[460,540]),MAGNET),p.y);
  if(m.kind==='park'){
    if(Math.abs(dy)<80)return V(p.x,lerp(p.y,nearestOf(p.y,[480,520]),MAGNET));
    if(Math.abs(dy)>110){const sx=Math.round(p.x/72)*72;return V(lerp(p.x,sx,MAGNET),p.y);}
    return p;
  }
  if(m.kind==='round'){
    const r=len(sub(p,C));
    if(r<235&&r>100)return add(C,mul(norm(sub(p,C)),lerp(r,158,MAGNET)));
    if(Math.abs(dx)<=70&&Math.abs(dy)>235)return V(lerp(p.x,nearestOf(p.x,[CX-35,CX+35]),MAGNET),p.y);
    if(Math.abs(dy)<=70&&Math.abs(dx)>235)return V(p.x,lerp(p.y,nearestOf(p.y,[CY-35,CY+35]),MAGNET));
    return p;
  }
  const inBox=Math.abs(dx)<=m.hwV&&Math.abs(dy)<=m.hwH;if(inBox)return p;
  if(Math.abs(dy)>m.hwH&&Math.abs(dx)<=m.hwV)return V(lerp(p.x,nearestOf(p.x,m.lanesV.flatMap(o=>[CX-o,CX+o])),MAGNET),p.y);
  if(Math.abs(dx)>m.hwV&&Math.abs(dy)<=m.hwH)return V(p.x,lerp(p.y,nearestOf(p.y,m.lanesH.flatMap(o=>[CY-o,CY+o])),MAGNET));
  return p;
}
function detourIsland(a){
  const C=V(CX,CY),R0=150,ang=p=>Math.atan2(p.y-CY,p.x-CX)/D2R,out=[];let i=0;
  while(i<a.length){
    if(len(sub(a[i],C))>=R0){out.push(a[i]);i++;continue;}
    let j=i;while(j<a.length&&len(sub(a[j],C))<R0)j++;
    const pa=out.length?out[out.length-1]:a[i],pb=j<a.length?a[j]:a[a.length-1];
    const a0=ang(pa),a1=ang(pb);let d=((a0-a1)%360+360)%360;if(d<15)d+=360;
    const n=Math.max(2,Math.ceil(d/4));for(let k=0;k<=n;k++){const t=(a0-d*k/n)*D2R;out.push(V(CX+158*Math.cos(t),CY+158*Math.sin(t)));}
    i=j;}
  return out;
}
function constrainPts(mk,pts){
  const m=MAPS[mk];let a=resample(pts,6);
  if(m.kind==='round')a=detourIsland(a);
  a=a.map(p=>magnet(m,projectRoad(m,p)));
  a=smoothPts(a,3,3);
  const maxAng=6/MIN_R;
  for(let it=0;it<60;it++){let moved=false;const b=a.slice();
    for(let i=1;i<a.length-1;i++){const u=sub(a[i],a[i-1]),w=sub(a[i+1],a[i]);
      let ang=Math.atan2(u.x*w.y-u.y*w.x,u.x*w.x+u.y*w.y);
      if(Math.abs(ang)>maxAng){const mid=V((a[i-1].x+a[i+1].x)/2,(a[i-1].y+a[i+1].y)/2);b[i]=V(lerp(a[i].x,mid.x,.5),lerp(a[i].y,mid.y,.5));moved=true;}}
    a=b.map(p=>projectRoad(m,p));if(it%6===5)a=resample(a,6);if(!moved)break;}
  return a;
}
function snapPath(mk,info,pts){
  const m=MAPS[mk];
  if(m.kind==='cross')return crossPath(m,info.arm,info.man,info.li,info.lo);
  if(m.kind==='road'){const p=roadPath(m,info.lane,info.to,info.zone);return p;}
  if(m.kind==='two'&&!info.invade)return twoPath(info.dir,false);
  return null;
}

/* ========== 룰 엔진 ========== */
const MODS={
  speed:{label:'과속 (20km/h 이상 초과)',d:10},
  speed2:{label:'중대한 과속 (40km/h 이상 초과)',d:20},
  careless:{label:'휴대폰, 전방주시 태만',d:10},
  drunk:{label:'음주 또는 무면허',d:20},
  first:{label:'명확한 선진입',d:-10},
  noBlink:{label:'깜빡이 안 켬',d:20},
  suddenStop:{label:'이유 없는 급정지',d:30}
};
const USER_MODS=['careless','drunk','first','noBlink','suddenStop'];
function sanitizeMods(m){const o={A:[],B:[]};if(m&&typeof m==='object')for(const c of['A','B'])if(Array.isArray(m[c]))o[c]=[...new Set(m[c].filter(k=>USER_MODS.includes(k)))].slice(0,5);return o;}
function relation(a,b){const da=ARMS[a.arm],db=ARMS[b.arm];if(eqv(da,db))return'same';if(eqv(da,neg(db)))return'opposite';return eqv(db,rightOf(neg(da)))?'right':'left';}
const pair=(car,x)=>car==='A'?[x,100-x]:[100-x,x];
const other=k=>k==='A'?'B':'A';

function normalize(sp){
  const m=MAPS[sp.map];if(!m)return{err:'알 수 없는 도로예요'};
  const N={map:sp.map,m,mods:sanitizeMods(sp.mods),cars:{}};
  for(const k of['A','B']){
    const c=sp[k]||{};let info,path;
    if(Array.isArray(c.pts)){const pts=c.pts.map(p=>V(+p[0],+p[1]));info=classify(sp.map,pts);if(info.err)return{err:info.err};
      let use=pts;if(info.flip)use=pts.slice().reverse();path=makePath(extendFor(sp.map,use,info));}
    else{info=Object.assign({},c);path=templatePath(m,c);}
    info.light=m.lights?(m.lights.includes(c.light)?c.light:m.lights[0]):null;
    info.speed=clamp(Math.round(+c.speed||m.limit),5,150);
    if(info.man==='uturn')info.ut=UT[c.ut]?c.ut:(m.lights&&!m.flash?'signal':'always');
    N.cars[k]={id:k,info,path};
  }
  const I=k=>N.cars[k].info;
  if(sp.rear==='A'||sp.rear==='B')N.rear=sp.rear;
  else if(m.kind==='road')N.rear=I('A').y0>=I('B').y0?'A':'B';
  else if(m.kind==='two')N.rear=(I('A').dir==='up')===(I('A').y0>=I('B').y0)?'A':'B';
  return N;
}
function roadKind(N){
  const A=N.cars.A.info,B=N.cars.B.info;
  if(N.m.kind==='two'){
    if(A.dir===B.dir)return(!A.invade&&!B.invade)?'rear':'unsup';
    return A.invade&&B.invade?'bothInvade':A.invade?'invadeA':B.invade?'invadeB':'none';
  }
  const ca=A.lane!==A.to,cb=B.lane!==B.to;
  if(!ca&&!cb)return A.lane===B.lane?'rear':'none';
  if(ca&&cb){if(A.to===B.to)return'merge';if(A.lane===B.to&&B.lane===A.to)return'swap';return'unsup';}
  const ch=ca?'A':'B',st=other(ch);return N.cars[st].info.lane===N.cars[ch].info.to?'lane':'none';
}
function violates(c){if(c.man==='uturn'){if(c.ut!=='signal')return false;return c.light!=='L';}if(c.light==='G')return false;if(c.light==='L')return c.man==='straight';if(c.light==='R')return c.man!=='right';return false;}
function judgeBase(N){
  const m=N.m,A=N.cars.A.info,B=N.cars.B.info;
  if(m.kind==='road'||m.kind==='two'){
    const k=roadKind(N);
    if(k==='rear'){const r=N.rear;return{kind:'rear',base:pair(r,100),title:'후방 추돌',reason:`뒤따르던 ${r} 차가 안전거리를 지키지 않은 책임이에요. 앞차가 정상적으로 멈췄다면 뒤차 100%가 기본이에요.`};}
    if(k==='lane'){const ch=A.lane!==A.to?'A':'B';return{base:pair(ch,70),title:'진로변경 vs 후행 직진',reason:`차로를 바꾼 ${ch} 차가 뒤에서 오는 차를 살필 의무가 커요. 직진차도 전방 주시 의무가 있어 0은 아니에요.`};}
    if(k==='swap')return{base:[50,50],title:'동시 진로변경',reason:'두 차가 같은 순간 서로의 차로로 들어가면 책임이 같아요.'};
    if(k==='merge')return{base:[50,50],title:'같은 차로로 동시 진로변경',reason:'양옆 차로에서 같은 차로로 동시에 들어오면 서로 확인 의무가 같아서 반반이에요.'};
    if(k==='invadeA'||k==='invadeB'){const v=k==='invadeA'?'A':'B';return{base:pair(v,100),title:'중앙선 침범',reason:`${v} 차가 중앙선을 넘어 반대 차로로 들어갔어요. 중앙선 침범은 12대 중과실이라 원칙적으로 침범한 차 책임이에요.`};}
    if(k==='bothInvade')return{base:[50,50],title:'쌍방 중앙선 침범',reason:'두 차 모두 중앙선을 넘었으니 책임이 같아요.'};
    if(k==='none')return{none:true};
    return{unsup:true};
  }
  if(m.kind==='round'){
    if(A.role!==B.role){const en=A.role==='enter'?'A':'B';return{base:pair(en,80),title:'회전교차로 진입 vs 회전 중',reason:`회전교차로에서는 이미 돌고 있는 차가 우선이에요. 진입하는 ${en} 차는 양보하고 들어가야 해요.`};}
    return{unsup:true,msg:A.role==='enter'?'두 차가 동시에 진입한 경우는 아직 기준표에 넣지 않았어요.':'두 차 모두 회전 중인 사고는 아직 기준표에 넣지 않았어요.'};
  }
  if(m.kind==='park'){
    if(A.role!==B.role){const ex=A.role==='exit'?'A':'B';return{base:pair(ex,70),title:'주차칸 출차 vs 통로 주행',reason:`주차칸에서 나오는 ${ex} 차가 통로를 지나는 차를 살펴야 해요. 다만 주차장은 모두 서행 의무가 있어 통로 차도 책임이 있어요.`};}
    return{unsup:true};
  }
  const rel=relation(A,B),perp=rel==='left'||rel==='right';
  if(rel==='same')return{unsup:true,msg:'같은 길에서 들어오는 두 차의 사고는 아직 기준표에 넣지 않았어요.'};
  const ut=A.man==='uturn'?'A':B.man==='uturn'?'B':null;
  if(ut&&N.cars[ut].info.ut==='illegal')return{base:pair(ut,90),title:'유턴 금지 구역에서 유턴',reason:`유턴이 허용되지 않은 곳에서 유턴한 ${ut} 차의 지시위반이에요. 보통 80에서 100 사이로 정해지는데 여기서는 90으로 잡았어요. 유턴 금지 위반으로 중앙선을 넘었다면 형사처벌 대상이 될 수도 있어요.`};
  if(m.lights&&!m.flash){
    const go=c=>c.light!=='R';
    if(perp&&go(A)&&go(B)){
      const y=A.light==='Y'&&B.light==='G'?'A':B.light==='Y'&&A.light==='G'?'B':null;
      if(y)return{base:pair(y,80),title:'황색 신호 진입 vs 녹색 신호 진입',reason:`노란불에 들어간 ${y} 차가 교차로를 빠져나가지 못한 사이, 신호가 바뀐 옆길 차가 녹색에 출발해 부딪힌 사고예요. 꼬리물기 차 책임이 크지만, 녹색 차도 교차로에 남은 차를 살폈어야 해서 80:20이 기본이에요.`};
      return{invalid:true,msg:'교차하는 두 방향이 동시에 진행 신호일 수는 없어요. 한 쪽을 적색으로 바꾸거나, 꼬리물기 상황이면 한 쪽을 황색, 다른 쪽을 녹색으로 해주세요.'};
    }
    const va=violates(A),vb=violates(B);
    const vtxt=(c,o)=>`${c} 차가 ${LIGHT[o.light]}에 ${MAN[o.man]}했어요.${o.man==='uturn'?' 신호 유턴은 좌회전 신호에만 할 수 있어요.':''} 신호위반 차가 사고 책임을 모두 져요.`;
    if(va&&!vb)return{base:[100,0],title:'신호위반 사고',reason:vtxt('A',A)};
    if(vb&&!va)return{base:[0,100],title:'신호위반 사고',reason:vtxt('B',B)};
    if(va&&vb)return{base:[50,50],title:'쌍방 신호위반',reason:'두 차 모두 신호를 어겼으니 책임이 같아요.'};
    if(ut){const U=N.cars[ut].info,O=N.cars[other(ut)].info;
      if(O.man==='right'&&exitArm(O.arm,O.man)===U.arm){
        if(U.ut==='signal')return{base:pair(ut,20),title:'신호 유턴 vs 우회전',reason:`신호에 따라 유턴한 ${ut} 차가 우선이에요. 우회전 차는 신호 받고 유턴하는 차를 살피고 양보했어야 해서 우회전 차 책임이 80이에요.`};
        return{base:pair(ut,70),title:'상시 유턴 vs 우회전',reason:`상시 유턴 구역에서는 유턴 차가 다른 차의 통행을 방해하지 않을 때만 유턴할 수 있어요. 그래서 유턴한 ${ut} 차 책임이 70이에요. 같은 사고라도 신호 유턴이면 비율이 뒤집혀요.`};}
      return{unsup:true,msg:'이 유턴 사고 유형은 아직 기준표에 넣지 않았어요.'};}
    if(A.light==='Y'||B.light==='Y')return{unsup:true,msg:'이 황색 신호 사고는 정지선 앞에서 멈출 수 있었는지에 따라 판단이 크게 갈려요. 참고로 2024년 대법원 판결 이후로는 노란불 진입 자체를 신호위반으로 보는 경향이 강해졌어요.'};
    if(rel==='opposite'){
      const lt=A.man==='left'&&B.man==='straight'?'A':B.man==='left'&&A.man==='straight'?'B':null;
      if(lt&&N.cars[lt].info.light==='G')return{base:pair(lt,80),title:'비보호 좌회전 vs 대향 직진',reason:`녹색 신호에서 비보호 좌회전하는 ${lt} 차는 마주 오는 직진차에 양보해야 해요. 직진차도 교차로 주의 의무가 있어 20이에요.`};
    }
    return{unsup:true};
  }
  if(ut){const U=N.cars[ut].info,O=N.cars[other(ut)].info;
    if(O.man==='right'&&exitArm(O.arm,O.man)===U.arm)return{base:pair(ut,70),title:'상시 유턴 vs 우회전',reason:`신호가 없는 곳의 유턴은 다른 차 통행을 방해하지 않을 때만 할 수 있어요. 유턴한 ${ut} 차 책임이 70이에요.`};
    return{unsup:true,msg:'이 유턴 사고 유형은 아직 기준표에 넣지 않았어요.'};}
  if(m.flash&&A.light!==B.light){
    const r=A.light==='RF'?'A':'B',y=other(r),R=N.cars[r].info,Y=N.cars[y].info;
    const base='적색 점멸은 교차로 앞 일시정지, 황색 점멸은 주의하며 서행하라는 신호예요.';
    if(R.man==='straight'&&Y.man==='straight')return{base:pair(r,70),title:'적색 점멸 직진 vs 황색 점멸 직진',reason:`${base} 멈췄다 가야 하는 ${r} 차 책임이 70이에요.`};
    if(R.man==='left'&&Y.man==='straight')return{base:pair(r,80),title:'적색 점멸 좌회전 vs 황색 점멸 직진',reason:`${base} 일시정지 의무에 좌회전까지 한 ${r} 차 책임이 80이에요.`};
    if(R.man==='straight'&&Y.man==='left')return{base:pair(r,60),title:'적색 점멸 직진 vs 황색 점멸 좌회전',reason:`${base} 다만 황색 점멸 쪽이 좌회전 중이라 직진보다 주의 의무가 커서 60:40이에요.`};
  }
  if(rel==='opposite'){
    const lt=A.man==='left'&&B.man==='straight'?'A':B.man==='left'&&A.man==='straight'?'B':null;
    if(lt)return{base:pair(lt,80),title:'좌회전 vs 대향 직진',reason:`좌회전하는 ${lt} 차는 마주 오는 직진차에 진로를 양보해야 해요.`};
    return{unsup:true};
  }
  if(m.tee){
    const side=A.arm==='S'?'A':B.arm==='S'?'B':null;
    if(side&&N.cars[other(side)].info.man==='straight')return{base:pair(side,70),title:'삼거리 측면 진입 vs 직진',reason:`삼거리에서는 곧게 이어진 길을 달리는 차가 우선이에요. 옆길에서 나온 ${side} 차가 더 조심했어야 해요.`};
    return{unsup:true};
  }
  if(perp&&A.man==='straight'&&B.man==='straight'){
    if(m.mainH){
      const am=A.arm==='E'||A.arm==='W',bm=B.arm==='E'||B.arm==='W';
      if(am!==bm)return{base:am?[30,70]:[70,30],title:'대로 vs 소로 직진',reason:`넓은 도로(대로)를 달리는 차가 우선이에요. 좁은 도로에서 나온 ${am?'B':'A'} 차 책임이 커요.`};
    }else{
      const bR=rel==='right';
      return{base:bR?[60,40]:[40,60],title:'같은 폭 교차로 직진 vs 직진',reason:`도로 폭이 같으면 오른쪽 도로에서 오는 차가 우선이에요. 여기서는 ${bR?'B':'A'} 차가 오른쪽 차예요.`};
    }
  }
  return{unsup:true};
}
function autoMods(N,k){const over=N.cars[k].info.speed-N.m.limit;return over>=40?['speed2']:over>=20?['speed']:[];}
function judge(N){
  const b=judgeBase(N);if(!b.base)return b;
  let a=b.base[0];const lines=[];
  for(const car of['A','B'])for(const k of[...autoMods(N,car),...N.mods[car]]){const d=MODS[k].d;a+=car==='A'?d:-d;lines.push({car,label:MODS[k].label,d});}
  a=clamp(Math.round(a/10)*10,0,100);
  return Object.assign({},b,{final:[a,100-a],lines});
}
function modsFor(N,car){
  const m=N.m,list=['careless','drunk'];
  if(m.first)list.push('first');
  if(m.kind==='road'||m.kind==='two'){const k=roadKind(N),c=N.cars[car].info;
    if((k==='lane'||k==='swap'||k==='merge')&&c.lane!==c.to)list.push('noBlink');
    if(k==='rear'&&N.rear===other(car))list.push('suddenStop');}
  return list;
}
function carText(m,c){
  if(m.kind==='cross')return`${ARMNAME[c.arm]} 길${lanesOf(m,neg(ARMS[c.arm])).length>1&&c.li?' '+c.li+'차로':''}에서 ${c.man==='uturn'?UT[c.ut]||'유턴':MAN[c.man]}`;
  if(m.kind==='road')return c.lane===c.to?`${c.lane}차로 직진`:`${c.lane}차로에서 ${c.to}차로로 변경`;
  if(m.kind==='two')return`${c.dir==='up'?'위로':'아래로'} 주행${c.invade?', 중앙선 넘음':''}`;
  if(m.kind==='round')return c.role==='ring'?'회전 중':'회전교차로 진입';
  return c.role==='exit'?'주차칸에서 출차':'통로 주행';
}
function describe(N){
  const m=N.m,A=N.cars.A.info,B=N.cars.B.info;
  return`${m.name}: A ${carText(m,A)} vs B ${carText(m,B)}`.slice(0,40);
}

/* ========== 장면 ========== */
function findConflict(pa,pb,victim){
  const ia=[],ib=[];
  for(let i=0;i<pa.pts.length;i+=2)if(inView(pa.pts[i],140))ia.push(i);
  for(let j=0;j<pb.pts.length;j+=2)if(inView(pb.pts[j],140))ib.push(j);
  let dmin=1e9;const ds=[];
  for(const i of ia)for(const j of ib){const d=len(sub(pa.pts[i],pb.pts[j]));if(d<dmin)dmin=d;if(d<60)ds.push([d,i,j]);}
  if(dmin>=48)return null;
  let best=null;for(const [d,i,j] of ds){if(d>dmin+3)continue;const sv=victim==='A'?pa.s[i]:pb.s[j];if(!best||sv<best.sv)best={sv,sa:pa.s[i],sb:pb.s[j],d};}
  return best;
}
function blinkOf(path){
  const [a,b]=viewRange(path,0);if(b-a<60)return 0;
  const a0=pathAng(path,a+30),a1=pathAng(path,b-30);let d=a1-a0;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  if(Math.abs(d)>35*D2R)return Math.sign(d);
  const p0=pathAt(path,a+30),p1=pathAt(path,b-30),h=V(Math.cos(a0),Math.sin(a0)),dd=sub(p1,p0),lat=h.x*dd.y-h.y*dd.x;
  return Math.abs(lat)>40?Math.sign(lat):0;
}
function buildScene(sp){
  const N=normalize(sp);if(N.err)return{err:N.err};
  const res=judge(N),m=N.m;
  const cars={A:{id:'A',color:'#2f6bff'},B:{id:'B',color:'#ff4a4f'}};
  for(const k of['A','B']){const c=cars[k];c.path=N.cars[k].path;c.v=N.cars[k].info.speed*KMH;
    c.blink=N.mods[k].includes('noBlink')?0:N.cars[k].info.man==='uturn'?-1:blinkOf(c.path);}
  let T=3,impact=false;
  const needT=(c,sStar)=>(sStar-viewRange(c.path,40)[0]+40)/c.v;
  if(res.invalid){}
  else if(res.kind==='rear'){
    impact=true;const R=N.rear,F=other(R),cf=cars[F],cr=cars[R];
    const [va,vb]=viewRange(cf.path,0),sF=lerp(va,vb,.62),pF=pathAt(cf.path,sF);
    const sudden=N.mods[F].includes('suddenStop');
    const sR=nearestS(cr.path,pF)-CAR_L*.97;
    T=clamp(needT(cr,sR),2.4,5.5);
    const t1=sudden?T-.3:Math.max(.9,T-1.4),t0=t1-(sudden?.55:1.2);
    cf.motion={type:'stop',sStar:sF,v:cf.v,t0,t1};
    cr.motion={type:'const',sStar:sR,v:cr.v,tRef:T};
  }else{
    const victim=res.final?(res.final[0]>res.final[1]?'A':'B'):'B';
    const X=res.none?null:findConflict(cars.A.path,cars.B.path,victim);
    if(X){
      impact=true;const striker=other(victim);
      const sv=victim==='A'?X.sa:X.sb,ss=striker==='A'?X.sa:X.sb;
      const ca=Math.cos(pathAng(cars.A.path,X.sa)-pathAng(cars.B.path,X.sb));
      const off=lerp(CAR_L/2+CAR_W/2,CAR_L*.97,Math.abs(ca)**2);
      const sStar={[victim]:sv,[striker]:ss-off};
      T=clamp(Math.max(needT(cars.A,sStar.A),needT(cars.B,sStar.B)),2.2,5.5);
      for(const k of['A','B'])cars[k].motion={type:'const',sStar:sStar[k],v:cars[k].v,tRef:T};
    }else{
      T=4.4;for(const k of['A','B']){const c=cars[k],[a,b]=viewRange(c.path,0);c.motion={type:'const',sStar:lerp(a,b,.5),v:c.v,tRef:k==='A'?1.8:2.8};}
      T=Math.max(T,...['A','B'].map(k=>{const c=cars[k],[,b]=viewRange(c.path,60);return c.motion.tRef+(b-c.motion.sStar)/c.v;}));T=Math.min(T,7);
    }
  }
  const sc={sp,N,map:sp.map,res,cars,T,impact};
  if(!res.invalid){const pa=poseAt(cars.A,T),pb=poseAt(cars.B,T);sc.focus=impact?V((pa.x+pb.x)/2,(pa.y+pb.y)/2):V(CX,CY);}
  return sc;
}
function motionS(mo,t){
  if(mo.type==='const')return mo.sStar+mo.v*(t-mo.tRef);
  const D=mo.t1-mo.t0,br=mo.v*D/2;
  if(t<mo.t0)return mo.sStar-br-mo.v*(mo.t0-t);
  if(t<mo.t1){const u=t-mo.t0;return mo.sStar-br+mo.v*u-mo.v*u*u/(2*D);}
  return mo.sStar;
}
function motionV(mo,t){if(mo.type==='const')return mo.v;if(t<mo.t0)return mo.v;if(t<mo.t1)return mo.v*(1-(t-mo.t0)/(mo.t1-mo.t0));return 0;}
function poseAt(car,t){const s=motionS(car.motion,t),p=pathAt(car.path,s);return{x:p.x,y:p.y,a:pathAng(car.path,s),s};}

/* ========== 렌더러 ========== */
const cv=document.getElementById('cv'),ctx=cv.getContext('2d'),stage=document.getElementById('stage');
let size=400,dpr=1;
function resize(){const w=stage.clientWidth;size=Math.max(260,w);dpr=Math.min(3,window.devicePixelRatio||1);
  cv.style.height=size+'px';cv.width=Math.round(size*dpr);cv.height=Math.round(size*dpr);}
new ResizeObserver(resize).observe(stage);resize();

/* ========== 사고 소리 (Web Audio로 직접 합성, 음원 파일 없음) ========== */
const Sound=(()=>{
  let ctx=null,master=null,nbuf=null,on=true;
  try{on=localStorage.getItem('wf_sound')!=='off';}catch(_){}
  function ensure(){
    if(!on)return null;
    if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
      ctx=new AC();master=ctx.createGain();master.gain.value=.8;
      const comp=ctx.createDynamicsCompressor();comp.threshold.value=-14;comp.ratio.value=6;
      master.connect(comp);comp.connect(ctx.destination);
      nbuf=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate);const d=nbuf.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;}
    if(ctx.state==='suspended')ctx.resume().catch(()=>{});
    return ctx.state==='running'?ctx:null;
  }
  const noise=()=>{const b=ctx.createBufferSource();b.buffer=nbuf;b.loop=true;return b;};
  let curve=null;
  const dist=()=>{if(curve)return curve;curve=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/1023*2-1;curve[i]=Math.tanh(x*3.5);}return curve;};
  // 타이어 끌리는 소리: 좁은 대역 잡음 + 떨림, 점점 낮아짐
  function screech(dur,power){
    if(!ensure())return;const t=ctx.currentTime;
    const src=noise(),bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=22;
    bp.frequency.setValueAtTime(2100,t);bp.frequency.linearRampToValueAtTime(1350,t+dur);
    const lfo=ctx.createOscillator(),lg=ctx.createGain();lfo.frequency.value=13;lg.gain.value=140;lfo.connect(lg);lg.connect(bp.frequency);
    const g=ctx.createGain(),v=.55*power;
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(v,t+.05);g.gain.setValueAtTime(v,t+dur*.75);g.gain.linearRampToValueAtTime(0,t+dur);
    src.connect(bp);bp.connect(g);g.connect(master);
    src.start(t,Math.random());src.stop(t+dur+.05);lfo.start(t);lfo.stop(t+dur+.05);
  }
  // 충돌: 낮은 쿵 + 찌그러지는 금속 + 금속 울림 + 유리 파편
  function crash(power){
    if(!ensure())return;const t=ctx.currentTime,p=clamp(power,.3,1);
    const o=ctx.createOscillator(),og=ctx.createGain();o.type='sine';
    o.frequency.setValueAtTime(150,t);o.frequency.exponentialRampToValueAtTime(38,t+.4);
    og.gain.setValueAtTime(1.1*p,t);og.gain.exponentialRampToValueAtTime(.001,t+.55);o.connect(og);og.connect(master);o.start(t);o.stop(t+.6);
    const n=noise(),lp=ctx.createBiquadFilter(),ws=ctx.createWaveShaper(),ng=ctx.createGain();
    lp.type='lowpass';lp.frequency.setValueAtTime(3200,t);lp.frequency.exponentialRampToValueAtTime(260,t+.45);ws.curve=dist();
    ng.gain.setValueAtTime(.9*p,t);ng.gain.exponentialRampToValueAtTime(.001,t+.5);
    n.connect(lp);lp.connect(ws);ws.connect(ng);ng.connect(master);n.start(t,Math.random());n.stop(t+.55);
    [467,733,1129,1597].forEach((f,i)=>{const m=ctx.createOscillator(),mg=ctx.createGain(),st=t+.008+i*.011;m.type='triangle';m.frequency.value=f*(.92+Math.random()*.16);
      mg.gain.setValueAtTime(0,t);mg.gain.linearRampToValueAtTime(.11*p,st);mg.gain.exponentialRampToValueAtTime(.001,st+.5+Math.random()*.4);
      m.connect(mg);mg.connect(master);m.start(t);m.stop(st+1);});
    const pieces=Math.round(8+16*p);
    for(let i=0;i<pieces;i++){const st=t+.04+Math.random()*.7*Math.sqrt(Math.random()),b=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();
      b.buffer=nbuf;f.type='bandpass';f.frequency.value=3500+Math.random()*5500;f.Q.value=9;
      g.gain.setValueAtTime(0,st);g.gain.linearRampToValueAtTime(.3*p*(.3+Math.random()*.7),st+.003);g.gain.exponentialRampToValueAtTime(.001,st+.04+Math.random()*.14);
      b.connect(f);f.connect(g);g.connect(master);b.start(st,Math.random());b.stop(st+.22);}
  }
  function setOn(v){on=v;try{localStorage.setItem('wf_sound',v?'on':'off');}catch(_){}if(!v&&ctx)ctx.suspend().catch(()=>{});else ensure();}
  // 브라우저는 사용자가 한 번 누르기 전에는 소리를 막는다
  const unlock=()=>{ensure();};
  window.addEventListener('pointerdown',unlock,{passive:true});window.addEventListener('keydown',unlock);
  return{screech,crash,setOn,get on(){return on;}};
})();

const A={sc:null,state:'idle',tau:0,real:0,post:0,poses:{},phys:null,parts:[],skids:{A:[],B:[]},shake:0,
  cam:{x:CX,y:CY,z:1},onDone:null,preview:null,clock:0,blankMap:'sig'};
function play(sc,onDone){
  A.sc=sc;A.state='run';A.tau=0;A.sfx={screech:false,brake:false};A.real=0;A.post=0;A.parts=[];A.skids={A:[],B:[]};A.shake=0;A.phys=null;A.onDone=onDone||null;A.preview=null;
  for(const k of['A','B'])A.poses[k]=poseAt(sc.cars[k],0);
  replayBtn.classList.remove('show');
}
function startImpact(){
  const sc=A.sc,T=sc.T,ph={};
  for(const k of['A','B']){const c=sc.cars[k],p=poseAt(c,T),v=motionV(c.motion,T);
    ph[k]={x:p.x,y:p.y,a:p.a,vx:Math.cos(p.a)*v,vy:Math.sin(p.a)*v,w:0};}
  const n=norm(sub(V(ph.B.x,ph.B.y),V(ph.A.x,ph.A.y)));
  let rel=(ph.A.vx-ph.B.vx)*n.x+(ph.A.vy-ph.B.vy)*n.y;rel=Math.max(rel,50);
  const j=(1.3*rel)/2,cp=V((ph.A.x+ph.B.x)/2,(ph.A.y+ph.B.y)/2);
  const imp={A:mul(n,-j),B:mul(n,j)};
  for(const k of['A','B']){const P=ph[k];P.vx+=imp[k].x;P.vy+=imp[k].y;
    const r=sub(cp,V(P.x,P.y));P.w=clamp((r.x*imp[k].y-r.y*imp[k].x)/(CAR_L*CAR_L*.55),-3.4,3.4);}
  A.phys=ph;A.state='post';A.real=0;A.post=0;A.shake=clamp(rel/260,.45,1.4);
  const power=clamp(rel/300,.4,1.6);
  Sound.crash(clamp(rel/420,.3,1));
  for(let i=0;i<Math.round(46*power);i++){const an=Math.random()*Math.PI*2,sp=(180+Math.random()*560)*Math.sqrt(power);
    A.parts.push({t:'spark',x:cp.x,y:cp.y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,life:.35+Math.random()*.6,max:1});}
  for(let i=0;i<Math.round(16*power);i++){const an=Math.random()*Math.PI*2,sp=(60+Math.random()*240)*power;
    A.parts.push({t:'debris',x:cp.x,y:cp.y,vx:Math.cos(an)*sp,vy:Math.sin(an)*sp,r:Math.random()*6,w:(Math.random()-.5)*14,life:9,max:9,s:2+Math.random()*4,c:Math.random()<.5?'#cfd5dd':'#8a929c'});}
  A.parts.push({t:'ring',x:cp.x,y:cp.y,r:6,life:.55,max:.55});
  A.parts.push({t:'smoke',x:cp.x,y:cp.y,r:20,life:1.6,max:1.6});
}
function update(dt){
  A.clock+=dt;
  const sc=A.sc;
  if(A.state==='run'&&sc){
    let scale=1;if(sc.impact){const rem=sc.T-A.tau;if(rem<.4)scale=lerp(.42,1,rem/.4);}
    A.tau+=dt*scale;
    if(sc.impact&&!A.sfx.screech&&sc.T-A.tau<.5){A.sfx.screech=true;
      const vmax=Math.max(...['A','B'].map(k=>motionV(sc.cars[k].motion,A.tau)))/KMH;
      if(vmax>=20)Sound.screech(.9,clamp(vmax/80,.35,1));}
    for(const k of['A','B']){const mo=sc.cars[k].motion;
      if(mo.type==='stop'&&!A.sfx.brake&&A.tau>=mo.t0&&mo.t1-mo.t0<.8){A.sfx.brake=true;Sound.screech(mo.t1-mo.t0+.15,clamp(mo.v/KMH/80,.35,.9));}}
    if(A.tau>=sc.T){A.tau=sc.T;
      if(sc.impact){for(const k of['A','B'])A.poses[k]=poseAt(sc.cars[k],sc.T);startImpact();}
      else{A.state='done';finish();}}
    if(A.state==='run')for(const k of['A','B'])A.poses[k]=poseAt(sc.cars[k],A.tau);
  }
  let sdt=dt;
  if(A.state==='post'||A.state==='done'){
    A.real+=dt;const r=A.real;
    const scale=r<.5?.2:r<1.15?lerp(.2,1,sstep((r-.5)/.65)):1;sdt=dt*scale;
    if(A.phys){A.post+=sdt;
      for(const k of['A','B']){const P=A.phys[k];P.x+=P.vx*sdt;P.y+=P.vy*sdt;P.a+=P.w*sdt;
        const f=Math.exp(-2.4*sdt);P.vx*=f;P.vy*=f;P.w*=Math.exp(-2.8*sdt);
        A.poses[k]={x:P.x,y:P.y,a:P.a};
        const sk=A.skids[k];const lp=sk[sk.length-1];
        if(Math.hypot(P.vx,P.vy)>25&&(!lp||Math.hypot(lp.x-P.x,lp.y-P.y)>4))sk.push({x:P.x,y:P.y,a:P.a});}
      if(A.state==='post'&&A.post>1.5){A.state='done';finish();}
    }
  }
  A.shake*=Math.exp(-5*dt);
  for(const p of A.parts){p.life-=sdt;
    if(p.t==='spark'){p.x+=p.vx*sdt;p.y+=p.vy*sdt;const f=Math.exp(-3.2*sdt);p.vx*=f;p.vy*=f;}
    else if(p.t==='debris'){p.x+=p.vx*sdt;p.y+=p.vy*sdt;const f=Math.exp(-4.5*sdt);p.vx*=f;p.vy*=f;p.r+=p.w*sdt;p.w*=f;}
    else if(p.t==='ring'){p.r+=420*sdt;}
    else if(p.t==='smoke'){p.r+=40*sdt;}}
  A.parts=A.parts.filter(p=>p.life>0);
  let tx=CX,ty=CY,tz=1;
  if(sc&&A.state!=='idle'&&sc.impact&&!A.preview){
    const f=A.state==='run'?smooth(sc.T-2.2,sc.T,A.tau):1;
    tz=1+.34*f+(A.state!=='run'?.05*sstep(A.real/1.5):0);
    tx=lerp(CX,sc.focus.x,.75*f);ty=lerp(CY,sc.focus.y,.75*f);
  }
  const k=1-Math.exp(-dt*(A.preview?20:5));
  A.cam.x+=(tx-A.cam.x)*k;A.cam.y+=(ty-A.cam.y)*k;A.cam.z+=(tz-A.cam.z)*k;
}
function finish(){replayBtn.classList.add('show');const cb=A.onDone;A.onDone=null;if(cb)cb();}

function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function dashLine(x1,y1,x2,y2,d,g){ctx.setLineDash([d,g]);ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();ctx.setLineDash([]);}
const ASPH='#50565f',SIDE='#cdc7bb',YEL='#f2c230',WHT='#f2f2f2';
function grass(){ctx.fillStyle='#dbe5cf';ctx.fillRect(-1200,-1200,3400,3400);
  ctx.fillStyle='rgba(120,150,100,.07)';for(let i=0;i<60;i++){const x=(i*137)%1000,y=(i*251)%1000;ctx.beginPath();ctx.arc(x,y,30+(i%5)*8,0,7);ctx.fill();}}
function arrowMark(x,y,ang=-Math.PI/2){ctx.save();ctx.translate(x,y);ctx.rotate(ang+Math.PI/2);ctx.fillStyle='rgba(255,255,255,.75)';ctx.beginPath();ctx.moveTo(0,-26);ctx.lineTo(12,-8);ctx.lineTo(4,-8);ctx.lineTo(4,20);ctx.lineTo(-4,20);ctx.lineTo(-4,-8);ctx.lineTo(-12,-8);ctx.closePath();ctx.fill();ctx.restore();}
function label(t,x,y){ctx.fillStyle='rgba(255,255,255,.6)';ctx.font='700 19px Noto Sans KR';ctx.textAlign='center';ctx.fillText(t,x,y);}

function drawMap(mk,N){
  const m=MAPS[mk];grass();
  if(m.kind==='road'){
    const L=m.lanes,x0=L[0]-42,x1=L[L.length-1]+42;
    ctx.fillStyle=SIDE;ctx.fillRect(x0-16,-1200,x1-x0+32,3400);ctx.fillStyle=ASPH;ctx.fillRect(x0,-1200,x1-x0,3400);
    ctx.strokeStyle=YEL;ctx.lineWidth=3;for(const x of[x0+5,x0+11]){ctx.beginPath();ctx.moveTo(x,-1200);ctx.lineTo(x,2200);ctx.stroke();}
    ctx.strokeStyle=WHT;ctx.beginPath();ctx.moveTo(x1-5,-1200);ctx.lineTo(x1-5,2200);ctx.stroke();
    ctx.lineWidth=3.5;for(let i=0;i<L.length-1;i++)dashLine((L[i]+L[i+1])/2,-1200,(L[i]+L[i+1])/2,2200,40,32);
    L.forEach((x,i)=>{label(`${i+1}차로`,x,975);arrowMark(x,900);arrowMark(x,120);});
    return;
  }
  if(m.kind==='two'){
    ctx.fillStyle=SIDE;ctx.fillRect(402,-1200,196,3400);ctx.fillStyle=ASPH;ctx.fillRect(418,-1200,164,3400);
    ctx.strokeStyle=YEL;ctx.lineWidth=3;for(const x of[496.5,503.5]){ctx.beginPath();ctx.moveTo(x,-1200);ctx.lineTo(x,2200);ctx.stroke();}
    ctx.strokeStyle=WHT;for(const x of[423,577]){ctx.beginPath();ctx.moveTo(x,-1200);ctx.lineTo(x,2200);ctx.stroke();}
    arrowMark(540,880);arrowMark(540,140);arrowMark(460,120,Math.PI/2);arrowMark(460,860,Math.PI/2);
    label('중앙선',500,975);return;
  }
  if(m.kind==='park'){
    ctx.fillStyle='#8f949b';ctx.fillRect(-1200,-1200,3400,3400);
    ctx.fillStyle='#5d636b';ctx.fillRect(-1200,240,3400,520);
    ctx.fillStyle='#545a62';ctx.fillRect(-1200,420,3400,160);
    ctx.strokeStyle='rgba(255,255,255,.85)';ctx.lineWidth=3;
    for(let x=-36;x<=1100;x+=72){ctx.beginPath();ctx.moveTo(x,270);ctx.lineTo(x,420);ctx.moveTo(x,580);ctx.lineTo(x,730);ctx.stroke();}
    ctx.beginPath();ctx.moveTo(-100,270);ctx.lineTo(1100,270);ctx.moveTo(-100,730);ctx.lineTo(1100,730);ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.4)';dashLine(-100,500,1100,500,30,24);
    arrowMark(200,520,0);arrowMark(820,480,Math.PI);
    const decor=[[36,345,1,'#e9ecef'],[180,345,1,'#2d3238'],[468,345,1,'#c0c6cc'],[756,345,1,'#8e2b2b'],[900,345,1,'#e9ecef'],[108,655,-1,'#c0c6cc'],[324,655,-1,'#e9ecef'],[468,655,-1,'#2d3238'],[828,655,-1,'#3b5b7a']];
    for(const [x,y,s,c] of decor)drawCar({color:c,decor:true},{x,y,a:s*Math.PI/2},{});
    label('P',60,215);return;
  }
  if(m.kind==='round'){
    const C=V(CX,CY);
    ctx.fillStyle=SIDE;ctx.fillRect(CX-86,-1200,172,3400);ctx.fillRect(-1200,CY-86,3400,172);
    ctx.beginPath();ctx.arc(CX,CY,236,0,7);ctx.fill();
    ctx.fillStyle=ASPH;ctx.fillRect(CX-70,-1200,140,3400);ctx.fillRect(-1200,CY-70,3400,140);
    ctx.beginPath();ctx.arc(CX,CY,220,0,7);ctx.fill();
    ctx.fillStyle='#d9d3c6';ctx.beginPath();ctx.arc(CX,CY,106,0,7);ctx.fill();
    ctx.fillStyle='#b9d39f';ctx.beginPath();ctx.arc(CX,CY,92,0,7);ctx.fill();
    ctx.fillStyle='#9cc27c';for(const [dx,dy,r] of [[-25,-15,26],[22,10,30],[-5,32,18]]){ctx.beginPath();ctx.arc(CX+dx,CY+dy,r,0,7);ctx.fill();}
    ctx.strokeStyle=YEL;ctx.lineWidth=3;
    for(const a of['N','S','E','W']){const d=ARMS[a];for(const o of[-3.5,3.5]){const r=rightOf(d);const p0=add(add(C,mul(d,236)),mul(r,o)),p1=add(add(C,mul(d,1300)),mul(r,o));ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();}}
    ctx.strokeStyle=WHT;ctx.lineWidth=4;
    for(const a of['N','S','E','W']){const d=ARMS[a],h=neg(d),r=rightOf(h);const p0=add(add(C,mul(r,4)),mul(d,232)),p1=add(add(C,mul(r,68)),mul(d,232));dashLine(p0.x,p0.y,p1.x,p1.y,8,7);}
    ctx.fillStyle='rgba(255,255,255,.7)';
    for(const deg of[45,135,225,315]){const a=deg*D2R,p=V(CX+160*Math.cos(a),CY+160*Math.sin(a));arrowMark(p.x,p.y,a-Math.PI/2);}
    return;
  }
  const {hwV,hwH}=m,sw=16,tee=!!m.tee;
  const vTop=tee?CY-hwH:-1200;
  ctx.fillStyle=SIDE;ctx.fillRect(CX-hwV-sw,tee?CY-hwH-sw:-1200,(hwV+sw)*2,3400);ctx.fillRect(-1200,CY-hwH-sw,3400,(hwH+sw)*2);
  ctx.fillStyle=ASPH;ctx.fillRect(CX-hwV,vTop,hwV*2,3400);ctx.fillRect(-1200,CY-hwH,3400,hwH*2);
  const cw=m.lights&&!m.flash?40:0,gap=10;
  ctx.strokeStyle=YEL;ctx.lineWidth=3;
  const yTop=CY-hwH-cw-gap-14,yBot=CY+hwH+cw+gap+14,xL=CX-hwV-cw-gap-14,xR=CX+hwV+cw+gap+14;
  const uz=m.lights&&!m.flash?UZONE:0,C0=V(CX,CY);
  for(const a of tee?['S','E','W']:['N','S','E','W']){const d=ARMS[a],r=rightOf(d),s0=(vertV(d)?hwH:hwV)+cw+gap+14;
    ctx.strokeStyle=YEL;ctx.lineWidth=3;
    for(const o of[-3.5,3.5]){const p0=add(add(C0,mul(d,s0+uz)),mul(r,o)),p1=add(add(C0,mul(d,1800)),mul(r,o));ctx.beginPath();ctx.moveTo(p0.x,p0.y);ctx.lineTo(p1.x,p1.y);ctx.stroke();}
    if(uz){const p0=add(C0,mul(d,s0)),p1=add(C0,mul(d,s0+uz));ctx.strokeStyle=WHT;ctx.lineWidth=3.5;dashLine(p0.x,p0.y,p1.x,p1.y,14,12);}}
  if(tee){ctx.strokeStyle=YEL;ctx.lineWidth=3;dashLine(xL,CY,xR,CY,14,10);}
  ctx.strokeStyle=WHT;ctx.lineWidth=3;
  for(let i=0;i<m.lanesH.length-1;i++){const o=(m.lanesH[i]+m.lanesH[i+1])/2;for(const y of[CY-o,CY+o]){dashLine(-1200,y,xL,y,34,26);dashLine(xR,y,2200,y,34,26);}}
  for(let i=0;i<m.lanesV.length-1;i++){const o=(m.lanesV[i]+m.lanesV[i+1])/2;for(const x of[CX-o,CX+o]){if(!tee)dashLine(x,-1200,x,yTop,34,26);dashLine(x,yBot,x,2200,34,26);}}
  if(m.lights&&!m.flash)for(const a of tee?['S','E','W']:['N','S','E','W']){const d=ARMS[a],h=neg(d),r=rightOf(h),L=lanesOf(m,h),al=vertV(h)?m.hwH:m.hwV;
    const p=add(add(V(CX,CY),mul(r,L[0])),mul(d,al+cw+gap+UZONE+50));uMark(p.x,p.y,Math.atan2(h.y,h.x));}
  if(cw){ctx.fillStyle='rgba(245,245,245,.9)';
    for(let x=CX-hwV+6;x<CX+hwV-6;x+=18){if(!tee)ctx.fillRect(x,CY-hwH-gap-cw,10,cw);ctx.fillRect(x,CY+hwH+gap,10,cw);}
    for(let y=CY-hwH+6;y<CY+hwH-6;y+=18){ctx.fillRect(CX-hwV-gap-cw,y,cw,10);ctx.fillRect(CX+hwV+gap,y,cw,10);}}
  ctx.fillStyle=WHT;const so=cw+gap+10;
  ctx.fillRect(CX,CY+hwH+so,hwV,5);if(!tee)ctx.fillRect(CX-hwV,CY-hwH-so-5,hwV,5);
  ctx.fillRect(CX-hwV-so-5,CY,5,hwH);ctx.fillRect(CX+hwV+so,CY-hwH,5,hwH);
  if(m.mainH){label('대로',170,CY-hwH-30);label('소로',CX+hwV+60,160);}
  if(m.lights&&N)for(const k of['A','B']){const c=N.cars[k].info;if(c.arm)m.flash?drawFlash(m,c.arm,c.light):drawSignal(m,c.arm,c.light);}
}
function sigPos(m,arm,dist=70){const d=ARMS[arm],h=neg(d),r=rightOf(h),vert=Math.abs(h.x)<.5;
  const hwR=vert?m.hwV:m.hwH,hwC=vert?m.hwH:m.hwV;return add(add(V(CX,CY),mul(r,hwR+34)),mul(h,-(hwC+dist)));}
function uMark(x,y,ang){ctx.save();ctx.translate(x,y);ctx.rotate(ang);ctx.strokeStyle='rgba(255,255,255,.78)';ctx.lineWidth=4;ctx.lineCap='round';
  ctx.beginPath();ctx.moveTo(-22,4);ctx.lineTo(8,4);ctx.arc(8,-6,10,Math.PI/2,-Math.PI/2,true);ctx.lineTo(-6,-16);ctx.stroke();
  ctx.fillStyle='rgba(255,255,255,.78)';ctx.beginPath();ctx.moveTo(-14,-16);ctx.lineTo(-4,-23);ctx.lineTo(-4,-9);ctx.closePath();ctx.fill();ctx.restore();}
function drawSignal(m,arm,light){
  const p=sigPos(m,arm),w=74,hh=22,x=p.x-w/2,y=p.y-hh/2;
  ctx.fillStyle='rgba(0,0,0,.25)';rr(x+2,y+3,w,hh,6);ctx.fill();
  ctx.fillStyle='#1f2227';rr(x,y,w,hh,6);ctx.fill();
  const lit=[light==='R'||light==='L',light==='Y',light==='L',light==='G'];
  const cols=['#ff4b4b','#ffc23d','#33d17a','#33d17a'];
  for(let i=0;i<4;i++){const cx=x+11+i*17.3,cy=p.y;
    ctx.fillStyle=lit[i]?cols[i]:'#3a3e45';if(lit[i]){ctx.shadowColor=cols[i];ctx.shadowBlur=12;}
    ctx.beginPath();ctx.arc(cx,cy,6.4,0,7);ctx.fill();ctx.shadowBlur=0;
    if(i===2){ctx.strokeStyle=lit[i]?'#0b3d22':'#555a62';ctx.lineWidth=1.8;ctx.beginPath();ctx.moveTo(cx+3.5,cy);ctx.lineTo(cx-3.5,cy);ctx.moveTo(cx-1,cy-2.6);ctx.lineTo(cx-3.8,cy);ctx.lineTo(cx-1,cy+2.6);ctx.stroke();}}
}
function drawFlash(m,arm,light){
  const p=sigPos(m,arm,46),on=Math.floor(A.clock*1.6)%2===0,col=light==='RF'?'#ff4b4b':'#ffc23d';
  ctx.fillStyle='rgba(0,0,0,.25)';rr(p.x-13,p.y-11,30,26,7);ctx.fill();
  ctx.fillStyle='#1f2227';rr(p.x-15,p.y-13,30,26,7);ctx.fill();
  ctx.fillStyle=on?col:'#3a3e45';if(on){ctx.shadowColor=col;ctx.shadowBlur=16;}ctx.beginPath();ctx.arc(p.x,p.y,8,0,7);ctx.fill();ctx.shadowBlur=0;
}
function shade(hex,k){const n=parseInt(hex.slice(1),16);let r=n>>16,g=n>>8&255,b=n&255;
  const f=v=>clamp(Math.round(k<0?v*(1+k):v+(255-v)*k),0,255);return`rgb(${f(r)},${f(g)},${f(b)})`;}
function drawCar(car,pose,o){
  const L=CAR_L,W=CAR_W;
  ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.a);
  ctx.fillStyle='rgba(0,0,0,.24)';rr(-L/2+2,-W/2+4,L,W,11);ctx.fill();
  const g=ctx.createLinearGradient(0,-W/2,0,W/2);g.addColorStop(0,shade(car.color,.25));g.addColorStop(.5,car.color);g.addColorStop(1,shade(car.color,-.25));
  ctx.fillStyle=g;rr(-L/2,-W/2,L,W,11);ctx.fill();
  ctx.fillStyle=shade(car.color,-.12);rr(-L*.22,-W/2+5,L*.42,W-10,7);ctx.fill();
  ctx.fillStyle='rgba(22,30,42,.82)';
  ctx.beginPath();ctx.moveTo(L*.2,-W/2+5);ctx.lineTo(L*.32,-W/2+7);ctx.lineTo(L*.32,W/2-7);ctx.lineTo(L*.2,W/2-5);ctx.closePath();ctx.fill();
  ctx.beginPath();ctx.moveTo(-L*.22,-W/2+5);ctx.lineTo(-L*.32,-W/2+8);ctx.lineTo(-L*.32,W/2-8);ctx.lineTo(-L*.22,W/2-5);ctx.closePath();ctx.fill();
  if(!car.decor){
    ctx.fillStyle='rgba(255,255,255,.22)';rr(-L*.18,-W/2+7,L*.34,4,2);ctx.fill();
    ctx.fillStyle='#fff8d6';rr(L/2-6,-W/2+4,4,8,2);ctx.fill();rr(L/2-6,W/2-12,4,8,2);ctx.fill();
    const br=o.brake;ctx.fillStyle=br?'#ff2b2b':'#8a1d1d';if(br){ctx.shadowColor='#ff2020';ctx.shadowBlur=16;}
    rr(-L/2+1,-W/2+4,4,8,2);ctx.fill();rr(-L/2+1,W/2-12,4,8,2);ctx.fill();ctx.shadowBlur=0;
    const on=Math.floor(A.clock*2.6)%2===0;
    const sides=o.hazard?[-1,1]:o.blink?[o.blink]:[];
    if(on)for(const s of sides){ctx.fillStyle='#ffb000';ctx.shadowColor='#ffb000';ctx.shadowBlur=14;
      const yy=s<0?-W/2-1:W/2-3;ctx.fillRect(L/2-10,yy,7,4);ctx.fillRect(-L/2+3,yy,7,4);ctx.shadowBlur=0;}
  }
  ctx.restore();
}
function worldToScreen(p){const s=size/1000*A.cam.z;return V((p.x-A.cam.x)*s+size/2,(p.y-A.cam.y)*s+size/2);}
function labelPos(pose){const p=worldToScreen(pose);let y=p.y-30*Math.max(1,A.cam.z*.85);if(y<16)y=p.y+30*Math.max(1,A.cam.z*.85);return V(p.x,y);}
function drawLabels(defs){
  const ps=defs.map(d=>labelPos(d.pose));
  if(defs.length===2){const c0=worldToScreen(defs[0].pose),c1=worldToScreen(defs[1].pose);
    const k=Math.max(1,A.cam.z*.8),f=1-smooth(70*k,130*k,Math.hypot(c1.x-c0.x,c1.y-c0.y));
    if(f>0){let sgn=c1.x-c0.x;if(Math.abs(sgn)<8)sgn=1;const off=34*k,sg=Math.sign(sgn);
      const s0=V(c0.x-sg*off,c0.y),s1=V(c1.x+sg*off,c1.y);
      ps[0]=V(lerp(ps[0].x,s0.x,f),lerp(ps[0].y,s0.y,f));ps[1]=V(lerp(ps[1].x,s1.x,f),lerp(ps[1].y,s1.y,f));}}
  defs.forEach((d,i)=>drawLabel(d.car,ps[i],d.speed));
}
function drawLabel(car,p,speed){
  if(p.x<-30||p.x>size+30||p.y<-40||p.y>size+40)return;
  const y=p.y;
  ctx.fillStyle='rgba(0,0,0,.18)';ctx.beginPath();ctx.arc(p.x,y+1.5,12,0,7);ctx.fill();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(p.x,y,12,0,7);ctx.fill();
  ctx.fillStyle=car.color;ctx.font='900 14px Noto Sans KR';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(car.id,p.x,y+.5);
  if(speed!=null){ctx.font='700 10px Noto Sans KR';const t=Math.round(speed)+'km/h',w=ctx.measureText(t).width+10;
    ctx.fillStyle='rgba(20,22,26,.72)';rr(p.x+14,y-8,w,16,8);ctx.fill();ctx.fillStyle='#fff';ctx.textAlign='left';ctx.fillText(t,p.x+19,y+.5);}
  ctx.textBaseline='alphabetic';
}
function render(){
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
  const s=size/1000*A.cam.z,amp=A.shake*11;
  const sx=amp?(Math.sin(A.clock*61)+Math.sin(A.clock*37))*amp*.5:0,sy=amp?(Math.cos(A.clock*53)+Math.sin(A.clock*29))*amp*.5:0;
  ctx.setTransform(dpr*s,0,0,dpr*s,dpr*(size/2-A.cam.x*s+sx),dpr*(size/2-A.cam.y*s+sy));
  if(A.preview){drawPreview();return;}
  const sc=A.sc;if(!sc||sc.err||!sc.cars){drawMap(A.blankMap,null);return;}
  drawMap(sc.map,sc.N);
  ctx.strokeStyle='rgba(25,25,28,.32)';ctx.lineWidth=5;ctx.lineCap='round';
  for(const k of['A','B']){const sk=A.skids[k];if(sk.length<2)continue;
    for(const side of[-1,1]){ctx.beginPath();sk.forEach((q,i)=>{const nx=-Math.sin(q.a)*side*CAR_W*.33,ny=Math.cos(q.a)*side*CAR_W*.33,x=q.x-Math.cos(q.a)*CAR_L*.3+nx,y=q.y-Math.sin(q.a)*CAR_L*.3+ny;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();}}
  for(const p of A.parts)if(p.t==='debris'){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.r);ctx.fillStyle=p.c;ctx.fillRect(-p.s/2,-p.s/2,p.s,p.s*.6);ctx.restore();}
  const post=A.state==='post'||A.state==='done';
  for(const k of['A','B']){const c=sc.cars[k],pose=A.poses[k];if(!pose)continue;
    let brake=false;if(!post&&c.motion.type==='stop')brake=A.tau>=c.motion.t0;
    if(!post&&sc.impact&&sc.T-A.tau<.18)brake=true;
    drawCar(c,pose,{brake:brake||(post&&A.phys&&Math.hypot(A.phys[k].vx,A.phys[k].vy)>5),blink:post?0:c.blink,hazard:post&&A.real>1.2});}
  for(const p of A.parts){const a=clamp(p.life/p.max,0,1);
    if(p.t==='spark'){ctx.strokeStyle=`rgba(255,${180+Math.floor(70*a)},80,${a})`;ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.03,p.y-p.vy*.03);ctx.stroke();}
    else if(p.t==='ring'){ctx.strokeStyle=`rgba(255,255,255,${a*.9})`;ctx.lineWidth=6*a+1;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.stroke();
      ctx.fillStyle=`rgba(255,240,200,${a*a*.6})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r*.45,0,7);ctx.fill();}
    else if(p.t==='smoke'){ctx.fillStyle=`rgba(200,200,205,${a*.35})`;ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,7);ctx.fill();}}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const showSpd=A.state==='run';
  drawLabels(['A','B'].filter(k=>A.poses[k]).map(k=>({car:sc.cars[k],pose:A.poses[k],speed:showSpd?motionV(sc.cars[k].motion,A.tau)/KMH:null})));
}

/* ========== 그리기 미리보기 ========== */
function drawPreview(){
  const pv=A.preview;drawMap(pv.map,pv.N);
  ctx.lineCap='round';ctx.lineJoin='round';const cp={};
  for(const k of['A','B']){const col=k==='A'?'#2f6bff':'#ff4a4f';
    const st=pv.strokes[k];if(st&&st.length>1){ctx.strokeStyle=col+'44';ctx.lineWidth=16;ctx.beginPath();st.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
    const path=pv.paths[k];if(!path)continue;
    const [s0,s1]=viewRange(path,-10);
    ctx.strokeStyle=col;ctx.lineWidth=5;ctx.setLineDash([16,12]);ctx.lineDashOffset=-A.clock*40;ctx.beginPath();
    for(let s=s0+60;s<=s1-30;s+=6){const p=pathAt(path,s);s===s0+60?ctx.moveTo(p.x,p.y):ctx.lineTo(p.x,p.y);}ctx.stroke();ctx.setLineDash([]);
    const tip=pathAt(path,s1-30),ta=pathAng(path,s1-34);
    ctx.fillStyle=col;ctx.save();ctx.translate(tip.x,tip.y);ctx.rotate(ta);ctx.beginPath();ctx.moveTo(14,0);ctx.lineTo(-10,-12);ctx.lineTo(-10,12);ctx.closePath();ctx.fill();ctx.restore();
    const p=pathAt(path,s0+40);cp[k]={x:p.x,y:p.y,a:pathAng(path,s0+40)};
    drawCar({color:col,id:k},cp[k],{blink:pv.blinks[k]||0});}
  ctx.setTransform(dpr,0,0,dpr,0,0);
  drawLabels(['A','B'].filter(k=>cp[k]).map(k=>({car:{id:k,color:k==='A'?'#2f6bff':'#ff4a4f'},pose:cp[k],speed:pv.speeds[k]})));
}

let last=performance.now();
function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;update(dt);render();requestAnimationFrame(frame);}
requestAnimationFrame(frame);

/* ========== 공통 UI ========== */
const $=id=>document.getElementById(id);
const hint=$('hint'),replayBtn=$('replay');
let mode='quiz',replayFn=null;
replayBtn.onclick=()=>{if(replayFn)replayFn();};
const soundBtn=$('soundBtn');
const paintSound=()=>{soundBtn.textContent=Sound.on?'소리 켜짐':'소리 꺼짐';soundBtn.classList.toggle('off',!Sound.on);};
soundBtn.onclick=()=>{Sound.setOn(!Sound.on);paintSound();};paintSound();
function setHint(t){hint.textContent=t||'';}
function ratioBar(a,b){return`<div class="bar"><div class="ba" style="flex-grow:${Math.max(a,0.0001)}">${a?'A '+a:''}</div><div class="bb" style="flex-grow:${Math.max(b,0.0001)}">${b?'B '+b:''}</div></div>`;}
function explainHTML(res){
  let h=`<div class="reason"><b>${res.title}</b><br>${res.reason}</div><ul class="lines"><li><span>기본과실</span><b>A ${res.base[0]} : B ${res.base[1]}</b></li>`;
  for(const l of res.lines)h+=`<li><span>${l.car} 차 ${l.label}</span><b>${l.car} ${l.d>0?'+':''}${l.d}</b></li>`;
  return h+`<li><span>최종</span><b>A ${res.final[0]} : B ${res.final[1]}</b></li></ul>`;
}
function setRange(el,v){el.value=v;el.style.setProperty('--p',v+'%');}
function chipsFor(N){
  const out=[{t:N.m.name+` (제한 ${N.m.limit}km/h)`}];
  for(const k of['A','B']){const c=N.cars[k].info;out.push({t:`${k} ${carText(N.m,c)}${c.light?' ('+LIGHT[c.light]+')':''}`,c:k.toLowerCase()});
    if(c.speed!==N.m.limit)out.push({t:`${k} ${c.speed}km/h`,c:k.toLowerCase()});}
  for(const k of['A','B'])for(const md of N.mods[k])out.push({t:`${k} ${MODS[md].label}`,c:k.toLowerCase()});
  return out;
}
function renderChips(el,N){el.innerHTML='';for(const c of chipsFor(N)){const s=document.createElement('span');s.className='chip'+(c.c?' '+c.c:'');s.textContent=c.t;el.appendChild(s);}}

document.querySelectorAll('#tabs button').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));
function setMode(m){
  mode=m;document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.mode===m));
  for(const k of['quiz','draw','vote','admin'])$('p-'+k).classList.toggle('hidden',k!==m);
  stopPolling();stage.classList.toggle('drawing',false);setHint('');
  stage.classList.toggle('hidden',m==='admin');
  if(m==='quiz')quizShow();
  if(m==='draw')drawEnter();
  if(m==='vote')voteEnter();
  if(m==='admin')adminEnter();
}

/* ========== 맞히기 ========== */
const Q=[
{id:'q01',t:'빨간불에 달려든 차',s:'A는 녹색 신호를 받고 직진했어요. 옆길의 B는 빨간불인데 그대로 교차로에 들어왔어요.',sp:{map:'sig',A:{arm:'S',man:'straight',light:'G'},B:{arm:'W',man:'straight',light:'R'}}},
{id:'q02',t:'녹색불 비보호 좌회전',s:'녹색 신호에서 A는 직진, 마주 오던 B는 좌회전 화살표 없이 비보호로 좌회전했어요.',sp:{map:'sig',A:{arm:'S',man:'straight',light:'G'},B:{arm:'N',man:'left',light:'G'}}},
{id:'q03',t:'비보호 좌회전, 그런데 직진차가 과속',s:'앞 상황과 같은데 직진하던 A가 제한속도 50km/h 도로를 75km/h로 달리고 있었어요.',sp:{map:'sig',A:{arm:'S',man:'straight',light:'G',speed:75},B:{arm:'N',man:'left',light:'G',speed:30}}},
{id:'q04',t:'좌회전 신호에 직진한 맞은편 차',s:'A는 좌회전 신호를 받고 좌회전했어요. 맞은편 B는 같은 좌회전 신호인데 그냥 직진해버렸어요.',sp:{map:'sig',A:{arm:'S',man:'left',light:'L',speed:35},B:{arm:'N',man:'straight',light:'L'}}},
{id:'q05',t:'신호위반 차, 그런데 나는 95km/h',s:'B가 빨간불에 들어왔지만, 녹색불에 직진한 A는 제한 50km/h 도로를 95km/h로 달리고 있었어요.',sp:{map:'sig',A:{arm:'E',man:'straight',light:'G',speed:95},B:{arm:'S',man:'straight',light:'R'}}},
{id:'q06',t:'노란불 꼬리물기',s:'A가 노란불에 교차로로 들어갔다가 앞이 막혀 빠져나가지 못했어요. 그 사이 옆길 B가 녹색불을 받고 출발해 부딪혔어요.',sp:{map:'sig',A:{arm:'S',man:'straight',light:'Y',speed:30},B:{arm:'W',man:'straight',light:'G',speed:30}}},
{id:'q07',t:'신호 받고 유턴 vs 우회전',s:'왕복 4차로 사거리에서 A는 좌회전 신호에 맞춰 유턴했어요. 왼쪽 길의 B는 빨간불에 우회전하다 유턴하던 A와 부딪혔어요.',sp:{map:'sig4',A:{arm:'S',man:'uturn',light:'L',ut:'signal',speed:20},B:{arm:'W',man:'right',light:'R',speed:25}}},
{id:'q08',t:'상시 유턴 vs 우회전',s:'같은 장면인데 여기는 신호와 상관없이 유턴할 수 있는 상시 유턴 구역이었어요.',sp:{map:'sig4',A:{arm:'S',man:'uturn',light:'G',ut:'always',speed:20},B:{arm:'W',man:'right',light:'R',speed:25}}},
{id:'q09',t:'4차로 사거리 비보호 좌회전',s:'왕복 4차로 사거리 녹색 신호에서 A는 2차로로 직진, 맞은편 B는 1차로에서 비보호 좌회전했어요.',sp:{map:'sig4',A:{arm:'S',man:'straight',light:'G',li:2,lo:2},B:{arm:'N',man:'left',light:'G',speed:30}}},
{id:'q10',t:'유턴 금지인데 유턴',s:'유턴 금지 표지가 있는 곳에서 B가 유턴하다 직진하던 A와 부딪혔어요.',sp:{map:'nosig_eq',A:{arm:'N',man:'straight'},B:{arm:'S',man:'uturn',ut:'illegal',speed:15}}},
{id:'q11',t:'점멸 신호 좌회전',s:'점멸 신호 교차로에서 적색 점멸 쪽 A가 좌회전하다 황색 점멸 쪽에서 직진하던 B와 부딪혔어요.',sp:{map:'flash',A:{arm:'S',man:'left',light:'RF',speed:25},B:{arm:'E',man:'straight',light:'YF',speed:40}}},
{id:'q12',t:'신호 없는 교차로의 눈치싸움',s:'신호등 없는 같은 폭 교차로에서 A는 아래쪽, B는 오른쪽 길에서 동시에 직진했어요.',sp:{map:'nosig_eq',A:{arm:'S',man:'straight',speed:40},B:{arm:'E',man:'straight',speed:40}}},
{id:'q13',t:'내가 먼저 들어갔는데요',s:'같은 상황인데 A가 누가 봐도 확실하게 먼저 교차로에 들어가 있었어요.',sp:{map:'nosig_eq',A:{arm:'S',man:'straight',speed:40},B:{arm:'E',man:'straight',speed:40},mods:{A:['first']}}},
{id:'q14',t:'큰길 vs 골목길',s:'A는 왕복 4차로 대로를 직진, B는 좁은 소로에서 나와 대로를 가로질렀어요. 신호등은 없어요.',sp:{map:'nosig_main',A:{arm:'W',man:'straight'},B:{arm:'S',man:'straight',speed:30}}},
{id:'q15',t:'신호 없는 곳의 좌회전',s:'신호 없는 교차로에서 A는 직진, 맞은편 B는 좌회전하다 부딪혔어요.',sp:{map:'nosig_eq',A:{arm:'S',man:'straight',speed:45},B:{arm:'N',man:'left',speed:25}}},
{id:'q16',t:'깜빡이는 신호등',s:'밤이라 신호등이 점멸 중이에요. A 쪽은 황색 점멸, B 쪽은 적색 점멸이었는데 둘 다 멈추지 않고 직진했어요.',sp:{map:'flash',A:{arm:'S',man:'straight',light:'YF',speed:40},B:{arm:'E',man:'straight',light:'RF',speed:40}}},
{id:'q17',t:'삼거리에서 튀어나온 차',s:'삼거리에서 A는 큰길을 직진, B는 아래쪽 옆길에서 좌회전해 큰길로 나왔어요.',sp:{map:'tee',A:{arm:'W',man:'straight'},B:{arm:'S',man:'left',speed:25}}},
{id:'q18',t:'회전교차로 진입',s:'A는 이미 회전교차로를 돌고 있었고, B는 아래쪽 길에서 회전교차로로 진입했어요.',sp:{map:'round',A:{role:'ring',from:'N',to:'E',speed:30},B:{role:'enter',from:'S',to:'W',speed:30}}},
{id:'q19',t:'주차장 출차 사고',s:'A는 주차장 통로를 지나가고 있었고, B는 주차칸에서 앞으로 빠져나오다 부딪혔어요.',sp:{map:'park',A:{role:'aisle',speed:15},B:{role:'exit',speed:8}}},
{id:'q20',t:'추월하다 정면충돌',s:'왕복 2차로에서 B가 앞차를 추월하려고 중앙선을 넘었다가 마주 오던 A와 부딪혔어요.',sp:{map:'two',A:{dir:'down'},B:{dir:'up',invade:true,zone:760,speed:70}}},
{id:'q21',t:'끼어들기 사고',s:'2차로를 달리던 A 앞으로 1차로의 B가 깜빡이를 켜고 들어왔어요.',sp:{map:'road2',A:{lane:2,to:2,speed:70},B:{lane:1,to:2,speed:50},rear:'A'}},
{id:'q22',t:'깜빡이 없는 칼치기',s:'같은 끼어들기인데 B가 깜빡이를 켜지 않았어요.',sp:{map:'road2',A:{lane:2,to:2,speed:70},B:{lane:1,to:2,speed:50},rear:'A',mods:{B:['noBlink']}}},
{id:'q23',t:'양쪽에서 가운데로',s:'편도 3차로에서 1차로의 A와 3차로의 B가 동시에 2차로로 들어왔어요.',sp:{map:'road3',A:{lane:1,to:2,speed:70},B:{lane:3,to:2,speed:70}}},
{id:'q24',t:'동시에 차로를 바꿨다',s:'나란히 달리던 A와 B가 같은 순간 서로의 차로로 들어갔어요.',sp:{map:'road2',A:{lane:1,to:2},B:{lane:2,to:1},rear:'A'}},
{id:'q25',t:'정차한 앞차를 꽝',s:'B가 앞에서 서행하다 멈췄는데 뒤따르던 A가 그대로 들이받았어요.',sp:{map:'road2',A:{lane:1,to:1,speed:60},B:{lane:1,to:1,speed:40},rear:'A'}},
{id:'q26',t:'이유 없이 급정거한 앞차',s:'B가 아무 이유 없이 갑자기 급브레이크를 밟았고, 뒤따르던 A가 추돌했어요.',sp:{map:'road2',A:{lane:2,to:2},B:{lane:2,to:2},rear:'A',mods:{B:['suddenStop']}}}
];
const quiz={order:[],i:0,score:0,answered:false,started:false};
const gRange=$('gRange');
gRange.oninput=()=>{const v=+gRange.value;$('gA').textContent=v;$('gB').textContent=100-v;gRange.style.setProperty('--p',v+'%');};
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
// 익명 사용 기록. 서버 연결이 준비된 뒤에 보내고, 실패해도 게임에는 영향 없음
function track(kind,grade){(capsPromise||Promise.resolve()).then(()=>{if(apiOk)api('POST','/api/events',grade?{kind,grade}:{kind}).catch(()=>{});});}
function quizStart(){quiz.order=shuffle(Q.map((_,i)=>i)).slice(0,10);quiz.i=0;quiz.score=0;quiz.started=true;quiz.log=[];$('quizEnd').classList.add('hidden');$('quizCard').classList.remove('hidden');quizRender();}
function quizShow(){if(!quiz.started)quizStart();else if(quiz.i<quiz.order.length)quizPlay();else replayFn=null;}
function quizPlay(){const q=Q[quiz.order[quiz.i]];setHint('A 파란 차, B 빨간 차');play(buildScene(q.sp),()=>setHint(quiz.answered?'':'몇 대 몇일까요?'));replayFn=()=>play(buildScene(q.sp));}
function quizRender(){
  const q=Q[quiz.order[quiz.i]],n=quiz.order.length;quiz.answered=false;
  $('qNum').textContent=`문제 ${quiz.i+1} / ${n}`;$('qScore').textContent=`${quiz.score}점`;$('qProg').style.width=(quiz.i/n*100)+'%';
  $('qTitle').textContent=q.t;$('qStory').textContent=q.s;renderChips($('qChips'),normalize(q.sp));
  setRange(gRange,50);gRange.oninput();gRange.disabled=false;
  $('qSubmit').classList.remove('hidden');$('qReveal').innerHTML='';
  quizPlay();
}
$('qSubmit').onclick=()=>{
  if(quiz.answered)return;quiz.answered=true;
  const q=Q[quiz.order[quiz.i]],res=judge(normalize(q.sp)),g=+gRange.value,diff=Math.abs(g-res.final[0]);
  quiz.log.push({qid:q.id,guess:g,answer:res.final[0]});
  if(quiz.log.length===1)track('quiz_start'); // 페이지만 열고 안 푼 사람은 세지 않게 첫 답에서 센다
  const pts=diff===0?10:diff===10?6:diff===20?3:0;quiz.score+=pts;$('qScore').textContent=`${quiz.score}점`;
  const v=diff===0?['good','정확해요! +10점']:diff<=20?['mid',`아깝다! ${diff}만큼 차이 +${pts}점`]:['bad',`꽤 달라요. ${diff}만큼 차이`];
  gRange.disabled=true;$('qSubmit').classList.add('hidden');
  const lastQ=quiz.i===quiz.order.length-1;
  $('qReveal').innerHTML=`<div class="reveal"><div class="verdict ${v[0]}">${v[1]}</div><div style="font-size:12px;color:var(--sub)">내 답 A ${g} : B ${100-g}</div>${ratioBar(res.final[0],res.final[1])}${explainHTML(res)}<button class="btn" id="qNext">${lastQ?'결과 보기':'다음 문제'}</button></div>`;
  setHint('');
  $('qNext').onclick=()=>{quiz.i++;if(quiz.i>=quiz.order.length)quizEnd();else{quizRender();window.scrollTo({top:0,behavior:'smooth'});}};
};
const SHARE_BASE='https://whose-fault.nobody-asked.dev/';
const GRADES=[
  {slug:'ace',min:.9,badge:'S등급',name:'보험사 에이스 손해사정사',tag:'블랙박스 영상만 봐도 몇 대 몇이 보이는 사람'},
  {slug:'veteran',min:.7,badge:'A등급',name:'베테랑 운전자',tag:'웬만한 사고는 보자마자 판결 끝'},
  {slug:'otaku',min:.5,badge:'B등급',name:'블랙박스 영상 덕후',tag:'감은 좋은데 수정요소에서 갈리는 타입'},
  {slug:'newbie',min:.3,badge:'C등급',name:'초보 운전 스티커',tag:'"내가 왜 30이야?" 하고 억울해할 타입'},
  {slug:'relicense',min:0,badge:'F등급',name:'면허 다시 따야 할 수도',tag:'일단 오늘은 대중교통을 추천해요'}];
const grade=p=>GRADES.find(g=>p>=g.min);
function quizEnd(){
  const n=quiz.order.length,max=n*10,p=quiz.score/max,g=grade(p),pct=Math.round(p*100);
  const url=`${SHARE_BASE}r/${g.slug}.html?s=${pct}`;
  $('quizCard').classList.add('hidden');const e=$('quizEnd');e.classList.remove('hidden');
  e.innerHTML=`<div class="final"><div style="font-size:13px;color:var(--sub);font-weight:700">내 과실 판단력</div><div class="score">${pct}<span style="font-size:22px;color:var(--sub)"> / 100</span></div><div class="gbadge">${g.badge}</div><div class="grade">${g.name}</div><p>${g.tag}</p></div><button class="btn" id="qShare">결과 공유하기</button><div class="row"><a class="btn ghost" id="qPreview" target="_blank" rel="noopener">공유 페이지 보기</a><button class="btn ghost" id="qAgain">다시 도전</button></div><div id="qShareMsg"></div>`;
  $('qPreview').href=url;
  $('qAgain').onclick=quizStart;
  const log=quiz.log.slice();(capsPromise||Promise.resolve()).then(()=>{if(apiOk)api('POST','/api/quiz/results',{score:pct,grade:g.slug,answers:log}).catch(()=>{});});
  $('qShare').onclick=async()=>{
    track('share_click',g.slug);
    const text=`몇 대 몇? 과실비율 퀴즈 ${pct}점, 내 등급은 "${g.name}" (${g.badge})! 당신의 과실 판단력은?`;
    try{if(navigator.share){await navigator.share({title:'몇 대 몇? 과실비율 퀴즈',text,url});return;}}catch(err){if(err&&err.name==='AbortError')return;}
    try{await navigator.clipboard.writeText(text+'\n'+url);$('qShareMsg').innerHTML='<div class="msg">링크를 복사했어요. 카톡에 붙여넣으면 등급 카드가 함께 보여요.</div>';}
    catch(_){const mm=$('qShareMsg');mm.innerHTML='<div class="msg"></div>';mm.firstChild.textContent=text+' '+url;}};
  setHint('');
}

/* ========== 직접 그리기 ========== */
const D={map:'sig',step:'A',strokes:{A:[],B:[]},smooth:{A:null,B:null},info:{A:null,B:null},mods:{A:[],B:[]},light:{A:null,B:null},speed:{A:null,B:null},ut:{A:'signal',B:'signal'},snap:true,drawing:null,lastSpec:null};
const mapSeg=$('mapSeg');
for(const k of Object.keys(MAPS)){const b=document.createElement('button');b.textContent=MAPS[k].name;b.dataset.k=k;b.onclick=()=>{D.map=k;drawReset();};mapSeg.appendChild(b);}
$('snapBtn').onclick=()=>{D.snap=!D.snap;afterEdit();};
function drawEnter(){A.blankMap=D.map;if(!D.speed.A){drawReset();return;}drawRefreshPreview();updateDrawUI();}
function drawReset(){const m=MAPS[D.map];D.step='A';D.strokes={A:[],B:[]};D.smooth={A:null,B:null};D.info={A:null,B:null};D.mods={A:[],B:[]};
  D.light={A:m.lights?m.lights[0]:null,B:m.lights?(m.flash?'RF':'R'):null};D.speed={A:m.limit,B:m.limit};const du=m.lights&&!m.flash?'signal':'always';D.ut={A:du,B:du};D.lastSpec=null;
  $('drawResult').innerHTML='';$('uploadCard').classList.add('hidden');$('upMsg').innerHTML='';drawRefreshPreview();updateDrawUI();}
$('drawReset').onclick=drawReset;
function carPts(k){
  const m=MAPS[D.map],sm=D.smooth[k],info=D.info[k];if(!sm||!info)return null;
  let path=null;if(D.snap&&m.snap)path=snapPath(D.map,info,sm);
  let pts;if(path)pts=resample(clipPts(path),10);else{pts=resample(info.flip?sm.slice().reverse():sm,10);}
  return pts.map(p=>[Math.round(p.x),Math.round(p.y)]);
}
function drawSpec(partial){
  const o={map:D.map,mods:{A:D.mods.A.slice(),B:D.mods.B.slice()}};
  for(const k of['A','B']){const pts=carPts(k);if(!pts){if(partial)continue;return null;}o[k]={pts,speed:D.speed[k]};if(D.light[k])o[k].light=D.light[k];if(D.info[k]&&D.info[k].man==='uturn')o[k].ut=D.ut[k];}
  return o;
}
function drawRefreshPreview(){
  const m=MAPS[D.map],paths={},blinks={},speeds={};
  for(const k of['A','B']){const pts=carPts(k);if(!pts)continue;paths[k]=makePath(extendFor(D.map,pts.map(p=>V(p[0],p[1])),D.info[k]));blinks[k]=D.mods[k].includes('noBlink')?0:blinkOf(paths[k]);speeds[k]=D.speed[k];}
  let N=null;if(m.lights){const sp=drawSpec(true);N={cars:{}};for(const k of['A','B'])N.cars[k]={info:{arm:D.info[k]&&D.info[k].arm,light:D.light[k]}};if(!D.info.A&&!D.info.B)N=null;}
  A.preview={map:D.map,N,strokes:D.strokes,paths,blinks,speeds};A.sc=null;A.state='idle';A.parts=[];A.blankMap=D.map;
  A.cam.x=CX;A.cam.y=CY;A.cam.z=1;replayBtn.classList.remove('show');
  stage.classList.toggle('drawing',D.step!=='ready');
  setHint(D.step==='A'?'파란 차 A의 경로를 그려주세요':D.step==='B'?'이제 빨간 차 B의 경로를 그려주세요':'');
}
const GUIDE={
  cross:'교차로 바깥 한쪽 길에서 시작해 다른 길로 빠져나가도록 그려주세요. 같은 길로 되돌아 나오게 그리면 유턴이에요. 차로가 여러 개면 그린 위치로 차로를 정해요.',
  road:'아래에서 위로 진행하는 도로예요. 원하는 지점에서 옆 차로로 꺾어 그리면 차로변경이 돼요. 출발점이 더 아래인 차가 뒤차예요.',
  two:'오른쪽 차로는 위로, 왼쪽 차로는 아래로 가는 길이에요. 중앙선을 넘게 그리면 중앙선 침범이 돼요.',
  round:'바깥 길에서 시작하면 진입하는 차, 원형 차로 위에서 시작하면 이미 돌고 있는 차가 돼요. 반시계 방향으로 돌아요.',
  park:'주차칸 안에서 시작하면 출차하는 차, 가운데 통로에서 시작하면 통로를 지나는 차가 돼요.'
};
function updateDrawUI(){
  mapSeg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.k===D.map));
  const m=MAPS[D.map],box=$('drawCars');box.innerHTML='';
  $('drawGuide').textContent=GUIDE[m.kind]+` 제한속도 ${m.limit}km/h.`;
  const sb=$('snapBtn');sb.classList.toggle('on',D.snap&&!!m.snap);sb.disabled=!m.snap;
  sb.textContent=m.snap?(D.snap?'차선에 맞추기 켜짐 (누르면 자유 궤적)':'자유 궤적: 도로 안에서 차선 쪽으로 보정돼요'):'자유 궤적: 도로 안에서 차선 쪽으로 보정돼요';
  const sp=drawSpec(false),N=sp?normalize(sp):null;
  for(const k of['A','B']){const inf=D.info[k];if(!inf)continue;
    const div=document.createElement('div');div.className='carbox '+k.toLowerCase();
    const h=document.createElement('h4');h.textContent=`${k} 차 (${k==='A'?'파랑':'빨강'})`;div.appendChild(h);
    const w=document.createElement('div');w.className='what';w.textContent=carText(m,inf);div.appendChild(w);
    if(m.lights){const lb=document.createElement('div');lb.className='label';lb.textContent='신호';div.appendChild(lb);
      const seg=document.createElement('div');seg.className='seg';
      for(const L of m.lights){const b=document.createElement('button');b.textContent=LIGHT[L];b.classList.toggle('on',D.light[k]===L);b.onclick=()=>{D.light[k]=L;afterEdit();};seg.appendChild(b);}div.appendChild(seg);}
    if(inf.man==='uturn'){const lb=document.createElement('div');lb.className='label';lb.textContent='유턴 종류';div.appendChild(lb);
      const seg=document.createElement('div');seg.className='seg';
      for(const u of(m.lights&&!m.flash?['signal','always','illegal']:['always','illegal'])){const b=document.createElement('button');b.textContent=UT[u];b.classList.toggle('on',D.ut[k]===u);b.onclick=()=>{D.ut[k]=u;afterEdit();};seg.appendChild(b);}
      div.appendChild(seg);if(D.ut[k]==='signal'&&m.lights)div.appendChild(Object.assign(document.createElement('div'),{className:'m',textContent:'신호 유턴은 좌회전 신호일 때 하는 유턴이에요.'}));}
    const lb2=document.createElement('div');lb2.className='label';div.appendChild(lb2);
    const rg=document.createElement('input');rg.type='range';rg.min=5;rg.max=150;rg.step=5;rg.value=D.speed[k];rg.className='spd '+k.toLowerCase();
    const setL=()=>{const v=+rg.value,over=v-m.limit;lb2.innerHTML='';lb2.append(document.createTextNode(`속력 ${v}km/h `));
      if(over>=20){const t=document.createElement('span');t.className='warnTag';t.textContent=over>=40?'중대한 과속 +20':'과속 +10';lb2.append(t);}
      rg.style.setProperty('--p',((v-5)/145*100)+'%');};
    rg.oninput=()=>{D.speed[k]=+rg.value;setL();if(A.preview)A.preview.speeds[k]=D.speed[k];};
    rg.onchange=()=>afterEdit();setL();div.appendChild(rg);
    if(N&&!N.err){const lb=document.createElement('div');lb.className='label';lb.textContent='추가 상황';div.appendChild(lb);
      for(const md of modsFor(N,k)){const b=document.createElement('button');b.className='toggle'+(D.mods[k].includes(md)?' on':'');b.textContent=MODS[md].label;
        b.onclick=()=>{const arr=D.mods[k];const i=arr.indexOf(md);i>=0?arr.splice(i,1):arr.push(md);afterEdit();};div.appendChild(b);}}
    box.appendChild(div);}
  $('drawRun').disabled=!sp;
}
function afterEdit(){const sp=drawSpec(false);if(sp){const N=normalize(sp);if(!N.err)for(const k of['A','B']){const al=modsFor(N,k);D.mods[k]=D.mods[k].filter(x=>al.includes(x));}}
  $('drawResult').innerHTML='';$('uploadCard').classList.add('hidden');drawRefreshPreview();updateDrawUI();}
function toWorld(e){const r=cv.getBoundingClientRect(),s=size/1000*A.cam.z;return V((e.clientX-r.left-size/2)/s+A.cam.x,(e.clientY-r.top-size/2)/s+A.cam.y);}
cv.addEventListener('pointerdown',e=>{if(mode!=='draw'||D.step==='ready'||!A.preview)return;e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}D.drawing=D.step;D.strokes[D.step]=[toWorld(e)];});
cv.addEventListener('pointermove',e=>{if(!D.drawing)return;e.preventDefault();const p=toWorld(e),st=D.strokes[D.drawing],l=st[st.length-1];if(len(sub(p,l))>4)st.push(p);});
const endStroke=()=>{if(!D.drawing)return;const k=D.drawing;D.drawing=null;
  const raw=D.strokes[k],sm=raw.length>3?constrainPts(D.map,smoothPts(resample(raw,6))):null,r=sm&&sm.length>3?classify(D.map,sm):{err:'조금 더 길게 그려주세요'};
  if(r.err){D.strokes[k]=[];setHint(r.err);setTimeout(()=>{if(D.step===k&&mode==='draw')setHint(k==='A'?'파란 차 A의 경로를 그려주세요':'이제 빨간 차 B의 경로를 그려주세요');},2400);return;}
  D.smooth[k]=sm;D.info[k]=r;D.step=k==='A'?'B':'ready';afterEdit();};
cv.addEventListener('pointerup',endStroke);cv.addEventListener('pointercancel',endStroke);
$('drawRun').onclick=()=>{
  const sp=drawSpec(false);if(!sp)return;D.lastSpec=sp;const sc=buildScene(sp);
  $('drawResult').innerHTML='';$('uploadCard').classList.add('hidden');stage.classList.remove('drawing');setHint('');
  if(sc.err||sc.res.invalid){$('drawResult').innerHTML=`<div class="msg warn">${sc.err||sc.res.msg}</div>`;return;}
  const run=()=>play(buildScene(sp),showDrawResult);run();replayFn=run;
};
function showDrawResult(){
  const sp=D.lastSpec;if(!sp)return;const sc=buildScene(sp),res=sc.res,out=$('drawResult');
  if(res.none||!sc.impact){out.innerHTML='<div class="msg">두 차 경로가 만나지 않아서 사고가 나지 않았어요. 경로를 겹치게 다시 그려보세요.</div>';return;}
  if(res.base)out.innerHTML=`<div class="reveal">${ratioBar(res.final[0],res.final[1])}${explainHTML(res)}</div>`;
  else out.innerHTML=`<div class="msg warn">${res.msg||'이 조합은 아직 기준표에 넣지 않은 유형이에요.'} 판결 투표에 올려서 사람들 판단을 받아보세요!</div>`;
  $('uploadCard').classList.remove('hidden');$('upTitle').value='';$('upTitle').placeholder=describe(sc.N);$('upDesc').value='';$('upMsg').innerHTML='';
  $('upBtn').disabled=!apiOk;if(!apiOk)$('upMsg').innerHTML='<div class="msg warn">투표 서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.</div>';
}
$('upBtn').onclick=async()=>{
  const sp=D.lastSpec;if(!sp||!apiOk)return;const b=$('upBtn');b.disabled=true;
  const N=normalize(sp),title=($('upTitle').value.trim()||describe(N)).slice(0,40),desc=$('upDesc').value.trim().slice(0,120);
  const bad=checkText(title+' '+desc);if(bad){b.disabled=false;$('upMsg').innerHTML='';$('upMsg').append(el('div','msg warn',bad));return;}
  try{const r=await api('POST','/api/cases',{title,desc,spec:JSON.parse(JSON.stringify(sp))});
    $('upMsg').innerHTML='<div class="msg">올렸어요! 판결 투표 탭에서 확인할 수 있어요.</div>';pendingSelect=r.id;loadCases();}
  catch(err){b.disabled=false;$('upMsg').innerHTML='';$('upMsg').append(el('div','msg warn',errText(err)));}
};

/* ========== 판결 투표 (whose-fault-api 서버) ========== */
const API_BASE=(window.WF_CONFIG&&window.WF_CONFIG.apiBase)||'';
let capsPromise=null;
const POLL_MS=5000,LIST_MS=30000;
let apiOk=false,token=null,adminToken=null,isOwner=false,cases=[],sel=null,pendingSelect=null,state=null,pollTimer=null,listTimer=null,cSort='best',lastPost=0;
const CHOICES=[{k:'A100',a:100,t:'A 100%'},{k:'Amore',a:70,t:'A가 더 잘못'},{k:'half',a:50,t:'반반'},{k:'Bmore',a:30,t:'B가 더 잘못'},{k:'B100',a:0,t:'B 100%'}];
const choiceOf=v=>{const c=CHOICES.find(c=>c.k===v.choice);if(c)return c;let b=CHOICES[0];for(const x of CHOICES)if(Math.abs(x.a-v.a)<Math.abs(b.a-v.a))b=x;return b;};
const nearestChoice=a=>choiceOf({a});
const sideCls=c=>c.a>50?'a':c.a<50?'b':'';
const BAD=['시발','씨발','ㅅㅂ','ㅆㅂ','병신','ㅂㅅ','개새','좆','지랄','니애미','느금','썅','미친놈','미친년','꺼져'];
function checkText(t){
  const s=String(t||'').replace(/\s+/g,'');
  if(/\d{2,3}[가-힣]\d{4}/.test(s))return'차량 번호로 보이는 내용은 올릴 수 없어요.';
  if(/01[016789]-?\d{3,4}-?\d{4}/.test(s))return'전화번호로 보이는 내용은 올릴 수 없어요.';
  if(BAD.some(w=>s.includes(w)))return'욕설이 포함된 글은 올릴 수 없어요.';
  return null;
}
const store={get:k=>{try{return localStorage.getItem(k);}catch(_){return null;}},set:(k,v)=>{try{v==null?localStorage.removeItem(k):localStorage.setItem(k,v);}catch(_){}}};
const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e;};
function flash(t){setHint(t);setTimeout(()=>{if(hint.textContent===t)setHint('');},2600);}
function errText(err){return err&&err.message?err.message:'잠시 후 다시 시도해주세요.';}

class ApiError extends Error{constructor(status,code,message){super(message);this.status=status;this.code=code;}}
async function api(method,path,body,retried){
  const headers={};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(token)headers['Authorization']='Bearer '+token;
  if(adminToken)headers['X-Admin-Token']=adminToken;
  let res;
  try{res=await fetch(API_BASE+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}
  catch(_){throw new ApiError(0,'network','서버에 연결할 수 없어요. 잠시 후 다시 시도해주세요.');}
  if(res.status===204)return null;
  let data=null;try{data=await res.json();}catch(_){}
  if(res.status===401&&path!=='/api/session'&&!retried){token=null;store.set('wf_token',null);await ensureSession();return api(method,path,body,true);}
  if(!res.ok)throw new ApiError(res.status,(data&&data.error)||'http_'+res.status,(data&&data.message)||'잠시 후 다시 시도해주세요.');
  return data;
}
async function ensureSession(){if(token)return;const d=await api('POST','/api/session');token=d.token;store.set('wf_token',token);}

function sanitizeSpec(s){
  if(!s||typeof s!=='object')return null;
  let map=s.map==='road'?'road2':s.map;const m=MAPS[map];if(!m)return null;
  const o={map,mods:sanitizeMods(s.mods)};if(s.rear==='A'||s.rear==='B')o.rear=s.rear;
  for(const k of['A','B']){const c=s[k];if(!c||typeof c!=='object')return null;const q={};
    if(Array.isArray(c.pts)){if(c.pts.length<4||c.pts.length>400)return null;
      const pts=[];for(const p of c.pts){if(!Array.isArray(p)||p.length<2)return null;const x=+p[0],y=+p[1];if(!isFinite(x)||!isFinite(y)||x<-300||x>1300||y<-300||y>1300)return null;pts.push([x,y]);}
      q.pts=pts;}
    else if(m.kind==='cross'){if(!ARMS[c.arm]||!MAN[c.man])return null;q.arm=c.arm;q.man=c.man;}
    else if(m.kind==='road'){if(!m.lanes[c.lane-1]||!m.lanes[c.to-1])return null;q.lane=c.lane;q.to=c.to;}
    else return null;
    if(m.lights&&m.lights.includes(c.light))q.light=c.light;
    if(UT[c.ut])q.ut=c.ut;
    q.speed=clamp(+c.speed||m.limit,5,150);o[k]=q;}
  return o;
}

async function initCaps(){
  if(!API_BASE){capsReady(false);return;}
  token=store.get('wf_token');adminToken=store.get('wf_admin');
  try{await ensureSession();apiOk=true;}catch(_){apiOk=false;}
  if(adminToken){try{await api('GET','/api/admin/me');isOwner=true;}catch(_){isOwner=false;}}
  if(isOwner||new URLSearchParams(location.search).has('admin'))$('adminTab').classList.remove('hidden');
  capsReady(apiOk);
}
function capsReady(ok){
  if(!ok){$('caseStatus').textContent='투표 서버에 연결할 수 없어요. 잠시 후 다시 들어와 주세요.';return;}
  loadCases();
}
async function loadCases(){
  if(!apiOk)return;
  try{
    const list=await api('GET','/api/cases?limit=60');
    cases=(list||[]).map(x=>{const sp=sanitizeSpec(x.spec);if(!sp)return null;const N=normalize(sp);if(N.err)return null;
      return{id:String(x.id),title:String(x.title||'').slice(0,40)||describe(N),desc:String(x.desc||'').slice(0,120),spec:sp,N,createdAt:+x.createdAt||0,reports:+x.reports||0,hidden:!!x.hidden};}).filter(Boolean);
    $('caseStatus').classList.toggle('hidden',cases.length>0);
    if(!cases.length)$('caseStatus').textContent='아직 올라온 사고가 없어요. 직접 그리기 탭에서 첫 사고를 올려보세요!';
    renderCaseList();
    if(pendingSelect&&mode==='vote'){const c=cases.find(c=>c.id===pendingSelect);if(c){pendingSelect=null;selectCase(c.id);}}
    if(sel&&!cases.find(c=>c.id===sel.id)){sel=null;state=null;renderVoteDetail();}
    if(mode==='admin')renderAdmin();
  }catch(err){$('caseStatus').classList.remove('hidden');$('caseStatus').textContent='사고 목록을 불러오지 못했어요. '+errText(err);}
}
function startPolling(){
  stopPolling();
  pollTimer=setInterval(()=>{if(!document.hidden&&sel&&mode==='vote')fetchState();},POLL_MS);
  listTimer=setInterval(()=>{if(!document.hidden&&(mode==='vote'||mode==='admin'))loadCases();},LIST_MS);
}
function stopPolling(){if(pollTimer)clearInterval(pollTimer);if(listTimer)clearInterval(listTimer);pollTimer=listTimer=null;}
function renderCaseList(){
  const box=$('caseList');box.innerHTML='';
  for(const c of cases){const b=el('button','case'+(sel&&sel.id===c.id?' on':''));
    const l=el('div');l.style.minWidth='0';l.append(el('div','t',c.title),el('div','m',MAPS[c.spec.map].name+(c.hidden?' / 신고로 가려짐':'')));
    b.append(l,el('div','m',c.createdAt?timeAgo(c.createdAt):''));b.onclick=()=>{selectCase(c.id);window.scrollTo({top:0,behavior:'smooth'});};box.appendChild(b);}
}
function timeAgo(t){const s=(Date.now()-t)/1000;if(s<60)return'방금';if(s<3600)return Math.floor(s/60)+'분 전';if(s<86400)return Math.floor(s/3600)+'시간 전';return Math.floor(s/86400)+'일 전';}
function voteEnter(){
  A.preview=null;
  if(apiOk){loadCases();startPolling();}
  if(pendingSelect){const c=cases.find(c=>c.id===pendingSelect);if(c){pendingSelect=null;selectCase(c.id);return;}}
  if(sel)playSel();else{A.sc=null;A.state='idle';setHint(cases.length?'아래에서 사고를 골라주세요':'');replayBtn.classList.remove('show');}
  renderVoteDetail();
}
function playSel(){if(!sel)return;const sp=sel.spec;const run=()=>play(buildScene(sp));run();replayFn=run;setHint('');}
function selectCase(id){
  const c=cases.find(x=>x.id===id);if(!c)return;sel=c;state=null;
  renderCaseList();renderVoteDetail();playSel();fetchState();
}
async function fetchState(){
  if(!sel)return;const id=sel.id;
  try{const s=await api('GET','/api/cases/'+encodeURIComponent(id)+'/state');if(sel&&sel.id===id){state=s;renderVoteDetail(true);}}
  catch(err){if(err.status===404&&sel&&sel.id===id){sel=null;state=null;renderVoteDetail();loadCases();}}
}

function renderVoteDetail(onlyLive){
  const box=$('voteDetail');
  if(!sel){box.dataset.id='';box.innerHTML='<div class="msg">사람들이 직접 그려 올린 사고예요. 직감대로 투표하면 다른 사람들 판단과 기준표 결과가 공개되고, 댓글로 토론할 수 있어요.</div>';return;}
  if(onlyLive&&box.dataset.id===sel.id&&$('vLive')){renderLive();return;}
  box.dataset.id=sel.id;box.innerHTML='';
  box.append(el('h2','qtitle',sel.title));
  if(sel.desc)box.append(el('p','story',sel.desc));
  const ch=el('div','chips');renderChips(ch,sel.N);box.append(ch);
  const live=el('div');live.id='vLive';box.append(live);
  const foot=el('div','rowmini');
  const rep=el('button','mini','사고 신고');rep.onclick=()=>openReport(foot,'case',sel.id);foot.append(rep);
  if(isOwner){const del=el('button','mini danger','사고 삭제 (관리자)');del.onclick=()=>adminDelete('case',sel.id,del);foot.append(del);}
  box.append(foot);
  renderLive();
}
function renderLive(){
  const live=$('vLive');if(!live)return;live.innerHTML='';
  if(!state){live.append(el('div','msg',apiOk?'불러오는 중...':'투표 서버에 연결할 수 없어요.'));return;}
  if(state.caseHidden&&!isOwner){live.append(el('div','msg warn','신고가 많이 접수되어 가려진 사고예요. 관리자가 확인 중이에요.'));return;}
  const mine=state.myVote||null,mc=mine?choiceOf(mine):null;
  live.append(el('div','label',mine?'내 투표 (바꿀 수 있어요)':'누가 더 잘못했을까요? 직감대로 골라주세요'));
  const grid=el('div','choices');
  for(const c of CHOICES){const b=el('button','choice '+sideCls(c)+(mc&&mc.k===c.k?' on':''),c.t);b.disabled=!apiOk;
    b.onclick=()=>castVote(c,mine?!!mine.disagree:false);grid.append(b);}
  live.append(grid);
  if(!state.votes){live.append(el('div','msg',`투표하면 다른 사람들의 선택, 기준표 결과, 토론 댓글 ${state.commentCount||0}개가 공개돼요. 지금까지 ${state.total||0}명 참여`));return;}
  live.append(resultsEl(mine));
  if(mine)live.append(commentsEl(mine));
  else if(state.comments)live.append(commentsEl(null));
}
async function castVote(c,disagree){
  try{await api('PUT','/api/cases/'+encodeURIComponent(sel.id)+'/vote',{choice:c.k,disagree:!!disagree});await fetchState();}
  catch(err){flash(errText(err));}
}
function resultsEl(mine){
  const wrap=el('div','reveal'),v=state.votes,n=v.total||0;
  const counts=CHOICES.map(c=>+(v.counts&&v.counts[c.k])||0);
  const top=counts.indexOf(Math.max(...counts)),topPct=n?Math.round(counts[top]/n*100):0;
  const res=judge(sel.N);
  const gap=el('div','gapcard');
  if(res.base){const std=nearestChoice(res.final[0]),same=std.k===CHOICES[top].k;
    gap.append(el('div','gap1',`투표자 ${topPct}%가 "${CHOICES[top].t}"`));
    gap.append(el('div','gap2',same?`기준표도 A ${res.final[0]} : B ${res.final[1]}로 같은 쪽이에요`:`그런데 기준표로는 A ${res.final[0]} : B ${res.final[1]}`));
    if(!same)gap.classList.add('flip');}
  else{gap.append(el('div','gap1',`투표자 ${topPct}%가 "${CHOICES[top].t}"`));gap.append(el('div','gap2','기준표에 없는 사고라 여러분의 판결이 곧 정답이에요'));}
  wrap.append(gap,el('div','label',`사람들의 선택 (${n}명)`));
  CHOICES.forEach((c,i)=>{const row=el('div','drow'+(mine&&choiceOf(mine).k===c.k?' mine':''));const pct=n?Math.round(counts[i]/n*100):0;
    row.append(el('span','dl',c.t));const bar=el('div','db');const f=el('i',sideCls(c));f.style.width=pct+'%';bar.append(f);row.append(bar,el('span','dp',pct+'%'));wrap.append(row);});
  wrap.append(el('div','verdict2',n>=5&&v.median!=null?`시민 판결 (중앙값): ${nearestChoice(v.median).t}`:`시민 판결 대기 중 (${n}/5표)`));
  if(res.base){const det=el('details','stddet');det.append(el('summary',null,'기준표 근사 결과와 근거 보기'));const d=el('div');d.innerHTML=ratioBar(res.final[0],res.final[1])+explainHTML(res);det.append(d);wrap.append(det);
    if(mine){const dis=+v.disagree||0;
      const b2=el('button','toggle'+(mine.disagree?' on':''),mine.disagree?'기준이 이상하다 (내가 누름)':'기준이 이상하다');
      b2.onclick=()=>castVote(choiceOf(mine),!mine.disagree);
      const row=el('div','disrow');row.append(b2,el('span','m',`투표자 ${n?Math.round(dis/n*100):0}%가 기준에 동의하지 않아요`));wrap.append(row);}}
  return wrap;
}
function commentsEl(mine){
  const list0=state.comments||[],wrap=el('div','cwrap');
  const head=el('div','chead');head.append(el('b',null,`토론 ${list0.length}`));
  const sorts=el('div','csort');for(const [k,t] of [['best','공감순'],['new','최신순']]){const b=el('button',cSort===k?'on':'',t);b.onclick=()=>{cSort=k;renderLive();};sorts.append(b);}
  head.append(sorts);wrap.append(head);
  if(mine){
    const mc=choiceOf(mine),form=el('div','cform');
    form.append(el('span','side '+sideCls(mc),`${mc.t} 파`));
    const ta=el('textarea');ta.maxLength=300;ta.placeholder='왜 그렇게 생각하세요? (차량 번호, 실명, 욕설은 올릴 수 없어요)';form.append(ta);
    const btn=el('button','btn','댓글 올리기'),msg=el('div');
    btn.onclick=async()=>{const t=ta.value.trim();if(!t)return;const bad=checkText(t);if(bad){msg.innerHTML='';msg.append(el('div','msg warn',bad));return;}
      if(Date.now()-lastPost<15000){msg.innerHTML='';msg.append(el('div','msg warn','댓글은 15초에 한 번씩 쓸 수 있어요.'));return;}
      btn.disabled=true;
      try{await api('POST','/api/cases/'+encodeURIComponent(sel.id)+'/comments',{text:t});lastPost=Date.now();ta.value='';msg.innerHTML='';await fetchState();}
      catch(err){msg.innerHTML='';msg.append(el('div','msg warn',errText(err)));}
      btn.disabled=false;};
    form.append(btn,msg);wrap.append(form);
  }
  let list=list0.slice();
  const best=list.filter(c=>c.likes>=2&&!c.hidden).sort((a,b)=>b.likes-a.likes).slice(0,3),bestIds=new Set(best.map(c=>c.id));
  list=list.filter(c=>!bestIds.has(c.id));
  list.sort(cSort==='best'?(a,b)=>(b.likes-a.likes)||(b.at-a.at):(a,b)=>b.at-a.at);
  for(const c of[...best,...list])wrap.append(commentEl(c,bestIds.has(c.id)));
  if(!list0.length)wrap.append(el('div','msg','아직 댓글이 없어요. 첫 의견을 남겨보세요!'));
  return wrap;
}
function commentEl(c,isBest){
  const item=el('div','citem'+(isBest?' best':''));
  if(c.hidden&&!isOwner){item.append(el('div','m','신고가 많아 가려진 댓글이에요.'));return item;}
  const top=el('div','ctop');
  if(isBest)top.append(el('span','bestTag','베스트'));
  const ch=choiceOf(c);top.append(el('span','side '+sideCls(ch),`${ch.t} 파`));
  top.append(el('span','cname',String(c.nick||'운전자')));
  if(c.veteran)top.append(el('span','vet','베테랑'));
  top.append(el('span','m',timeAgo(+c.at||0)));
  item.append(top,el('div','ctext',String(c.text||'').slice(0,300)));
  if(isOwner&&c.reports)item.append(el('div','m',`신고 ${c.reports}건`));
  const act=el('div','cact');
  const lk=el('button','mini'+(c.liked?' on':''),`공감 ${c.likes||0}`);
  lk.onclick=async()=>{try{await api(c.liked?'DELETE':'PUT','/api/comments/'+encodeURIComponent(c.id)+'/like');await fetchState();}catch(err){flash(errText(err));}};
  act.append(lk);
  if(!c.mine){const rp=el('button','mini','신고');rp.onclick=()=>openReport(item,'comment',c.id);act.append(rp);}
  if(c.mine||isOwner){const dl=el('button','mini danger',c.mine?'삭제':'삭제 (관리자)');dl.onclick=()=>adminDelete('comment',c.id,dl);act.append(dl);}
  item.append(act);return item;
}
const REASONS=['욕설, 비방','개인정보 (차량 번호, 실명 등)','도배, 광고','기타'];
function openReport(host,type,tid){
  if(!apiOk){flash('서버에 연결된 뒤에 신고할 수 있어요.');return;}
  const old=host.querySelector('.rpanel');if(old){old.remove();return;}
  const p=el('div','rpanel');p.append(el('div','m','신고 사유를 골라주세요'));
  for(const r of REASONS){const b=el('button','mini',r);b.onclick=async()=>{
    try{await api('POST','/api/reports',{type,targetId:tid,reason:r});p.innerHTML='';p.append(el('div','m','신고가 접수됐어요. 감사합니다.'));setTimeout(()=>p.remove(),1800);}
    catch(err){p.append(el('div','msg warn',errText(err)));}};p.append(b);}
  host.append(p);
}
async function adminDelete(type,tid,btn){
  if(btn){if(btn.dataset.confirm!=='1'){const old=btn.textContent;btn.dataset.confirm='1';btn.textContent='한 번 더 누르면 삭제';setTimeout(()=>{if(btn.isConnected){btn.dataset.confirm='';btn.textContent=old;}},3000);return;}btn.disabled=true;}
  try{
    if(type==='case')await api('DELETE','/api/admin/cases/'+encodeURIComponent(tid));
    else await api('DELETE','/api/comments/'+encodeURIComponent(tid));
    if(type==='case'&&sel&&sel.id===tid){sel=null;state=null;renderVoteDetail();}
    if(sel)await fetchState();
    await loadCases();
    if(mode==='admin')loadAdmin();
  }catch(err){if(btn)btn.disabled=false;flash(errText(err));}
}

/* ========== 관리자 ========== */
let adminReports=[],adminComments=[],adminStats=null;
function adminEnter(){
  A.preview=null;setHint('');stopPolling();
  if(!isOwner){renderAdminLogin();return;}
  loadAdmin();startPolling();
}
function renderAdminLogin(msg){
  const box=$('adminBox');box.innerHTML='';const c=el('div','card');
  c.append(el('div','label','관리자 토큰'));
  const inp=el('input');inp.type='password';inp.placeholder='서버의 ADMIN_TOKEN 값';inp.autocomplete='off';
  const b=el('button','btn','확인');const m=el('div');if(msg)m.append(el('div','msg warn',msg));
  b.onclick=async()=>{adminToken=inp.value.trim();if(!adminToken)return;b.disabled=true;
    try{await api('GET','/api/admin/me');isOwner=true;store.set('wf_admin',adminToken);adminEnter();if(sel)renderVoteDetail();}
    catch(err){isOwner=false;adminToken=null;b.disabled=false;m.innerHTML='';m.append(el('div','msg warn',err.status===403?'토큰이 맞지 않아요.':errText(err)));}};
  c.append(inp,b,m);box.append(c);
}
async function loadAdmin(){
  try{[adminReports,adminComments,adminStats]=await Promise.all([api('GET','/api/admin/reports'),api('GET','/api/admin/comments?limit=100'),api('GET','/api/admin/quiz-stats').catch(()=>null)]);renderAdmin();}
  catch(err){if(err.status===403){isOwner=false;adminToken=null;store.set('wf_admin',null);renderAdminLogin('관리자 토큰이 만료됐거나 바뀌었어요.');}else flash(errText(err));}
}
function statsCard(st){
  const c=el('div','card'),T=st.totals||{};c.append(el('div','label','퀴즈 통계 (시작은 첫 문제에 답한 수)'));
  const pct=(a,b)=>b?Math.round(a/b*100)+'%':'-';
  const grid=el('div','kgrid');
  for(const [k,v,sub] of [['오늘 완료',T.completionsToday,`시작 ${T.startsToday||0}`],['누적 완료',T.completions,`시작 ${T.starts||0}, 완주율 ${pct(T.completions,T.starts)}`],
    ['푼 사람',T.players,`오늘 ${T.playersToday||0}명`],['평균 점수',T.avgScore==null?'-':Math.round(T.avgScore),'100점 만점'],
    ['공유 클릭',T.shareClicks,`완료 대비 ${pct(T.shareClicks,T.completions)}`],['공유로 유입',T.shareVisits,`클릭 대비 ${pct(T.shareVisits,T.shareClicks)}`]]){
    const b=el('div','kbox');b.append(el('div','m',k),el('div','kv',String(v==null?0:v)),el('div','m',sub));grid.append(b);}
  c.append(grid);
  c.append(el('div','label','등급 분포'));
  const gs=st.grades||{},gt=Object.values(gs).reduce((a,b)=>a+b,0);
  for(const g of GRADES){const n=gs[g.slug]||0,row=el('div','drow');row.append(el('span','dl',g.badge),Object.assign(el('div','db'),{}),el('span','dp',pct(n,gt)));
    const f=el('i');f.style.width=(gt?n/gt*100:0)+'%';row.children[1].append(f);c.append(row);}
  c.append(el('div','label','최근 14일 퀴즈 완료 수 (아래 숫자는 날짜, 막대에 손을 대면 시작 수)'));
  const days=st.daily||[],mx=Math.max(1,...days.map(d=>d.completions)),h=el('div','hist');
  for(const d of days){const b=el('div');b.style.height=(d.completions/mx*100)+'%';b.title=`${d.day} 시작 ${d.starts} 완료 ${d.completions}`;h.append(b);}
  c.append(h);const hl=el('div','hlabels');for(const d of days)hl.append(el('span',null,d.day.slice(8)));c.append(hl);
  c.append(el('div','label','사람들이 가장 많이 틀린 사고'));
  const qs=(st.questions||[]).slice(0,8);
  if(!qs.length)c.append(el('div','msg','아직 기록이 없어요.'));
  for(const q of qs){const item=Q.find(x=>x.id===q.qid),it=el('div','aitem');
    it.append(el('div','ctext',item?item.t:q.qid));
    it.append(el('div','m',`${q.n}명 / 정확히 맞힘 ${pct(q.exact,q.n)} / 평균 ${Math.round(q.avgDiff)}만큼 차이 / 사람들 평균 A ${Math.round(q.avgGuess)} vs 기준 A ${q.answer}`));
    c.append(it);}
  return c;
}
function renderAdmin(){
  const box=$('adminBox');if(!box||!isOwner||mode!=='admin')return;box.innerHTML='';
  const bar=el('div','rowmini');const rf=el('button','mini','새로고침');rf.onclick=()=>{loadCases();loadAdmin();};
  const lo=el('button','mini','관리자 로그아웃');lo.onclick=()=>{isOwner=false;adminToken=null;store.set('wf_admin',null);renderAdminLogin();if(sel)renderVoteDetail();};
  bar.append(rf,lo);box.append(bar);
  if(adminStats)box.append(statsCard(adminStats));
  const c1=el('div','card');c1.append(el('div','label',`신고 접수 (${adminReports.length}건)`));
  if(!adminReports.length)c1.append(el('div','msg','처리할 신고가 없어요.'));
  for(const g of adminReports){
    const it=el('div','aitem');
    it.append(el('div','m',`${g.type==='case'?'사고':'댓글'} / 신고 ${g.count}건 / ${(g.reasons||[]).join(', ')} / ${timeAgo(+g.lastAt||0)}`));
    it.append(el('div','ctext',g.preview||'(이미 삭제됨)'));
    const row=el('div','cact');
    const del=el('button','mini danger','삭제');del.onclick=()=>adminDelete(g.type,g.targetId,del);
    const keep=el('button','mini','신고 기각');keep.onclick=async()=>{keep.disabled=true;try{await api('POST','/api/admin/reports/dismiss',{type:g.type,targetId:g.targetId});loadAdmin();loadCases();}catch(err){keep.disabled=false;flash(errText(err));}};
    const go=el('button','mini','사고 보기');go.onclick=()=>{setMode('vote');selectCase(g.caseId);window.scrollTo({top:0});};
    row.append(del,keep,go);it.append(row);c1.append(it);}
  box.append(c1);
  const c2=el('div','card');c2.append(el('div','label',`최근 댓글 (${adminComments.length})`));
  for(const c of adminComments){const it=el('div','aitem');
    it.append(el('div','m',`${c.nick} / ${c.caseTitle} / ${timeAgo(+c.at||0)}`),el('div','ctext',String(c.text||'')));
    const row=el('div','cact');const del=el('button','mini danger','삭제');del.onclick=()=>adminDelete('comment',c.id,del);row.append(del);it.append(row);c2.append(it);}
  box.append(c2);
  const c3=el('div','card');c3.append(el('div','label',`올라온 사고 (${cases.length})`));
  for(const c of cases){const it=el('div','aitem');it.append(el('div','ctext',c.title),el('div','m',`${MAPS[c.spec.map].name} / ${timeAgo(c.createdAt)}${c.reports?` / 신고 ${c.reports}건`:''}`));
    const row=el('div','cact');const del=el('button','mini danger','삭제');del.onclick=()=>adminDelete('case',c.id,del);
    const go=el('button','mini','보기');go.onclick=()=>{setMode('vote');selectCase(c.id);window.scrollTo({top:0});};row.append(del,go);it.append(row);c3.append(it);}
  box.append(c3);
}

/* ========== 시작 ========== */
window.__fs={Q,normalize,judge,buildScene,play}; // 테스트용 훅
capsPromise=initCaps();
{const qp=new URLSearchParams(location.search);if(qp.get('from')==='share'){const g=qp.get('g');track('share_visit',GRADES.some(x=>x.slug===g)?g:undefined);}}
quizStart();
})();
