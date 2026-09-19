'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const e={imgIn:$('imageInput'),ws:$('imageWorkspace'),cv:$('imageCanvas'),ocr:$('ocrBtn'),ocrSt:$('ocrStatus'),src:$('sourceText'),out:$('maskedText'),mask:$('maskBtn'),restore:$('restoreTextBtn'),sum:$('detectSummary'),save:$('saveImageBtn'),copy:$('copyTextBtn'),toast:$('toast'),prep:$('prepareOfflineBtn'),help:$('installHelpBtn'),guide:$('installGuide'),net:$('networkChip'),off:$('offlineChip'),msg:$('offlineMessage'),prog:$('offlineProgress'),bar:$('offlineProgressBar'),progTxt:$('offlineProgressText'),imgMode:$('imageMode'),txtMode:$('textMode'),maskStep:$('maskStepLabel'),outStep:$('outputStepLabel'),undo:$('undoMaskBtn'),clear:$('clearMaskBtn'),previewWrap:$('exportPreviewWrap'),preview:$('exportPreview'),sharePreview:$('sharePreviewBtn'),wrap:$('canvasWrap'),drawMode:$('drawModeBtn'),selectMode:$('selectModeBtn'),deleteMask:$('deleteMaskBtn'),toolNote:$('toolNote'),plainOcrMode:$('plainOcrModeBtn'),layoutOcrMode:$('layoutOcrModeBtn'),layoutHint:$('layoutModeHint'),layoutSummary:$('layoutSummary')};
const ctx=e.cv.getContext('2d'); let base=null,dataUrl='',rects=[],draft=null,drag=false,snapshot='',ready=false,worker=null,reg=null,loadPromise=null,exportBlob=null,editMode='draw',selectedId=null,zoom=100,lastOcrWords=[],lastOcrSize=null,selectStart=null,maskSeq=1,ocrOutputMode='plain',lastPlainText='',lastLayoutResult=null,lastTableResult=null;
const rules={email:{l:'[EMAIL]',r:/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi},phone:{l:'[PHONE]',r:/(?<!\d)(?:\+81[-\s]?)?(?:0\d{1,4}[-\s]?\d{1,4}[-\s]?\d{3,4})(?!\d)/g},postcode:{l:'[POSTCODE]',r:/(?<!\d)(?:〒\s*)?(?:\d{3}[-ー－]\d{4}|\d{7})(?!\d|[-ー－]\d)/g},url:{l:'[URL]',r:/\bhttps?:\/\/[^\s<>"']+/gi},number:{l:'[NUMBER]',r:/(?<!\d)(?:\d[\s-]?){8,}\d(?!\d)/g}};
function toast(t,err=false){e.toast.textContent=t;e.toast.style.color=err?'#8f3434':'#335f4a';clearTimeout(toast.t);toast.t=setTimeout(()=>e.toast.textContent='',3000)}
function network(){const on=navigator.onLine;e.net.textContent=on?'ONLINE':'OFFLINE';e.net.classList.toggle('is-ready',on);e.net.classList.toggle('is-offline',!on)} addEventListener('online',network);addEventListener('offline',network);network();
function setReady(v){ready=!!v;e.off.textContent=ready?'OCR READY':'OCR 未準備';e.off.classList.toggle('is-ready',ready);e.prep.textContent=ready?'✓ オフライン準備済み':'オフライン準備をする';e.prep.disabled=ready;e.ocr.disabled=!ready||!base;e.msg.textContent=ready?'OCRパックはこの端末に保存済みです。機内モードでも利用できます。':(navigator.onLine?'初回だけOCRパックをこのiPhoneへ保存します。':'OCRパックが未準備です。オンライン時に一度だけ準備してください。');if(ready)loadTesseract().catch(()=>{})}
function swMsg(ev){const d=ev.data||{};if(d.type==='OCR_STATUS')setReady(d.ready);if(d.type==='OCR_CACHE_PROGRESS'){e.prog.classList.remove('is-hidden');const p=Math.round(d.done/d.total*100);e.bar.style.width=p+'%';e.progTxt.textContent=`OCRパックを保存中… ${d.done}/${d.total}`;}if(d.type==='OCR_CACHE_READY'){e.bar.style.width='100%';e.progTxt.textContent='✓ オフライン準備が完了しました。';setReady(true);toast('✓ これで機内モードでもOCRできます。')}if(d.type==='OCR_CACHE_ERROR'){e.prep.disabled=false;e.progTxt.textContent='保存に失敗しました。通信を確認して再試行してください。';toast('OCRパックの保存に失敗しました。',true)}}
async function initSW(){if(!('serviceWorker'in navigator)){e.off.textContent='非対応';e.prep.disabled=true;return}try{reg=await navigator.serviceWorker.register('./sw.js',{scope:'./'});await navigator.serviceWorker.ready;navigator.serviceWorker.addEventListener('message',swMsg);(navigator.serviceWorker.controller||reg.active)?.postMessage({type:'GET_OCR_STATUS'})}catch(x){console.error(x);e.off.textContent='準備不可';e.msg.textContent='HTTPSで開いているか確認してください。'}}
e.prep.onclick=()=>{if(!navigator.onLine)return toast('初回準備だけはインターネット接続が必要です。',true);const w=navigator.serviceWorker.controller||reg?.active;if(!w)return toast('ページを一度再読み込みしてください。',true);e.prep.disabled=true;e.prog.classList.remove('is-hidden');e.bar.style.width='2%';e.progTxt.textContent='OCRパックの保存を開始します…';w.postMessage({type:'CACHE_OCR_ASSETS'})};e.help.onclick=()=>e.guide.classList.toggle('is-hidden');
function loadTesseract(){if(window.Tesseract)return Promise.resolve(window.Tesseract);if(loadPromise)return loadPromise;loadPromise=new Promise((ok,ng)=>{const s=document.createElement('script');s.src='./offline/tesseract.min.js';s.onload=()=>window.Tesseract?ok(window.Tesseract):ng();s.onerror=ng;document.head.appendChild(s)});return loadPromise}
async function getWorker(log){if(worker)return worker;await loadTesseract();const abs=p=>new URL(p,location.href).href.replace(/\/$/,'');worker=await Tesseract.createWorker(['jpn','eng'],1,{workerPath:abs('./offline/worker.min.js'),corePath:abs('./offline/core'),langPath:abs('./offline/lang'),logger:log});await worker.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});return worker}
function mode(m){$$('.mode-btn').forEach(b=>b.classList.toggle('is-active',b.dataset.mode===m));e.imgMode.classList.toggle('is-hidden',m!=='image');e.txtMode.classList.toggle('is-hidden',m!=='text');e.maskStep.textContent=m==='image'?'STEP 3':'STEP 2';e.outStep.textContent=m==='image'?'STEP 4':'STEP 3';e.save.disabled=m==='text'||!base;if(m==='text')setTimeout(()=>e.src.focus(),0)} $$('.mode-btn').forEach(b=>b.onclick=()=>mode(b.dataset.mode));
function fit(img){const s=Math.min(1,2200/Math.max(img.naturalWidth,img.naturalHeight));e.cv.width=Math.max(1,Math.round(img.naturalWidth*s));e.cv.height=Math.max(1,Math.round(img.naturalHeight*s))}
function draw(withDraft=true,withSelection=true){
  if(!base)return;
  ctx.clearRect(0,0,e.cv.width,e.cv.height);
  ctx.drawImage(base,0,0,e.cv.width,e.cv.height);
  ctx.fillStyle='#000';
  rects.forEach(r=>ctx.fillRect(r.x,r.y,r.w,r.h));
  if(withSelection&&selectedId){
    const r=rects.find(x=>x.id===selectedId);
    if(r){
      ctx.save();
      ctx.strokeStyle='#ff4d4f';
      ctx.lineWidth=Math.max(3,e.cv.width/650*2);
      ctx.setLineDash([10,7]);
      ctx.strokeRect(r.x+2,r.y+2,Math.max(0,r.w-4),Math.max(0,r.h-4));
      ctx.restore();
    }
  }
  if(withDraft&&draft){
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.68)';
    ctx.fillRect(draft.x,draft.y,draft.w,draft.h);
    ctx.restore();
  }
}
function loadImage(f){if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return toast('PNG / JPG / WebP を選択してください。',true);const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{base=img;dataUrl=String(r.result);rects=[];selectedId=null;lastOcrWords=[];lastOcrSize=null;lastPlainText='';lastLayoutResult=null;lastTableResult=null;e.layoutSummary.classList.add('is-hidden');e.layoutSummary.textContent='';fit(img);setZoom(100);setEditMode('draw');draw();e.ws.classList.remove('is-hidden');e.save.disabled=false;e.ocr.disabled=!ready;e.ocrSt.textContent=ready?'OCRを実行できます。':'先にオフライン準備を完了してください。'};img.src=String(r.result)};r.readAsDataURL(f)} e.imgIn.onchange=x=>loadImage(x.target.files?.[0]);
function pt(ev){const r=e.cv.getBoundingClientRect();return{x:(ev.clientX-r.left)*e.cv.width/r.width,y:(ev.clientY-r.top)*e.cv.height/r.height}}
function setZoom(v){
  zoom=Number(v)||100;
  e.cv.style.width=zoom+'%';
  $$('.zoom-btn').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.zoom)===zoom));
}
$$('.zoom-btn').forEach(b=>b.onclick=()=>setZoom(b.dataset.zoom));
function setEditMode(m){
  editMode=m;
  e.drawMode.classList.toggle('is-active',m==='draw');
  e.selectMode.classList.toggle('is-active',m==='select');
  e.wrap.classList.toggle('is-draw',m==='draw');
  e.wrap.classList.toggle('is-select',m==='select');
  e.toolNote.textContent=m==='draw'?'画像上をドラッグして黒塗りします。':'画像をスクロールできます。黒塗りをタップすると個別選択できます。';
}
e.drawMode.onclick=()=>setEditMode('draw');
e.selectMode.onclick=()=>setEditMode('select');
function hitMask(p){
  for(let i=rects.length-1;i>=0;i--){
    const r=rects[i];
    if(p.x>=r.x&&p.x<=r.x+r.w&&p.y>=r.y&&p.y<=r.y+r.h)return r;
  }
  return null;
}
function selectMaskAt(p){
  const r=hitMask(p);
  selectedId=r?r.id:null;
  e.deleteMask.disabled=!selectedId;
  draw();
}
e.cv.onpointerdown=ev=>{
  if(!base)return;
  const p=pt(ev);
  if(editMode==='select'){
    selectStart={x:ev.clientX,y:ev.clientY,p};
    return;
  }
  drag=true;
  e.cv.setPointerCapture(ev.pointerId);
  selectedId=null;e.deleteMask.disabled=true;
  draft={x:p.x,y:p.y,w:0,h:0,sx:p.x,sy:p.y};
  draw();
};
e.cv.onpointermove=ev=>{
  if(editMode!=='draw'||!drag||!draft)return;
  const p=pt(ev);
  draft.x=Math.min(draft.sx,p.x);
  draft.y=Math.min(draft.sy,p.y);
  draft.w=Math.abs(p.x-draft.sx);
  draft.h=Math.abs(p.y-draft.sy);
  draw();
};
function end(ev){
  if(editMode==='select'){
    if(selectStart){
      const d=Math.hypot(ev.clientX-selectStart.x,ev.clientY-selectStart.y);
      if(d<10)selectMaskAt(selectStart.p);
    }
    selectStart=null;
    return;
  }
  if(!drag||!draft)return;
  drag=false;
  try{e.cv.releasePointerCapture(ev.pointerId)}catch{}
  if(draft.w>4&&draft.h>4)rects.push({id:maskSeq++,x:draft.x,y:draft.y,w:draft.w,h:draft.h,source:'manual',type:'manual'});
  draft=null;
  draw();
}
e.cv.onpointerup=end;
e.cv.onpointercancel=end;
e.deleteMask.onclick=()=>{
  if(!selectedId)return;
  rects=rects.filter(r=>r.id!==selectedId);
  selectedId=null;
  e.deleteMask.disabled=true;
  draw();
};
e.undo.onclick=()=>{
  if(!rects.length)return;
  const removed=rects.pop();
  if(removed&&removed.id===selectedId){selectedId=null;e.deleteMask.disabled=true}
  draw();
};
e.clear.onclick=()=>{rects=[];selectedId=null;e.deleteMask.disabled=true;draw()};
function selectedDetectTypes(){return $$('input[name="detect"]:checked').map(i=>i.value)}
function plainRegex(rule){
  const flags=rule.r.flags.replace(/g/g,'').replace(/y/g,'');
  return new RegExp('^(?:'+rule.r.source+')$',flags);
}
function looksSensitive(text,type){
  const s=String(text||'').trim();
  if(!s)return false;
  const re1=plainRegex(rules[type]);
  if(re1.test(s))return true;
  const compact=s.replace(/\s+/g,'');
  const re2=plainRegex(rules[type]);
  return re2.test(compact);
}
function extractOcrWords(data){
  if(Array.isArray(data&&data.words)&&data.words.length){
    return data.words
      .filter(w=>w&&w.bbox&&String(w.text||'').trim())
      .map(w=>({text:w.text||'',bbox:w.bbox}));
  }
  const words=[];
  const blocks=(data&&data.blocks)||[];
  blocks.forEach((b,bi)=>{
    (b.paragraphs||[]).forEach((p,pi)=>{
      (p.lines||[]).forEach((l,li)=>{
        (l.words||[]).forEach(w=>{
          if(w&&w.bbox&&String(w.text||'').trim())words.push({text:w.text||'',bbox:w.bbox,lineKey:bi+'-'+pi+'-'+li});
        });
      });
    });
  });
  if(words.length)return words;
  if(typeof (data&&data.tsv)==='string'){
    const rows=data.tsv.trim().split(/\r?\n/).slice(1);
    for(const row of rows){
      const c=row.split('\t');
      if(c.length<12||c[0]!=='5')continue;
      const left=+c[6],top=+c[7],ww=+c[8],hh=+c[9],text=c.slice(11).join('\t');
      if(text.trim())words.push({text,bbox:{x0:left,y0:top,x1:left+ww,y1:top+hh},lineKey:[c[1],c[2],c[3],c[4]].join('-')});
    }
  }
  return words;
}
function groupWordsIntoLines(words){
  const sorted=[...words].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0);
  const lines=[];
  for(const w of sorted){
    const cy=(w.bbox.y0+w.bbox.y1)/2;
    const h=Math.max(1,w.bbox.y1-w.bbox.y0);
    let best=null,bestDist=Infinity;
    for(const line of lines){
      const d=Math.abs(cy-line.cy);
      if(d<Math.max(8,h*.7,line.h*.7)&&d<bestDist){best=line;bestDist=d}
    }
    if(!best){best={cy,h,items:[]};lines.push(best)}
    best.items.push(w);
    best.cy=(best.cy*(best.items.length-1)+cy)/best.items.length;
    best.h=Math.max(best.h,h);
  }
  return lines.map(l=>l.items.sort((a,b)=>a.bbox.x0-b.bbox.x0));
}
function unionBbox(items){
  return {
    x0:Math.min(...items.map(w=>w.bbox.x0)),
    y0:Math.min(...items.map(w=>w.bbox.y0)),
    x1:Math.max(...items.map(w=>w.bbox.x1)),
    y1:Math.max(...items.map(w=>w.bbox.y1))
  };
}
function overlapRatio(a,b){
  const x1=Math.max(a.x,b.x),y1=Math.max(a.y,b.y);
  const x2=Math.min(a.x+a.w,b.x+b.w),y2=Math.min(a.y+a.h,b.y+b.h);
  const inter=Math.max(0,x2-x1)*Math.max(0,y2-y1);
  const minArea=Math.max(1,Math.min(a.w*a.h,b.w*b.h));
  return inter/minArea;
}
function autoMaskRects(words,size){
  if(!words.length||!size)return[];
  const types=selectedDetectTypes();
  const found=[];
  for(const items of groupWordsIntoLines(words)){
    for(let i=0;i<items.length;i++){
      for(const type of types){
        let match=null;
        for(let n=1;n<=Math.min(6,items.length-i);n++){
          const chunk=items.slice(i,i+n);
          const spaced=chunk.map(x=>x.text).join(' ');
          const compact=chunk.map(x=>x.text).join('');
          if(looksSensitive(spaced,type)||looksSensitive(compact,type)){match=chunk;break}
        }
        if(match)found.push({type,b:unionBbox(match)});
      }
    }
  }
  const sx=e.cv.width/size.width,sy=e.cv.height/size.height;
  const candidates=found.map(f=>{
    const x=Math.max(0,f.b.x0*sx-4),y=Math.max(0,f.b.y0*sy-4);
    const x2=Math.min(e.cv.width,f.b.x1*sx+4),y2=Math.min(e.cv.height,f.b.y1*sy+4);
    return {id:maskSeq++,x,y,w:Math.max(1,x2-x),h:Math.max(1,y2-y),source:'auto',type:f.type};
  }).sort((a,b)=>a.w*a.h-b.w*b.h);
  const unique=[];
  for(const r of candidates){
    if(!unique.some(q=>q.type===r.type&&overlapRatio(q,r)>.65))unique.push(r);
  }
  return unique;
}
function refreshAutoMasks(){
  if(!lastOcrWords.length||!lastOcrSize)return 0;
  rects=rects.filter(r=>r.source!=='auto');
  const autos=autoMaskRects(lastOcrWords,lastOcrSize);
  rects.push(...autos);
  if(selectedId&&!rects.some(r=>r.id===selectedId)){selectedId=null;e.deleteMask.disabled=true}
  draw();
  return autos.length;
}

