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
const builtIndex = sourceIndex.replace(marker, overlays);
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
  productionPromotion: "NOT_APPLIED",
  buildTime: new Date().toISOString()
}, null, 2));
console.log("PRJ-026 web pilot build PASS (CASE_007 v0.34 Full-75 evidence audit; 3 semantic reviews pending)");
