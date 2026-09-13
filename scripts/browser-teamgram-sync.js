/* TeamGram proposal sync adapter for Teklif Analiz Merkezi v35 baseline. */
(function(){
  'use strict';

  const ENDPOINT = '/api/teamgram-proposals-sync';
  const DB_NAME = 'tam-teamgram-proposals-v1';
  const DB_VERSION = 1;
  const GOOD_STORE = 'bundles';
  const STAGING_STORE = 'staging';
  const META_STORE = 'meta';
  const INDEX_PAGE_SIZE = 100;
  const INDEX_SPACING_MS = 1100;
  const DETAIL_SPACING_MS = 2100;
  let lastRequestAt = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const asInt = v => { const n=Number(v); return Number.isSafeInteger(n)&&n>0?n:null; };
  const statusLine = () => document.getElementById('analysisStatusLine');
  function setSyncStatus(message){ const el=statusLine(); if(el) el.textContent=String(message||''); }
  function setProgress(pct, text){ if(typeof setAnalysisProgress==='function') setAnalysisProgress(Math.max(0,Math.min(100,pct)),text,{show:true}); }
  async function rateGate(minGap){ const wait=Math.max(0,minGap-(Date.now()-lastRequestAt)); if(wait) await sleep(wait); lastRequestAt=Date.now(); }

  function openDb(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(GOOD_STORE)) db.createObjectStore(GOOD_STORE,{keyPath:'id'});
        if(!db.objectStoreNames.contains(STAGING_STORE)) db.createObjectStore(STAGING_STORE,{keyPath:'id'});
        if(!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE,{keyPath:'key'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error||new Error('IndexedDB açılamadı'));
    });
  }
  function txDone(tx){
    return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('IndexedDB işlemi başarısız'));tx.onabort=()=>reject(tx.error||new Error('IndexedDB işlemi iptal edildi'));});
  }
  async function readStore(name){
    const db=await openDb();
    try{
      const tx=db.transaction(name,'readonly');
      const req=tx.objectStore(name).getAll();
      const rows=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});
      await txDone(tx);return rows;
    }finally{db.close();}
  }
  async function putStaging(record){
    const db=await openDb();
    try{const tx=db.transaction(STAGING_STORE,'readwrite');tx.objectStore(STAGING_STORE).put(record);await txDone(tx);}finally{db.close();}
  }
  async function commitGoodSnapshot(records, meta){
    const db=await openDb();
    try{
      const tx=db.transaction([GOOD_STORE,STAGING_STORE,META_STORE],'readwrite');
      const good=tx.objectStore(GOOD_STORE);const staging=tx.objectStore(STAGING_STORE);const metaStore=tx.objectStore(META_STORE);
      good.clear();
      for(const row of records) good.put(row);
      staging.clear();
      metaStore.put({key:'lastSuccessfulSync',...meta});
      await txDone(tx);
    }finally{db.close();}
  }

  async function apiFetch(url, minGap, attempt=0){
    await rateGate(minGap);
    const res=await fetch(url,{cache:'no-store',credentials:'same-origin',headers:{Accept:'application/json'}});
    const data=await res.json().catch(()=>null);
    if(res.status===429 && attempt<5){
      const retry=Math.max(1,Number(res.headers.get('Retry-After')||data?.retryAfter||30));
      setSyncStatus(`TeamGram hız sınırı · ${retry} sn bekleniyor…`);
      await sleep(retry*1000);
      return apiFetch(url,minGap,attempt+1);
    }
    if(!res.ok) throw new Error(data?.message||data?.error||`HTTP ${res.status}`);
    return data;
  }

  async function fetchIndex(){
    const fingerprints=[];let page=1,total=null;const pageSignatures=new Set();
    while(page<=10000){
      setProgress(Math.min(18,2+page/10),`TeamGram teklif listesi okunuyor · sayfa ${page}`);
      const data=await apiFetch(`${ENDPOINT}?action=index&page=${page}&pageSize=${INDEX_PAGE_SIZE}&fid=0`,INDEX_SPACING_MS);
      const rows=Array.isArray(data?.fingerprints)?data.fingerprints.filter(x=>asInt(x?.id)&&x?.fingerprint):[];
      const sig=rows.map(x=>x.id).join(',');
      if(sig&&pageSignatures.has(sig)) throw new Error(`TeamGram Index sayfası tekrarlandı (sayfa ${page}). Snapshot korunuyor.`);
      if(sig) pageSignatures.add(sig);
      fingerprints.push(...rows);
      if(Number.isFinite(Number(data?.count))) total=Number(data.count);
      const returned=Number(data?.returned ?? rows.length);
      if(returned<=0 || (total!==null && fingerprints.length>=total)) break;
      page++;
    }
    const byId=new Map();for(const row of fingerprints) byId.set(asInt(row.id),row.fingerprint);
    if(total!==null && byId.size<total) throw new Error(`Eksik Index: TeamGram ${total} teklif bildirdi, ${byId.size} benzersiz teklif alındı.`);
    if(!byId.size) throw new Error('TeamGram Index teklif döndürmedi. Mevcut analiz korunuyor.');
    return {byId,total:total??byId.size,pages:page};
  }

  function recordUsable(record,fingerprint){
    return !!(record && record.fingerprint===fingerprint && record.offerRow && Array.isArray(record.detailRows) && Array.isArray(record.historyRows));
  }
  async function fetchDetail(id,fingerprint,index,total){
    const pct=20+Math.round((index/Math.max(total,1))*62);
    setProgress(pct,`TeamGram teklif detayları · ${index}/${total}`);
    const data=await apiFetch(`${ENDPOINT}?action=detail&id=${encodeURIComponent(id)}`,DETAIL_SPACING_MS);
    const record=data?.record;
    if(!record||asInt(record.id)!==id||!record.offerRow||!Array.isArray(record.detailRows)||!Array.isArray(record.historyRows)) throw new Error(`Teklif ${id} detayı doğrulanamadı.`);
    const staged={...record,id,fingerprint,syncedAt:new Date().toISOString()};
    await putStaging(staged);
    return staged;
  }

  function workbookFile(records){
    const teklifler=[];const detaylar=[];const tarihce=[];
    for(const r of records){
      if(r?.offerRow) teklifler.push(r.offerRow);
      if(Array.isArray(r?.detailRows)) detaylar.push(...r.detailRows);
      if(Array.isArray(r?.historyRows)) tarihce.push(...r.historyRows);
    }
    if(!teklifler.length) throw new Error('TeamGram snapshot teklif satırı içermiyor.');
    if(!detaylar.length) throw new Error('TeamGram snapshot detay/kalem satırı içermiyor.');
    if(!tarihce.length) throw new Error('TeamGram snapshot durum tarihçesi içermiyor.');
    const offerHeaders=['Id','No','ParentProposalId','Müşteri','MüşteriId','Müşterideki ilgili kişi','Konu','Detaylar','Durum','Vergi hariç toplam','Vergi dahil toplam','Para birimi','Toplam tahmini kâr','Kâr para birimi','Maliyet','Maliyet Para birimi','İndirim','İndirim tipi','Geçerlilik sonu','Teklif tarihi','Son durum değişikliği','Etiketler','Yetki sahibi','Oluşturan','Oluşturma tarihi','Son işlem','Güncelleyen','Güncelleme tarihi','Bölge','İş adresi','İş adresi - il','İş adresi - ilçe','İş adresi - ülke','Teslimat adresi','Teslimat adresi - il','Teslimat adresi - ilçe','Teslimat adresi - ülke','Vergi hariç çevrilmiş toplam','Vergi dahil çevrilmiş toplam','Çevrilmiş para birimi'];
    const detailHeaders=['No','Id','Geçerlilik sonu','MüşteriId','Müşteri','Müşterideki ilgili kişi','Yetki sahibi','Ürün Id','Marka','Model','Ürün ismi','Ürün adı','Ürün kodu','Ek bilgi','İndirim','İndirim tipi','Miktar','Birim','Fiyat','Birim fiyat','İndirimli fiyat','Satır toplamı','Para birimi','%KDV','Birim maliyet','Birim maliyeti para birimi','Ana kategori','Alt kategori','UBB','Final tarihi','Not','TeamGram ItemId','TeamGram ProductId'];
    const historyHeaders=['Tip','Id','No','Ne zaman','Kim','Durum','Aşama'];
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(teklifler,{header:offerHeaders}), 'Teklifler');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(detaylar,{header:detailHeaders}), 'Detaylar');
    XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(tarihce,{header:historyHeaders}), 'Durum tarihçesi');
    if(typeof validateOfferWorkbook==='function'){const check=validateOfferWorkbook(wb);if(!check.valid)throw new Error(`TeamGram çalışma kitabı doğrulanamadı: ${check.errors.join(' · ')}`);}
    const bytes=XLSX.write(wb,{bookType:'xlsx',type:'array'});
    const stamp=new Date().toISOString().replace(/[:.]/g,'-');
    return {file:new File([bytes],`TeamGram_API_${stamp}.xlsx`,{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),counts:{teklifler:teklifler.length,detaylar:detaylar.length,tarihce:tarihce.length}};
  }

  async function syncFromTeamGram(){
    const btn=document.getElementById('teamgramSyncBtn');
    if(btn?.disabled) return;
    const prevText=btn?.textContent||'TeamGram’dan Güncelle';
    const previousData=(typeof state!=='undefined')?state.data:null;
    const previousMeta=(typeof state!=='undefined')?{...(state.fileMeta||{})}:null;
    try{
      if(btn){btn.disabled=true;btn.textContent='TeamGram çekiliyor…';btn.setAttribute('aria-busy','true');}
      setSyncStatus('TeamGram bağlantısı kontrol ediliyor…');setProgress(1,'TeamGram bağlantısı kontrol ediliyor…');
      const health=await apiFetch(`${ENDPOINT}?health=1`,0);
      if(!health?.configured) throw new Error('TeamGram API secret bu ortamda yapılandırılmamış.');

      const [{byId,total,pages},goodRows,stagingRows]=await Promise.all([fetchIndex(),readStore(GOOD_STORE),readStore(STAGING_STORE)]);
      const good=new Map(goodRows.map(x=>[asInt(x.id),x]));const staged=new Map(stagingRows.map(x=>[asInt(x.id),x]));
      const next=new Map();const changed=[];
      for(const [id,fingerprint] of byId){
        const cached=good.get(id);const partial=staged.get(id);
        if(recordUsable(cached,fingerprint)) next.set(id,cached);
        else if(recordUsable(partial,fingerprint)) next.set(id,partial);
        else changed.push({id,fingerprint});
      }
      setSyncStatus(`TeamGram Index hazır · ${byId.size.toLocaleString('tr-TR')} teklif · ${changed.length.toLocaleString('tr-TR')} yeni/değişen kayıt`);
      if(changed.length>200) setProgress(20,`İlk tam senkron uzun sürebilir · ${changed.length.toLocaleString('tr-TR')} teklif detaylandırılacak`);

      let done=0;
      for(const item of changed){
        done++;
        const row=await fetchDetail(item.id,item.fingerprint,done,changed.length);
        next.set(item.id,row);
      }
      if(next.size!==byId.size) throw new Error(`Snapshot bütünlüğü bozuk: ${next.size}/${byId.size} teklif hazır.`);

      setProgress(84,'TeamGram snapshot doğrulanıyor…');
      const records=[...next.values()].sort((a,b)=>Number(a.id)-Number(b.id));
      const {file,counts}=workbookFile(records);
      const syncedAt=new Date().toISOString();
      await commitGoodSnapshot(records,{syncedAt,total:records.length,indexPages:pages,changed:changed.length,source:'TeamGram API'});

      setProgress(88,'TeamGram verisi mevcut analiz motoruna aktarılıyor…');
      await analyzeWorkbookFromFile(file);
      if(typeof state!=='undefined') state.fileMeta={...(state.fileMeta||{}),source:'TeamGram API',teamgramSyncedAt:syncedAt,teamgramOfferCount:records.length,teamgramChangedCount:changed.length};
      const line=statusLine();
      if(line) line.insertAdjacentHTML('beforeend',`<span>TeamGram: ${records.length.toLocaleString('tr-TR')} teklif · ${counts.detaylar.toLocaleString('tr-TR')} kalem · ${changed.length.toLocaleString('tr-TR')} güncellendi</span>`);
      if(typeof scheduleAnalysisCacheSave==='function') scheduleAnalysisCacheSave();
    }catch(error){
      if(typeof state!=='undefined' && previousData) state.data=previousData;
      if(typeof state!=='undefined' && previousMeta) state.fileMeta=previousMeta;
      setSyncStatus(`TeamGram güncellemesi başarısız; son başarılı analiz/snapshot korundu. ${error?.message||error}`);
      setProgress(0,'TeamGram güncellemesi başarısız; son iyi veri korundu.');
      console.error('TeamGram proposal sync failed',error);
    }finally{
      if(btn){btn.disabled=false;btn.textContent=prevText;btn.removeAttribute('aria-busy');}
    }
  }

  function bind(){
    const btn=document.getElementById('teamgramSyncBtn');
    if(btn&&!btn.dataset.bound){btn.dataset.bound='1';btn.addEventListener('click',syncFromTeamGram);}
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',bind,{once:true}); else bind();
  window.tamTeamGramProposalSync={run:syncFromTeamGram,endpoint:ENDPOINT};
})();
