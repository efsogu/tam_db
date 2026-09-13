"use strict";

const BASE_URL = "https://api.teamgram.com";
const DEFAULT_DOMAIN = "ozlmed";
const MIN_DELAY_MS = 1100;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let lastRequestAt = 0;
function tokenFromEnv(){ return process.env.TEAMGRAM_API_TOKEN || process.env.TEAMGRAM_TOKEN || ""; }
function retryMs(response){ const n=Number(response.headers.get("retry-after")); return Number.isFinite(n)&&n>0?Math.min(n,60)*1000:30000; }
async function rateGate(){const wait=Math.max(0,MIN_DELAY_MS-(Date.now()-lastRequestAt));if(wait)await sleep(wait);lastRequestAt=Date.now();}
async function pageFetch(url, token, attempt=0){
  await rateGate();
  const response=await fetch(url,{method:"GET",headers:{Accept:"application/json",Token:token},cache:"no-store",signal:AbortSignal.timeout(20000)});
  if(response.status===429 && attempt<4){ await sleep(retryMs(response)); return pageFetch(url,token,attempt+1); }
  const raw=await response.text(); let payload; try{payload=JSON.parse(raw);}catch{throw new Error(`TeamGram JSON dönmedi (HTTP ${response.status}).`);}
  if(!response.ok){const e=new Error(`TeamGram API HTTP ${response.status}`);e.httpStatus=response.status;throw e;}
  if(!Array.isArray(payload?.Products)) throw new Error("TeamGram cevabında Products dizisi bulunamadı.");
  return payload;
}
module.exports=async function handler(req,res){
  res.setHeader("Cache-Control","no-store, max-age=0");res.setHeader("Content-Type","application/json; charset=utf-8");res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Robots-Tag","noindex, nofollow");
  if(req.method!=="GET"){res.setHeader("Allow","GET");return res.status(405).json({ok:false,error:"method_not_allowed"});}
  const token=tokenFromEnv(),domain=String(process.env.TEAMGRAM_DOMAIN||DEFAULT_DOMAIN).trim()||DEFAULT_DOMAIN;
  if(String(req.query?.health||"")==="1") return res.status(200).json({ok:true,configured:Boolean(token),domain,secretExposed:false});
  if(!token) return res.status(503).json({ok:false,error:"teamgram_token_not_configured"});
  try{
    const pageSize=100,products=[],metadata={CustomFields:[],Filters:[],FieldSettings:null},signatures=new Set();let page=1,count=null,pagesFetched=0;
    while(page<=10000){
      const url=new URL(`/${domain}/Products/Index`,BASE_URL);url.searchParams.set("page",String(page));url.searchParams.set("pagesize",String(pageSize));url.searchParams.set("letter","");url.searchParams.set("fid","0");
      const payload=await pageFetch(url.toString(),token);const batch=payload.Products;const sig=JSON.stringify(batch.slice(0,2).map(x=>x?.Id??x?.SKU??x?.Sku));
      if(signatures.has(sig)&&batch.length)throw new Error("TeamGram sayfalaması aynı sayfayı tekrar döndürdü.");signatures.add(sig);
      products.push(...batch);pagesFetched++;
      if(page===1){for(const k of ["CustomFields","Filters","FieldSettings"])if(payload[k]!==undefined)metadata[k]=payload[k];}
      const c=Number(payload.count??payload.Count);if(Number.isFinite(c)&&c>=0)count=c;
      if(!batch.length||(count!==null&&products.length>=count))break;page++;
    }
    if(count!==null&&products.length<count) throw new Error(`Eksik stok snapshot: TeamGram ${count} ürün bildirdi, ${products.length} çekildi.`);
    return res.status(200).json({...metadata,Products:products,count:count??products.length,page:1,pageSize,pagesFetched,source:"TeamGram",fetchedAt:new Date().toISOString()});
  }catch(error){return res.status(Number(error?.httpStatus)||502).json({ok:false,error:"teamgram_stock_failed",message:error?.message||"request_failed",secretExposed:false});}
};
