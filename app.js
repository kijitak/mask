'use strict';
const $=id=>document.getElementById(id), $$=s=>[...document.querySelectorAll(s)];
const e={imgIn:$('imageInput'),ws:$('imageWorkspace'),cv:$('imageCanvas'),ocr:$('ocrBtn'),ocrSt:$('ocrStatus'),src:$('sourceText'),out:$('maskedText'),mask:$('maskBtn'),restore:$('restoreTextBtn'),sum:$('detectSummary'),save:$('saveImageBtn'),copy:$('copyTextBtn'),toast:$('toast'),prep:$('prepareOfflineBtn'),help:$('installHelpBtn'),guide:$('installGuide'),net:$('networkChip'),off:$('offlineChip'),msg:$('offlineMessage'),prog:$('offlineProgress'),bar:$('offlineProgressBar'),progTxt:$('offlineProgressText'),imgMode:$('imageMode'),txtMode:$('textMode'),maskStep:$('maskStepLabel'),outStep:$('outputStepLabel'),undo:$('undoMaskBtn'),clear:$('clearMaskBtn'),previewWrap:$('exportPreviewWrap'),preview:$('exportPreview'),sharePreview:$('sharePreviewBtn'),wrap:$('canvasWrap'),drawMode:$('drawModeBtn'),selectMode:$('selectModeBtn'),deleteMask:$('deleteMaskBtn'),toolNote:$('toolNote')};
const ctx=e.cv.getContext('2d'); let base=null,dataUrl='',rects=[],draft=null,drag=false,snapshot='',ready=false,worker=null,reg=null,loadPromise=null,exportBlob=null,editMode='draw',selectedId=null,zoom=100,lastOcrWords=[],lastOcrSize=null,selectStart=null,maskSeq=1;
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
function loadImage(f){if(!f)return;if(!/^image\/(png|jpeg|webp)$/.test(f.type))return toast('PNG / JPG / WebP を選択してください。',true);const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{base=img;dataUrl=String(r.result);rects=[];selectedId=null;lastOcrWords=[];lastOcrSize=null;fit(img);setZoom(100);setEditMode('draw');draw();e.ws.classList.remove('is-hidden');e.save.disabled=false;e.ocr.disabled=!ready;e.ocrSt.textContent=ready?'OCRを実行できます。':'先にオフライン準備を完了してください。'};img.src=String(r.result)};r.readAsDataURL(f)} e.imgIn.onchange=x=>loadImage(x.target.files?.[0]);
function pt(ev){const r=e.cv.getBoundingClientRect();return{x:(ev.clientX-r.left)*e.cv.width/r.width,y:(ev.clientY-r.top)*e.cv.height/r.height}}
function setZoom(v){
  zoom=Number(v)||100;
  e.cv.style.width=zoom+'%';
  $('.zoom-btn').forEach(b=>b.classList.toggle('is-active',Number(b.dataset.zoom)===zoom));
}
$('.zoom-btn').forEach(b=>b.onclick=()=>setZoom(b.dataset.zoom));
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
  draft.x=Math.min(draft.sx,p.x);draft.y=Math.min(draft.sy,p.y);
  draft.w=Math.abs(p.x-draft.sx);draft.h=Math.abs(p.y-draft.sy);
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
  draft=null;draw();
}
e.cv.onpointerup=end;e.cv.onpointercancel=end;
e.deleteMask.onclick=()=>{
  if(!selectedId)return;
  rects=rects.filter(r=>r.id!==selectedId);
  selectedId=null;e.deleteMask.disabled=true;draw();
};
e.undo.onclick=()=>{
  if(!rects.length)return;
  const removed=rects.pop();
  if(removed&&removed.id===selectedId){selectedId=null;e.deleteMask.disabled=true}
  draw();
};
e.clear.onclick=()=>{rects=[];selectedId=null;e.deleteMask.disabled=true;draw()};
function selectedDetectTypes(){return $('input[name="detect"]:checked').map(i=>i.value)}
function plainRegex(rule){
  return new RegExp('^(?:'+rule.r.source+')
e.mask.onclick=()=>{if(!e.src.value.trim())return toast('まず文章を入力してください。',true);snapshot=e.src.value;const x=maskText(e.src.value);e.out.value=x.t;const autoCount=refreshAutoMasks();const nm={email:'メール',phone:'電話番号',postcode:'郵便番号',url:'URL',number:'長い数字列'},parts=Object.entries(x.counts).filter(([,n])=>n).map(([k,n])=>`${nm[k]} ${n}件`),total=Object.values(x.counts).reduce((a,b)=>a+b,0);e.sum.innerHTML=total?`<strong>${total}件をマスクしました。</strong><span>${parts.join(' / ')}。画像側の自動マスク ${autoCount}件。人名・住所・会社名は必要に応じて手動編集してください。</span>`:'<strong>対象は見つかりませんでした。</strong><span>人名・住所・会社名などは手動で編集してください。</span>'};e.restore.onclick=()=>{if(!snapshot)return toast('戻せる元テキストがありません。',true);e.src.value=snapshot;e.out.value=''};
e.copy.onclick=async()=>{const t=(e.out.value||e.src.value).trim();if(!t)return toast('コピーする文章がありません。',true);try{await navigator.clipboard.writeText(t);toast('✓ AI用テキストをコピーしました。')}catch{const x=e.out.value?e.out:e.src;x.focus();x.select();toast(document.execCommand('copy')?'✓ AI用テキストをコピーしました。':'コピーできませんでした。',true)}};
function finalizeDraft(){
  if(draft&&draft.w>4&&draft.h>4){
    rects.push({x:draft.x,y:draft.y,w:draft.w,h:draft.h});
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
e.ocr.onclick=async()=>{if(!base||!dataUrl)return;if(!ready)return toast('先にオフライン準備を完了してください。',true);e.ocr.disabled=true;try{e.ocrSt.textContent='OCR用に画像を補正しています…';const input=makeOcrImage();const w=await getWorker(m=>{if(m?.status)e.ocrSt.textContent=`高精度OCR処理中… ${typeof m.progress==='number'?Math.round(m.progress*100)+'%':''}`});const r=await w.recognize(input.url,{}, {text:true,blocks:true,tsv:true}),t=r?.data?.text?.trim()||'',conf=Math.round(r?.data?.confidence||0);lastOcrWords=extractOcrWords(r?.data||{});lastOcrSize={width:input.width,height:input.height};e.src.value=t;snapshot=t;const autoCount=refreshAutoMasks();e.ocrSt.textContent=t?`✓ 読み取り完了（信頼度 ${conf}% / 自動マスク ${autoCount}件）`:'文字を検出できませんでした。'}catch(x){console.error(x);worker=null;e.ocrSt.textContent='OCRに失敗しました。オフライン準備をやり直してください。'}finally{e.ocr.disabled=!ready}};
mode('image');setReady(false);initSW();
,rule.r.flags.replace(/g/g,'').replace(/y/g,''));
}
function looksSensitive(text,type){
  const s=String(text||'').trim();
  if(!s)return false;
  const re=plainRegex(rules[type]);
  return re.test(s)||re.test(s.replace(/\s+/g,''));
}
function extractOcrWords(data){
  if(Array.isArray(data?.words)&&data.words.length){
    return data.words.map((w,i)=>({text:w.text||'',bbox:w.bbox,lineKey:w.line_num??w.line?.id??i}));
  }
  const words=[];
  const walk=obj=>{
    if(!obj)return;
    if(Array.isArray(obj)){obj.forEach(walk);return}
    if(obj.text&&obj.bbox&&typeof obj.bbox.x0==='number'&&!obj.words)words.push({text:obj.text,bbox:obj.bbox,lineKey:obj.line_num??obj.line?.id??0});
    ['blocks','paragraphs','lines','words'].forEach(k=>{if(obj[k])walk(obj[k])});
  };
  walk(data?.blocks);
  if(words.length)return words;
  if(typeof data?.tsv==='string'){
    const lines=data.tsv.trim().split(/\r?\n/).slice(1);
    for(const row of lines){
      const c=row.split('\t');
      if(c.length<12||c[0]!=='5')continue;
      const left=+c[6],top=+c[7],w=+c[8],h=+c[9],text=c.slice(11).join('\t');
      if(text.trim())words.push({text,bbox:{x0:left,y0:top,x1:left+w,y1:top+h},lineKey:[c[1],c[2],c[3],c[4]].join('-')});
    }
  }
  return words;
}
function unionBbox(items){
  return {x0:Math.min(...items.map(w=>w.bbox.x0)),y0:Math.min(...items.map(w=>w.bbox.y0)),x1:Math.max(...items.map(w=>w.bbox.x1)),y1:Math.max(...items.map(w=>w.bbox.y1))};
}
function autoMaskRects(words,size){
  if(!words.length||!size)return[];
  const types=selectedDetectTypes(),groups=new Map();
  words.filter(w=>w.bbox&&w.text?.trim()).forEach((w,i)=>{
    const k=String(w.lineKey??i);
    if(!groups.has(k))groups.set(k,[]);
    groups.get(k).push(w);
  });
  const found=[];
  for(const items0 of groups.values()){
    const items=[...items0].sort((a,b)=>a.bbox.x0-b.bbox.x0);
    for(let i=0;i<items.length;i++){
      for(const type of types){
        let matched=null;
        for(let n=1;n<=Math.min(6,items.length-i);n++){
          const chunk=items.slice(i,i+n);
          const spaced=chunk.map(x=>x.text).join(' ');
          const compact=chunk.map(x=>x.text).join('');
          if(looksSensitive(spaced,type)||looksSensitive(compact,type)){matched=chunk;break}
        }
        if(matched){
          const b=unionBbox(matched);
          found.push({type,b});
        }
      }
    }
  }
  const sx=e.cv.width/size.width,sy=e.cv.height/size.height;
  const unique=[];
  for(const f of found){
    const r={id:maskSeq++,x:Math.max(0,f.b.x0*sx-3),y:Math.max(0,f.b.y0*sy-3),w:Math.min(e.cv.width,(f.b.x1-f.b.x0)*sx+6),h:Math.min(e.cv.height,(f.b.y1-f.b.y0)*sy+6),source:'auto',type:f.type};
    const dup=unique.some(q=>q.type===r.type&&Math.abs(q.x-r.x)<8&&Math.abs(q.y-r.y)<8&&Math.abs(q.w-r.w)<16);
    if(!dup)unique.push(r);
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
function maskText(t){const keys=selectedDetectTypes(),counts={};for(const k of ['url','email','postcode','phone','number'])if(keys.includes(k)){let n=0;t=t.replace(rules[k].r,()=>{n++;return rules[k].l});counts[k]=n}return{t,counts}}
e.mask.onclick=()=>{if(!e.src.value.trim())return toast('まず文章を入力してください。',true);snapshot=e.src.value;const x=maskText(e.src.value);e.out.value=x.t;const nm={email:'メール',phone:'電話番号',postcode:'郵便番号',url:'URL',number:'長い数字列'},parts=Object.entries(x.counts).filter(([,n])=>n).map(([k,n])=>`${nm[k]} ${n}件`),total=Object.values(x.counts).reduce((a,b)=>a+b,0);e.sum.innerHTML=total?`<strong>${total}件をマスクしました。</strong><span>${parts.join(' / ')}。人名・住所・会社名は必要に応じて手動編集してください。</span>`:'<strong>対象は見つかりませんでした。</strong><span>人名・住所・会社名などは手動で編集してください。</span>'};e.restore.onclick=()=>{if(!snapshot)return toast('戻せる元テキストがありません。',true);e.src.value=snapshot;e.out.value=''};
e.copy.onclick=async()=>{const t=(e.out.value||e.src.value).trim();if(!t)return toast('コピーする文章がありません。',true);try{await navigator.clipboard.writeText(t);toast('✓ AI用テキストをコピーしました。')}catch{const x=e.out.value?e.out:e.src;x.focus();x.select();toast(document.execCommand('copy')?'✓ AI用テキストをコピーしました。':'コピーできませんでした。',true)}};
function finalizeDraft(){
  if(draft&&draft.w>4&&draft.h>4){
    rects.push({x:draft.x,y:draft.y,w:draft.w,h:draft.h});
    draft=null;drag=false;
  }
  draw(false);
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
function makeOcrImage(){if(!base)return dataUrl;const maxSide=3200,scale=Math.min(1,maxSide/Math.max(base.naturalWidth,base.naturalHeight));const c=document.createElement('canvas');c.width=Math.max(1,Math.round(base.naturalWidth*scale));c.height=Math.max(1,Math.round(base.naturalHeight*scale));const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(base,0,0,c.width,c.height);const im=x.getImageData(0,0,c.width,c.height),d=im.data;let sum=0;for(let i=0;i<d.length;i+=4)sum+=(d[i]*.299+d[i+1]*.587+d[i+2]*.114);const mean=sum/(d.length/4),invert=mean<105;for(let i=0;i<d.length;i+=4){let v=d[i]*.299+d[i+1]*.587+d[i+2]*.114;if(invert)v=255-v;v=Math.max(0,Math.min(255,(v-128)*1.45+128));d[i]=d[i+1]=d[i+2]=v}x.putImageData(im,0,0);return c.toDataURL('image/png')}
e.ocr.onclick=async()=>{if(!base||!dataUrl)return;if(!ready)return toast('先にオフライン準備を完了してください。',true);e.ocr.disabled=true;try{e.ocrSt.textContent='OCR用に画像を補正しています…';const input=makeOcrImage();const w=await getWorker(m=>{if(m?.status)e.ocrSt.textContent=`高精度OCR処理中… ${typeof m.progress==='number'?Math.round(m.progress*100)+'%':''}`});const r=await w.recognize(input),t=r?.data?.text?.trim()||'',conf=Math.round(r?.data?.confidence||0);e.src.value=t;snapshot=t;e.ocrSt.textContent=t?`✓ 文字を読み取りました（認識信頼度 ${conf}%）`:'文字を検出できませんでした。'}catch(x){console.error(x);worker=null;e.ocrSt.textContent='OCRに失敗しました。オフライン準備をやり直してください。'}finally{e.ocr.disabled=!ready}};
mode('image');setReady(false);initSW();
