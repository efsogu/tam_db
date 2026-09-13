"use strict";
const fs=require("node:fs");const path=require("node:path");
const file=path.resolve(__dirname,"..","dist","index.html");
const html=fs.readFileSync(file,"utf8");
function must(label,needle){if(!html.includes(needle))throw new Error(`${label}: missing ${needle}`);}
function mustNot(label,needle){if(html.includes(needle))throw new Error(`${label}: forbidden ${needle}`);}

must("v35 simulator","Çok Kalemli Teklif Simülatörü");
must("v35 stock refresh","Stoku Güncelle");
must("v35 stock raw fields","Tüm TeamGram Alanları");
must("v35 stock metadata","API Metadata");
must("v35 stock endpoint","/api/teamgram-stock");
must("pinned XLSX","https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
must("pinned Chart.js","https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js");
must("v35 freshness arbitration","persistedTime===incomingTime&&persistedCount>incomingCount");
must("TeamGram proposal button","id=\"teamgramSyncBtn\"");
must("TeamGram proposal endpoint","/api/teamgram-proposals-sync");
must("proposal cache","tam-teamgram-proposals-v1");
must("revision root","revisionRootProposalId");
must("parent proposal field","parentProposalId: offerRow['ParentProposalId'] ?? null");
mustNot("legacy status-only calculation","return (offers || []).filter(offer => !isRevisedOffer(offer)).map(correctCachedSpareBmdOffer);");
mustNot("server secret name","TEAMGRAM_API_TOKEN");
mustNot("server secret alias","TEAMGRAM_TOKEN");
mustNot("direct TeamGram proposal host","api.teamgram.com/ozlmed/Proposals");

const scriptPattern=/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;let match;let count=0;
while((match=scriptPattern.exec(html))){const code=match[1].trim();if(!code)continue;count++;try{new Function(code);}catch(error){throw new Error(`inline script ${count} syntax: ${error.message}`);}}
if(count<2) throw new Error("unexpected inline script count");
console.log(`v35 preview verification: PASS · ${count} inline scripts syntax-valid`);
