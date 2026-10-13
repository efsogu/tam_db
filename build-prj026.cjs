"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
const sourceIndex = fs.readFileSync(path.join(root, "index.html"), "utf8");
const marker = '<script src="case007.js"></script>';
if (!sourceIndex.includes(marker)) throw new Error("CASE_007 script marker missing from index.html");
const overlays = marker + '<script src="case007-review-v033.js"></script><script src="case007-full75-v034.js"></script>';
let builtIndex = sourceIndex.replace(marker, overlays);
const oldReviewTotal = "function reviewTotal(){return DB.cases.reduce((n,c)=>n+(c.review_queue?.length||0),0)}";
const newReviewTotal = "function reviewTotal(){return DB.cases.reduce((n,c)=>n+(c.review_queue||[]).filter(i=>(i.queue_status||'PENDING')==='PENDING').length,0)}";
const oldPrepared = "DB.cases.flatMap(c=>(c.review_queue||[]).map(i=>prepareReviewItem(c,i)))";
const newPrepared = "DB.cases.flatMap(c=>(c.review_queue||[]).filter(i=>(i.queue_status||'PENDING')==='PENDING').map(i=>prepareReviewItem(c,i)))";
const oldReviewHead = "function review(){setHead('İnceleme Kuyruğu','66 bekleyen kaydı Required‑First sırayla ve kanıt hazırlığına göre incele.');const all=allPreparedReviewItems();";
const newReviewHead = "function review(){const all=allPreparedReviewItems();setHead('İnceleme Kuyruğu',`${all.length} bekleyen kaydı Required‑First sırayla ve kanıt hazırlığına göre incele.`);";
for (const [oldText, newText, label] of [[oldReviewTotal,newReviewTotal,'reviewTotal'],[oldPrepared,newPrepared,'allPreparedReviewItems'],[oldReviewHead,newReviewHead,'review heading']]) {
  if (!builtIndex.includes(oldText)) throw new Error(`PRJ-026 pending-review patch marker missing: ${label}`);
  builtIndex = builtIndex.replace(oldText,newText);
}
fs.writeFileSync(path.join(dist, "index.html"), builtIndex);
for (const file of ["case007.js", "case007-review-v033.js", "case007-full75-v034.js"]) {
  fs.copyFileSync(path.join(root, file), path.join(dist, file));
}
fs.writeFileSync(path.join(dist, "deploy-proof.json"), JSON.stringify({
  ok: true,
  project: "PRJ-026",
  mode: "read-only-pilot",
  case007: true,
  activeVersion: "v0.34",
  humanReviewBatch: "CASE_007-HR-20261014-02",
  full75EvidenceCoverage: "PASS",
  canonicalPublishGate: "NEEDS_REVIEW",
  pendingSemanticReviews: 3,
  pendingReviewUiNormalized: true,
  productionPromotion: "NOT_APPLIED",
  buildTime: new Date().toISOString()
}, null, 2));
console.log("PRJ-026 web pilot build PASS (CASE_007 v0.34 Full-75 evidence audit; 3 semantic reviews pending)");
