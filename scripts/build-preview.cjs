"use strict";

const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");
const crypto = require("node:crypto");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_DIR = path.join(ROOT, "sites-v35");
const SOURCE_PARTS = fs.readdirSync(SOURCE_DIR).filter(name => /^chunk_\d{2}\.txt$/.test(name)).sort().map(name => path.join(SOURCE_DIR, name));
const BROWSER_SYNC = path.join(ROOT, "scripts", "browser-teamgram-sync.js");
const OUT = path.join(ROOT, "dist");
const EXPECTED = {
  dashboard: "eed3ecf48a2d90943d9b08140774971cbea6c6e74744071848018e643bcfe0f5"
};

function sha(buf){ return crypto.createHash("sha256").update(buf).digest("hex"); }
function inflate(parts, expected){ if(!parts.length) throw new Error("v35 source chunks missing"); const b64=parts.map(file=>fs.readFileSync(file,"utf8").trim()).join(""); const compressed=Buffer.from(b64,"base64"); const buf=zlib.brotliDecompressSync(compressed); const actual=sha(buf); if(actual!==expected) throw new Error(`v35 source hash mismatch: ${actual}`); return buf; }
function replaceOnce(source, needle, replacement, label){ const first=source.indexOf(needle); if(first<0) throw new Error(`${label}: anchor not found`); if(source.indexOf(needle, first+needle.length)>=0) throw new Error(`${label}: anchor not unique`); return source.slice(0,first)+replacement+source.slice(first+needle.length); }

fs.rmSync(OUT,{recursive:true,force:true});
fs.mkdirSync(OUT,{recursive:true});

let html=inflate(SOURCE_PARTS,EXPECTED.dashboard).toString("utf8");
html=replaceOnce(html,'<script src="/vendor/xlsx.full.min.js"></script>','<script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"></script>',"pinned XLSX CDN");
html=replaceOnce(html,'<script src="/vendor/chart.umd.min.js"></script>','<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js"></script>',"pinned Chart.js CDN");
const browserSync=fs.readFileSync(BROWSER_SYNC,"utf8");

const oldCalc=`    function calculationOffers(offers) {\n      return (offers || []).filter(offer => !isRevisedOffer(offer)).map(correctCachedSpareBmdOffer);\n    }`;
const newCalc=`    function proposalRecordId(offer) {\n      const n = Number(offer?.id ?? offer?.Id ?? offer?.proposalId ?? offer?.ProposalId);\n      return Number.isSafeInteger(n) && n > 0 ? n : null;\n    }\n\n    function parentProposalRecordId(offer) {\n      const n = Number(offer?.parentProposalId ?? offer?.ParentProposalId ?? offer?.parentProposal?.id ?? offer?.ParentProposal?.Id);\n      return Number.isSafeInteger(n) && n > 0 ? n : null;\n    }\n\n    function revisionRootProposalId(offer, byId, seen = new Set()) {\n      const ownId = proposalRecordId(offer);\n      const parentId = parentProposalRecordId(offer);\n      if (!parentId) return ownId;\n      if (!byId?.has(parentId) || seen.has(parentId)) return parentId;\n      const nextSeen = new Set(seen);\n      if (ownId) nextSeen.add(ownId);\n      return revisionRootProposalId(byId.get(parentId), byId, nextSeen) || parentId;\n    }\n\n    function latestOffersByRevisionChain(offers) {\n      const source = Array.isArray(offers) ? offers : [];\n      const byId = new Map();\n      source.forEach(offer => { const id = proposalRecordId(offer); if (id) byId.set(id, offer); });\n      const groups = new Map();\n      source.forEach((offer,index) => {\n        const rootId = revisionRootProposalId(offer, byId);\n        const fallbackNo = String(offer?.no || '').trim();\n        const key = rootId ? \`id:\${rootId}\` : fallbackNo ? \`no:\${fallbackNo}\` : \`row:\${index}\`;\n        if (!groups.has(key)) groups.set(key, []);\n        groups.get(key).push(offer);\n      });\n      return [...groups.values()].map(group => group.slice().sort((a,b) => {\n        const at = toDate(a?.modifiedAt || a?.lastStatusAt || a?.createdAt)?.getTime?.() || 0;\n        const bt = toDate(b?.modifiedAt || b?.lastStatusAt || b?.createdAt)?.getTime?.() || 0;\n        if (bt !== at) return bt - at;\n        return (proposalRecordId(b) || 0) - (proposalRecordId(a) || 0);\n      })[0]);\n    }\n\n    function calculationOffers(offers) {\n      return latestOffersByRevisionChain(offers || []).filter(offer => !isRevisedOffer(offer)).map(correctCachedSpareBmdOffer);\n    }`;
html=replaceOnce(html,oldCalc,newCalc,"revision-chain calculationOffers");

const oldReturn=`        no: offerRow['No'],\n        id: offerRow['Id'],\n        customer: String(offerRow['Müşteri'] || '').trim() || '-',`;
const newReturn=`        no: offerRow['No'],\n        id: offerRow['Id'],\n        parentProposalId: offerRow['ParentProposalId'] ?? null,\n        modifiedAt: toDate(offerRow['Güncelleme tarihi']) || lastStatusAt || createdAt,\n        customer: String(offerRow['Müşteri'] || '').trim() || '-',`;
html=replaceOnce(html,oldReturn,newReturn,"buildOfferRecord lineage fields");

const oldButtons=`                <button id="loadCachedAnalysisBtn" class="btn btn-secondary" type="button">Son Analizi Yükle</button>\n                <button id="clearAnalysisCacheBtn" class="btn btn-secondary" type="button">Önbelleği Temizle</button>`;
const newButtons=`                <button id="teamgramSyncBtn" class="btn btn-secondary" type="button">TeamGram’dan Güncelle</button>\n                <button id="loadCachedAnalysisBtn" class="btn btn-secondary" type="button">Son Analizi Yükle</button>\n                <button id="clearAnalysisCacheBtn" class="btn btn-secondary" type="button">Önbelleği Temizle</button>`;
html=replaceOnce(html,oldButtons,newButtons,"TeamGram sync button");

const injection=`\n<script>\n${browserSync}\n</script>\n`;
const bodyClose=html.lastIndexOf("</body>");
if(bodyClose<0) throw new Error("body close not found");
html=html.slice(0,bodyClose)+injection+html.slice(bodyClose);

fs.writeFileSync(path.join(OUT,"index.html"),html);
fs.writeFileSync(path.join(OUT,"dashboard.html"),html);
fs.writeFileSync(path.join(OUT,"v35-source-proof.json"),JSON.stringify({
  ok:true,
  baseline:"stock_latest_snapshot_v35_package",
  dashboardSourceSha256:EXPECTED.dashboard,
  generatedSha256:sha(Buffer.from(html)),
  integration:"teamgram-proposal-sync-v1",
  generatedAt:new Date().toISOString()
},null,2));
console.log(`v35 baseline build: PASS · ${html.length} chars`);
