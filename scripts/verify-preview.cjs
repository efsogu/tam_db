"use strict";

const fs = require("fs");
const path = require("path");

const distIndex = path.join(__dirname, "..", "dist", "index.html");
const html = fs.readFileSync(distIndex, "utf8");

const required = [
  "function proposalRecordId(offer)",
  "function parentProposalRecordId(offer)",
  "function revisionRootProposalId(offer, byId, seen = new Set())",
  "function latestByRevisionChainForCalculation(offers)",
  "return latestByRevisionChainForCalculation(offers).filter(offer => !isRevisedOffer(offer));"
];

for (const marker of required) {
  if (!html.includes(marker)) {
    throw new Error(`Preview verification failed: missing marker: ${marker}`);
  }
}

const legacy = "return (offers || []).filter(offer => !isRevisedOffer(offer));";
if (html.includes(legacy)) {
  throw new Error("Preview verification failed: legacy calculationOffers implementation still present");
}

const proofPath = path.join(__dirname, "..", "dist", "revision-chain-proof.json");
const proof = JSON.parse(fs.readFileSync(proofPath, "utf8"));
if (!proof.ok || proof.livePair?.original !== 29533385 || proof.livePair?.revision !== 29533411) {
  throw new Error("Preview verification failed: proof payload mismatch");
}

console.log("preview verification PASS: patched calculationOffers is present and legacy logic is absent");
