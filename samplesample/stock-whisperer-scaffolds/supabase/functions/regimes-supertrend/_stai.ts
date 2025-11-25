// Minimal Edge-local copy to avoid bundling headaches in Deno
export type Bar = { t:number; o:number; h:number; l:number; c:number };
export type STPoint = { t:number; upper:number; lower:number; trend:1|-1 };

export function supertrendBands(bars: Bar[], atrPeriod = 10, factor = 3): STPoint[] {
  const n = bars.length; if (!n) return [];
  const tr:number[] = new Array(n).fill(0); const atr:number[] = new Array(n).fill(0);
  for (let i=0;i<n;i++){
    const pc = i>0? bars[i-1].c : bars[i].c;
    const r = Math.max(bars[i].h - bars[i].l, Math.abs(bars[i].h - pc), Math.abs(bars[i].l - pc));
    tr[i] = r; atr[i] = i===0 ? r : atr[i-1] + (r - atr[i-1]) / atrPeriod;
  }
  let upper=NaN, lower=NaN, trend:1|-1=1; const out:STPoint[]=[];
  for (let i=0;i<n;i++){
    const mid=(bars[i].h+bars[i].l)/2; const bu=mid + factor*atr[i]; const bl=mid - factor*atr[i];
    if (i===0){ upper=bu; lower=bl; } else {
      upper = (bu<upper || bars[i-1].c>upper)? bu:upper;
      lower = (bl>lower || bars[i-1].c<lower)? bl:lower;
      if (bars[i].c>upper){ trend=1; lower=bl; } else if (bars[i].c<lower){ trend=-1; upper=bu; }
    }
    out.push({ t:bars[i].t, upper, lower, trend });
  }
  return out;
}

function mulberry32(a:number){return function(){let t=a+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}}
function kmeans2D(data:number[][], k:number, seed=42){
  const rnd=mulberry32(seed); const n=data.length; const idxs=new Set<number>();
  while (idxs.size<k) idxs.add(Math.floor(rnd()*n));
  let centroids=[...idxs].map(i=>data[i].slice(0)); let labels=new Array(n).fill(0);
  for(let it=0;it<25;it++){
    for(let i=0;i<n;i++){
      let best=0,bd=Infinity; for(let c=0;c<k;c++){const dx=data[i][0]-centroids[c][0]; const dy=data[i][1]-centroids[c][1]; const d=dx*dx+dy*dy; if(d<bd){bd=d;best=c;}}
      labels[i]=best;
    }
    const sums=Array.from({length:k},()=>[0,0,0]);
    for(let i=0;i<n;i++){const l=labels[i]; sums[l][0]+=data[i][0]; sums[l][1]+=data[i][1]; sums[l][2]++;}
    const next=centroids.map((c,j)=>sums[j][2]?[sums[j][0]/sums[j][2],sums[j][1]/sums[j][2]]:c);
    if(centroids.every((c,j)=>Math.abs(c[0]-next[j][0])<1e-9 && Math.abs(c[1]-next[j][1])<1e-9)) break;
    centroids=next;
  }
  return { labels, centroids };
}

export function supertrendAI(bars:Bar[], opts:{atrPeriod:number,factorMin:number,factorMax:number,factorStep:number,perfAlpha:number,k?:number,seed?:number}){
  const {atrPeriod,factorMin,factorMax,factorStep,perfAlpha}=opts; const k=opts.k??3; const seed=opts.seed??42;
  const factors:number[]=[]; for(let f=factorMin; f<=factorMax+1e-12; f+=factorStep) factors.push(+f.toFixed(6));
  const perFactor = factors.map(f=>{ const bands=supertrendBands(bars,atrPeriod,f); const signal=bands.map(b=>b.trend);
    const perf=new Array(bars.length).fill(0); for(let i=1;i<bars.length;i++){const dC=bars[i].c-bars[i-1].c; perf[i]=perf[i-1]+perfAlpha*(dC*signal[i-1]-perf[i-1]);}
    return {factor:f,bands,signal,perf};
  });
  const out:{bands:STPoint[],factor:number[],perf:number[],cluster:('LOW'|'AVG'|'TOP')[]}={bands:[],factor:[],perf:[],cluster:[]};
  for(let i=1;i<bars.length;i++){
    const feats=perFactor.map(p=>[p.perf[i], p.perf[i]-p.perf[i-1]]);
    const {labels,centroids}=kmeans2D(feats,k,seed);
    const order=centroids.map((c,idx)=>({idx,mu:c[0]})).sort((a,b)=>b.mu-a.mu).map(x=>x.idx);
    const top=order[0], sec=order[1]??order[0]; const topF:number[]=[], secF:number[]=[], topP:number[]=[], secP:number[]=[];
    labels.forEach((cid,j)=>{const f=factors[j], p=feats[j][0]; if(cid===top){topF.push(f); topP.push(p);} else if(cid===sec){secF.push(f); secP.push(p);} });
    const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:NaN;
    const fTop=mean(topF), fSec=mean(secF); const pTop=Math.abs(mean(topP))+1e-9, pSec=Math.abs(mean(secP))+1e-9;
    const fStar = (!isFinite(fTop)? fSec : (!isFinite(fSec)? fTop : (pTop*fTop + pSec*fSec)/(pTop+pSec)));
    const bands=supertrendBands(bars.slice(0,i+1), atrPeriod, fStar); const last=bands[bands.length-1];
    out.bands.push(last); out.factor.push(fStar); out.perf.push(pTop); out.cluster.push('TOP');
  }
  return out;
}