function median(values){
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return 0;
  const m=Math.floor(a.length/2);
  return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function isCjkChar(ch){
  return /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(ch||'');
}
function joinOcrTokens(items){
  let out='';
  for(const item of items){
    const t=String(item.text||'').trim();
    if(!t)continue;
    if(!out){out=t;continue}
    const prev=out.slice(-1),first=t[0];
    const noSpace=isCjkChar(prev)||isCjkChar(first)||/^[、。・，．,:;!?%％）】」』]/.test(t)||/[（【「『￥¥$]$/.test(out);
    out+=noSpace?t:' '+t;
  }
  return out.replace(/\s+/g,' ').trim();
}
function makeLayoutCells(line,imageWidth){
  const items=[...line].sort((a,b)=>a.bbox.x0-b.bbox.x0);
  if(!items.length)return[];
  const heights=items.map(w=>Math.max(1,w.bbox.y1-w.bbox.y0));
  const widths=items.map(w=>Math.max(1,w.bbox.x1-w.bbox.x0));
  const h=median(heights)||12;
  const charWidth=median(widths.map((w,i)=>w/Math.max(1,String(items[i].text||'').length)))||h*.65;
  // Column gaps are intentionally much larger than ordinary OCR token gaps.
  // Do not derive the threshold from the median gap: on sparse tables the
  // median itself can be a column gap and would collapse the whole row.
  const gapThreshold=Math.max(h*.78,charWidth*1.9,imageWidth*.007);
  const cells=[];
  let current=[items[0]];
  for(let i=1;i<items.length;i++){
    const gap=Math.max(0,items[i].bbox.x0-items[i-1].bbox.x1);
    if(gap>gapThreshold){
      cells.push({items:current,bbox:unionBbox(current),text:joinOcrTokens(current)});
      current=[items[i]];
    }else current.push(items[i]);
  }
  cells.push({items:current,bbox:unionBbox(current),text:joinOcrTokens(current)});
  return cells.filter(c=>c.text);
}
function clusterColumnAnchors(rows,imageWidth){
  const candidates=[];
  rows.forEach(row=>row.forEach(cell=>candidates.push(cell.bbox.x0)));
  candidates.sort((a,b)=>a-b);
  if(!candidates.length)return[];
  const tolerance=Math.max(16,imageWidth*.045);
  const clusters=[];
  for(const x of candidates){
    let best=null,bestD=Infinity;
    for(const c of clusters){
      const d=Math.abs(x-c.mean);
      if(d<=tolerance&&d<bestD){best=c;bestD=d}
    }
    if(best){
      best.values.push(x);
      best.mean=best.values.reduce((a,b)=>a+b,0)/best.values.length;
    }else clusters.push({mean:x,values:[x]});
  }
  return clusters
    .filter(c=>c.values.length>=2)
    .sort((a,b)=>a.mean-b.mean)
    .map(c=>c.mean)
    .slice(0,10);
}
function assignCellsToColumns(cells,anchors){
  const row=Array(anchors.length).fill('');
  for(const cell of cells){
    let best=0,bestD=Infinity;
    for(let i=0;i<anchors.length;i++){
      const d=Math.abs(cell.bbox.x0-anchors[i]);
      if(d<bestD){bestD=d;best=i}
    }
    row[best]=row[best]?row[best]+' '+cell.text:cell.text;
  }
  return row.map(x=>x.trim());
}
function escapeMarkdownCell(text){
  return String(text||'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ').trim();
}
function looksLikeNumericCell(text){
  const s=String(text||'').replace(/[\s,，円￥¥%％]/g,'');
  return !!s&&/^[+\-]?\d+(?:\.\d+)?$/.test(s);
}
function headerLooksData(row){
  if(!row.length)return true;
  const nonEmpty=row.filter(Boolean);
  if(!nonEmpty.length)return true;
  return nonEmpty.filter(looksLikeNumericCell).length/nonEmpty.length>=.6;
}
function rowsToMarkdown(rows){
  if(!rows.length)return'';
  let header=rows[0].map(escapeMarkdownCell);
  let body=rows.slice(1).map(r=>r.map(escapeMarkdownCell));
  if(headerLooksData(header)){
    body=[header,...body];
    header=header.map((_,i)=>'列'+(i+1));
  }
  const sep=header.map((_,i)=>{
    const vals=body.map(r=>r[i]).filter(Boolean);
    return vals.length&&vals.filter(looksLikeNumericCell).length/vals.length>=.65?'---:':'---';
  });
  return [
    '| '+header.join(' | ')+' |',
    '| '+sep.join(' | ')+' |',
    ...body.map(r=>'| '+r.join(' | ')+' |')
  ].join('\n');
}
function buildMonospaceLayout(lines,imageWidth){
  const widthChars=54;
  const rendered=[];
  for(const line of lines){
    if(!line.length)continue;
    const items=[...line].sort((a,b)=>a.bbox.x0-b.bbox.x0);
    let cursor=0,out='';
    for(const w of items){
      const target=Math.max(cursor,Math.round((w.bbox.x0/imageWidth)*widthChars));
      if(target>cursor)out+=' '.repeat(Math.min(20,target-cursor));
      const t=String(w.text||'').trim();
      out+=t;
      cursor=target+Math.max(1,t.length);
    }
    if(out.trim())rendered.push(out.replace(/\s+$/,''));
  }
  return rendered.join('\n');
}
function buildLayoutResult(words,size){
  if(!words.length||!size)return{type:'plain',text:lastPlainText||'',rows:0,cols:0,score:0};
  const lines=groupWordsIntoLines(words).filter(l=>l.length);
  const cellRows=lines.map(line=>makeLayoutCells(line,size.width)).filter(r=>r.length);
  const multiRows=cellRows.filter(r=>r.length>=2);
  const anchors=clusterColumnAnchors(multiRows,size.width);
  let tableRows=[];
  if(anchors.length>=2){
    tableRows=cellRows.map(r=>assignCellsToColumns(r,anchors));
    const useful=tableRows.filter(r=>r.filter(Boolean).length>=2);
    const consistency=useful.length/Math.max(1,tableRows.length);
    const density=useful.reduce((a,r)=>a+r.filter(Boolean).length,0)/Math.max(1,useful.length*anchors.length);
    const score=Math.min(1,consistency*.62+density*.38);
    if(useful.length>=2&&score>=.48){
      return{
        type:'table',
        text:rowsToMarkdown(useful),
        rows:useful.length,
        cols:anchors.length,
        score
      };
    }
  }
  return{
    type:'layout',
    text:buildMonospaceLayout(lines,size.width),
    rows:lines.length,
    cols:0,
    score:0
  };
}

function clamp(v,min,max){return Math.max(min,Math.min(max,v))}
function percentileSorted(a,p){
  if(!a.length)return 0;
  const i=clamp(Math.floor((a.length-1)*p),0,a.length-1);
  return a[i];
}
function makeTableDetectionCanvas(){
  const maxSide=1200,scale=Math.min(1,maxSide/Math.max(base.naturalWidth,base.naturalHeight));
  const c=document.createElement('canvas');
  c.width=Math.max(1,Math.round(base.naturalWidth*scale));
  c.height=Math.max(1,Math.round(base.naturalHeight*scale));
  c.getContext('2d').drawImage(base,0,0,c.width,c.height);
  return c;
}
function detectTableGrid(){
  if(!base)return null;
  const c=makeTableDetectionCanvas(),w=c.width,h=c.height;
  if(w<180||h<180)return null;
  const raw=c.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
  const gray=new Float32Array(w*h);
  for(let i=0,j=0;i<raw.length;i+=4,j++)gray[j]=raw[i]*.299+raw[i+1]*.587+raw[i+2]*.114;

  const bands=[];
  for(let y=8;y<h-8;y++){
    let contrastHits=0,samples=0;
    for(let x=0;x<w;x+=2){
      const v=gray[y*w+x],near=(gray[(y-7)*w+x]+gray[(y+7)*w+x])*.5;
      if(near-v>18)contrastHits++;
      samples++;
    }
    const score=contrastHits/Math.max(1,samples);
    if(score<.12)continue;
    const xs=[];
    for(let x=0;x<w;x++){
      let dark=false;
      for(let yy=Math.max(0,y-3);yy<=Math.min(h-1,y+3);yy++){
        if(gray[yy*w+x]<110){dark=true;break}
      }
      if(dark)xs.push(x);
    }
    if(xs.length<10)continue;
    const lo=percentileSorted(xs,.01),hi=percentileSorted(xs,.99);
    bands.push({y,score,span:(hi-lo)/w,lo,hi});
  }
  if(bands.length<4)return null;

  const grouped=[];
  for(const b of bands){
    const g=grouped[grouped.length-1];
    if(!g||b.y>g[g.length-1].y+1)grouped.push([b]);else g.push(b);
  }
  let peaks=grouped.map(g=>g.reduce((a,b)=>b.score>a.score?b:a));
  const maxScore=Math.max(...peaks.map(p=>p.score)),maxSpan=Math.max(...peaks.map(p=>p.span));
  peaks=peaks.filter(p=>p.score>=Math.max(.16,maxScore*.34)&&p.span>=Math.max(.30,maxSpan*.65));
  if(peaks.length<4)return null;

  const merged=[];
  for(const p of peaks){
    const prev=merged[merged.length-1];
    if(prev&&p.y-prev.y<=12){
      if(p.score>prev.score)merged[merged.length-1]=p;
    }else merged.push(p);
  }
  const maxGap=Math.max(90,h*.10),seqs=[];
  let cur=[];
  for(const p of merged){
    if(!cur){cur=[p];continue}
    const gap=p.y-cur[cur.length-1].y;
    if(gap>=12&&gap<=maxGap)cur.push(p);
    else{if(cur.length)seqs.push(cur);cur=[p]}
  }
  if(cur.length)seqs.push(cur);
  const seq=seqs.sort((a,b)=>b.length-a.length)[0];
  if(!seq||seq.length<4)return null;

  const lows=seq.map(p=>p.lo).sort((a,b)=>a-b),highs=seq.map(p=>p.hi).sort((a,b)=>a-b);
  let xStart=percentileSorted(lows,.5),xEnd=percentileSorted(highs,.5);
  if(xEnd-xStart<w*.25)return null;
  const yStart=seq[0].y,yEnd=seq[seq.length-1].y;
  if(yEnd-yStart<h*.12)return null;

  const scores=new Float32Array(w);
  let maxV=0;
  for(let x=Math.max(8,xStart);x<=Math.min(w-9,xEnd);x++){
    let hits=0,total=0;
    for(let y=yStart;y<=yEnd;y++){
      const v=gray[y*w+x],near=(gray[y*w+x-7]+gray[y*w+x+7])*.5;
      if(near-v>18)hits++;
      total++;
    }
    scores[x]=hits/Math.max(1,total);
    if(scores[x]>maxV)maxV=scores[x];
  }
  const threshold=Math.max(.12,maxV*.18),runs=[];
  let run=[];
  for(let x=xStart+1;x<xEnd;x++){
    if(scores[x]>threshold)run.push(x);
    else if(run.length){runs.push(run);run=[]}
  }
  if(run.length)runs.push(run);

  let internals=runs.map(g=>{
    let peak=g[0];
    for(const x of g)if(scores[x]>scores[peak])peak=x;
    return{x:peak,score:scores[peak],width:g.length,prom:scores[peak]*Math.sqrt(g.length)};
  }).filter(p=>p.x>xStart+20&&p.x<xEnd-20);

  const mergedX=[];
  const mergeDistance=Math.max(12,w*.02);
  for(const p of internals.sort((a,b)=>a.x-b.x)){
    const prev=mergedX[mergedX.length-1];
    if(prev&&p.x-prev.x<mergeDistance){
      if(p.prom>prev.prom)mergedX[mergedX.length-1]=p;
    }else mergedX.push(p);
  }
  internals=mergedX;
  if(internals.length>8){
    internals=[...internals].sort((a,b)=>b.prom-a.prom).slice(0,8).sort((a,b)=>a.x-b.x);
  }
  const minCol=Math.max(22,w*.025),xLines=[xStart];
  for(const p of internals){
    if(p.x-xLines[xLines.length-1]>=minCol&&xEnd-p.x>=minCol)xLines.push(p.x);
  }
  xLines.push(xEnd);
  if(xLines.length<3)return null;

  const sx=base.naturalWidth/w,sy=base.naturalHeight/h;
  return{
    xLines:xLines.map(x=>Math.round(x*sx)),
    yLines:seq.map(p=>Math.round(p.y*sy)),
    detection:{width:w,height:h,rows:seq.length-1,cols:xLines.length-1}
  };
}
function normalizeCellCanvas(c){
  const x=c.getContext('2d',{willReadFrequently:true}),im=x.getImageData(0,0,c.width,c.height),d=im.data;
  let sum=0,n=0;
  for(let i=0;i<d.length;i+=4){sum+=d[i]*.299+d[i+1]*.587+d[i+2]*.114;n++}
  const mean=sum/Math.max(1,n);
  for(let i=0;i<d.length;i+=4){
    const g=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
    let v=255-Math.max(0,mean-g)*3.15;
    if(v>228)v=255;
    if(v<55)v=0;
    v=clamp(Math.round(v),0,255);
    d[i]=d[i+1]=d[i+2]=v;d[i+3]=255;
  }
  x.putImageData(im,0,0);
}
function buildCellSheet(grid){
  const xs=grid.xLines,ys=grid.yLines,cols=xs.length-1,rows=ys.length-1;
  if(cols<2||rows<2)return null;
  const rowSizes=[];
  for(let r=0;r<rows;r++)rowSizes.push(Math.max(1,ys[r+1]-ys[r]));
  const medRow=median(rowSizes)||40;
  let scale=clamp(76/medRow,1.45,2.45);
  const rawWidth=xs[xs.length-1]-xs[0];
  const gapX=18,gapY=14,pad=18;
  const estimated=rawWidth*scale+(cols-1)*gapX+pad*2;
  if(estimated>2600)scale*=2600/estimated;

  const colWidths=[];
  for(let c=0;c<cols;c++)colWidths.push(Math.max(24,Math.round((xs[c+1]-xs[c]-12)*scale)));
  const rowHeights=[];
  for(let r=0;r<rows;r++)rowHeights.push(Math.max(28,Math.round((ys[r+1]-ys[r]-10)*scale)));
  const width=colWidths.reduce((a,b)=>a+b,0)+(cols-1)*gapX+pad*2;
  const height=rowHeights.reduce((a,b)=>a+b,0)+(rows-1)*gapY+pad*2;
  if(width<80||height<80||width*height>9000000)return null;

  const sheet=document.createElement('canvas');sheet.width=width;sheet.height=height;
  const sctx=sheet.getContext('2d');sctx.fillStyle='#fff';sctx.fillRect(0,0,width,height);
  const cells=[];
  let dy=pad;
  for(let r=0;r<rows;r++){
    let dx=pad;
    for(let c=0;c<cols;c++){
      const marginX=Math.min(10,Math.max(5,Math.round((xs[c+1]-xs[c])*.018)));
      const marginY=Math.min(8,Math.max(4,Math.round((ys[r+1]-ys[r])*.12)));
      const sx=xs[c]+marginX,sy=ys[r]+marginY;
      const sw=Math.max(2,xs[c+1]-xs[c]-marginX*2),sh=Math.max(2,ys[r+1]-ys[r]-marginY*2);
      const dw=colWidths[c],dh=rowHeights[r];
      const tmp=document.createElement('canvas');tmp.width=dw;tmp.height=dh;
      const tx=tmp.getContext('2d');tx.fillStyle='#fff';tx.fillRect(0,0,dw,dh);
      tx.drawImage(base,sx,sy,sw,sh,0,0,dw,dh);
      normalizeCellCanvas(tmp);
      sctx.drawImage(tmp,dx,dy);
      cells.push({row:r,col:c,x0:dx,y0:dy,x1:dx+dw,y1:dy+dh});
      dx+=dw+gapX;
    }
    dy+=rowHeights[r]+gapY;
  }
  return{url:sheet.toDataURL('image/png'),cells,rows,cols,width,height};
}
function normalizeCellText(text){
  let t=String(text||'').replace(/\s+/g,' ').trim();
  t=t.replace(/([0-9][0-9,]*)\s*[FＦ][39９]?$/,'$1円');
  return t;
}
function tableRowsFromSheetWords(words,sheet){
  const buckets=Array.from({length:sheet.rows},()=>Array.from({length:sheet.cols},()=>[]));
  for(const w of words){
    if(!w.bbox)continue;
    const cx=(w.bbox.x0+w.bbox.x1)/2,cy=(w.bbox.y0+w.bbox.y1)/2;
    const cell=sheet.cells.find(c=>cx>=c.x0&&cx<=c.x1&&cy>=c.y0&&cy<=c.y1);
    if(cell)buckets[cell.row][cell.col].push(w);
  }
  const rows=buckets.map(row=>row.map(items=>{
    if(!items.length)return'';
    const lines=groupWordsIntoLines(items);
    return normalizeCellText(lines.map(line=>joinOcrTokens(line)).join(' '));
  }));
  const nonEmpty=rows.filter(r=>r.some(Boolean));
  if(!nonEmpty.length)return[];
  const keep=[];
  for(let c=0;c<sheet.cols;c++)if(nonEmpty.some(r=>r[c]))keep.push(c);
  return nonEmpty.map(r=>keep.map(c=>r[c]||''));
}
async function recognizeGridTable(w){
  const grid=detectTableGrid();
  if(!grid)return null;
  const sheet=buildCellSheet(grid);
  if(!sheet)return null;
  e.ocrSt.textContent='表の罫線を検出しました。セル内容を再OCRしています…';
  let result=null;
  try{
    await w.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1'});
    const rr=await w.recognize(sheet.url,{}, {text:true,blocks:true,tsv:true});
    const words=extractOcrWords(rr?.data||{}),rows=tableRowsFromSheetWords(words,sheet);
    if(rows.length>=2&&rows[0].length>=2){
      const table=rowsToMarkdown(rows),conf=Math.round(rr?.data?.confidence||0);
      result={
        type:'cell-table',
        rows:rows.length,
        cols:rows[0].length,
        gridRows:grid.detection.rows,
        gridCols:grid.detection.cols,
        confidence:conf,
        tableText:table,
        text:(lastPlainText?lastPlainText.trim()+'\n\n':'')+'【表（セル再OCR）】\n'+table
      };
    }
  }finally{
    await w.setParameters({tessedit_pageseg_mode:'3',preserve_interword_spaces:'1'});
  }
  return result;
}

function applyOcrOutput(){
  if(!lastPlainText&&!lastLayoutResult&&!lastTableResult)return;
  if(ocrOutputMode==='layout'){
    if(lastTableResult){
      e.src.value=lastTableResult.text||lastPlainText;
      e.layoutSummary.textContent='罫線から表を検出：'+lastTableResult.gridRows+'行 × '+lastTableResult.gridCols+'列。罫線を除いたセルを再OCRし、認識できた'+lastTableResult.rows+'行 × '+lastTableResult.cols+'列をMarkdown表に再構成しました（セルOCR信頼度 '+lastTableResult.confidence+'%）。';
    }else if(lastLayoutResult){
      e.src.value=lastLayoutResult.text||lastPlainText;
      if(lastLayoutResult.type==='table'){
        const pct=Math.round((lastLayoutResult.score||0)*100);
        e.layoutSummary.textContent='罫線表は検出できなかったため、文字座標から表を推定：'+lastLayoutResult.rows+'行 × '+lastLayoutResult.cols+'列（構造判定 '+pct+'%）。';
      }else{
        e.layoutSummary.textContent='罫線表は検出できなかったため、文字の横位置を残したレイアウト保持テキストで出力しています。';
      }
    }else e.src.value=lastPlainText;
    e.layoutSummary.classList.remove('is-hidden');
  }else{
    e.src.value=lastPlainText;
    e.layoutSummary.classList.add('is-hidden');
  }
  snapshot=e.src.value;
}
function setOcrOutputMode(mode){
  ocrOutputMode=mode==='layout'?'layout':'plain';
  e.plainOcrMode.classList.toggle('is-active',ocrOutputMode==='plain');
  e.layoutOcrMode.classList.toggle('is-active',ocrOutputMode==='layout');
  e.layoutHint.textContent=ocrOutputMode==='layout'
    ?'帳票・表：罫線を検出できればセルごとに切り分けて追加OCRします。すでに通常OCRだけ実行済みの場合は、もう一度「OCRを実行」してください。'
    :'通常OCR：文章として読みやすいテキストを出力します。';
  applyOcrOutput();
}
e.plainOcrMode.onclick=()=>setOcrOutputMode('plain');
e.layoutOcrMode.onclick=()=>setOcrOutputMode('layout');

function maskText(t){
  const keys=selectedDetectTypes(),counts={};
  for(const k of ['url','email','postcode','phone','number'])if(keys.includes(k)){
    let n=0;
    t=t.replace(rules[k].r,()=>{n++;return rules[k].l});
    counts[k]=n;
  }
  return{t,counts};
}
e.mask.onclick=()=>{if(!e.src.value.trim())return toast('まず文章を入力してください。',true);snapshot=e.src.value;const x=maskText(e.src.value);e.out.value=x.t;const autoCount=refreshAutoMasks();const nm={email:'メール',phone:'電話番号',postcode:'郵便番号',url:'URL',number:'長い数字列'},parts=Object.entries(x.counts).filter(([,n])=>n).map(([k,n])=>`${nm[k]} ${n}件`),total=Object.values(x.counts).reduce((a,b)=>a+b,0);e.sum.innerHTML=total?`<strong>${total}件をマスクしました。</strong><span>${parts.join(' / ')}。画像側の自動マスク ${autoCount}件。人名・住所・会社名は必要に応じて手動編集してください。</span>`:'<strong>対象は見つかりませんでした。</strong><span>人名・住所・会社名などは手動で編集してください。</span>'};e.restore.onclick=()=>{if(!snapshot)return toast('戻せる元テキストがありません。',true);e.src.value=snapshot;e.out.value=''};
e.copy.onclick=async()=>{const t=(e.out.value||e.src.value).trim();if(!t)return toast('コピーする文章がありません。',true);try{await navigator.clipboard.writeText(t);toast('✓ AI用テキストをコピーしました。')}catch{const x=e.out.value?e.out:e.src;x.focus();x.select();toast(document.execCommand('copy')?'✓ AI用テキストをコピーしました。':'コピーできませんでした。',true)}};
function finalizeDraft(){
  if(draft&&draft.w>4&&draft.h>4){
    rects.push({id:maskSeq++,x:draft.x,y:draft.y,w:draft.w,h:draft.h,source:'manual',type:'manual'});
    draft=null;drag=false;
  }
  draw(false,false);
}
function canvasToBlob(canvas){
  return new Promise(resolve=>{
    try{
      const url=canvas.toDataURL('image/png');
      const parts=url.split(','),bin=atob(parts[1]),arr=new Uint8Array(bin.length);
      for(let i=0;i<bin.length;i++)arr[i]=bin.charCodeAt(i);
      resolve(new Blob([arr],{type:'image/png'}));
    }catch(err){console.error(err);resolve(null)}
  });
}
async function buildExportPreview(){
  if(!base)return null;
  finalizeDraft();

  // Export exactly what is visible on the edit canvas.
  // This avoids any coordinate mismatch between the preview and the saved file.
  const out=document.createElement('canvas');
  out.width=e.cv.width;
  out.height=e.cv.height;
  const ox=out.getContext('2d');
  ox.drawImage(e.cv,0,0);
  draw(false,true);

  exportBlob=await canvasToBlob(out);
  if(!exportBlob)return null;

  const old=e.preview.dataset.url;
  if(old)URL.revokeObjectURL(old);
  const url=URL.createObjectURL(exportBlob);
  e.preview.src=url;
  e.preview.dataset.url=url;
  e.previewWrap.classList.remove('is-hidden');
  e.previewWrap.scrollIntoView({behavior:'smooth',block:'nearest'});
  return exportBlob;
}
e.save.onclick=async()=>{
  const b=await buildExportPreview();
  if(!b)return toast('画像の書き出しに失敗しました。',true);
  toast('保存プレビューを作成しました。黒塗りを確認してください。');
};
e.sharePreview.onclick=async()=>{
  if(!exportBlob)return toast('先に保存プレビューを作成してください。',true);
  const f=new File([exportBlob],`mask-${new Date().toISOString().slice(0,10)}.png`,{type:'image/png'});
  try{
    if(navigator.canShare?.({files:[f]})&&navigator.share){
      await navigator.share({files:[f],title:'MASK 黒塗り済み画像'});
      return;
    }
  }catch(x){
    if(x.name==='AbortError')return;
    console.error(x);
  }
  const u=URL.createObjectURL(exportBlob),a=document.createElement('a');
  a.href=u;a.download=f.name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(u),1500);
};
function makeOcrImage(){if(!base)return{url:dataUrl,width:e.cv.width,height:e.cv.height};const maxSide=3200,scale=Math.min(1,maxSide/Math.max(base.naturalWidth,base.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(base.naturalWidth*scale));c.height=Math.max(1,Math.round(base.naturalHeight*scale));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(base,0,0,c.width,c.height);const im=x.getImageData(0,0,c.width,c.height),d=im.data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=(d[i]*.299+d[i+1]*.587+d[i+2]*.114);const mean=sum/(d.length/4),invert=mean<105;for(let i=0;i<d.length;i+=4){let v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;if(invert)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.45+128));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return{url:c.toDataURL('image/png'),width:c.width,height:c.height}}
e.ocr.onclick=async()=>{
  if(!base||!dataUrl)return;
  if(!ready)return toast('先にオフライン準備を完了してください。',true);
  e.ocr.disabled=true;
  try{
    e.ocrSt.textContent='OCR用に画像を補正しています…';
    const input=makeOcrImage();
    const w=await getWorker(m=>{
      if(m?.status)e.ocrSt.textContent='高精度OCR処理中… '+(typeof m.progress==='number'?Math.round(m.progress*100)+'%':'');
    });
    const r=await w.recognize(input.url,{}, {text:true,blocks:true,tsv:true});
    const t=r?.data?.text?.trim()||'',conf=Math.round(r?.data?.confidence||0);
    lastOcrWords=extractOcrWords(r?.data||{});
    lastOcrSize={width:input.width,height:input.height};
    lastPlainText=t;
    lastLayoutResult=buildLayoutResult(lastOcrWords,lastOcrSize);
    lastTableResult=null;
    if(ocrOutputMode==='layout'){
      try{lastTableResult=await recognizeGridTable(w)}catch(tableErr){console.warn('table OCR failed',tableErr);lastTableResult=null}
    }
    applyOcrOutput();
    const autoCount=refreshAutoMasks();
    const layoutInfo=lastTableResult
      ?' / セル表 '+lastTableResult.rows+'×'+lastTableResult.cols
      :(lastLayoutResult?.type==='table'?' / 推定表 '+lastLayoutResult.rows+'×'+lastLayoutResult.cols:(lastLayoutResult?.type==='layout'?' / レイアウト保持可':''));
    e.ocrSt.textContent=t?'✓ 読み取り完了（信頼度 '+conf+'% / 自動マスク '+autoCount+'件'+layoutInfo+'）':'文字を検出できませんでした。';
  }catch(x){
    console.error(x);
    worker=null;
    e.ocrSt.textContent='OCRに失敗しました。オフライン準備をやり直してください。';
  }finally{e.ocr.disabled=!ready}
};
$$('input[name="detect"]').forEach(i=>i.addEventListener('change',()=>{if(lastOcrWords.length)refreshAutoMasks()}));
setOcrOutputMode('plain');
mode('image');setReady(false);initSW();
