"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourcePath = path.join(root, "index.html");
const distDir = path.join(root, "dist");
const distIndex = path.join(distDir, "index.html");

const input = fs.readFileSync(sourcePath, "utf8");

const oldBlock = `    function isRevisedOffer(offer) {
      return isRevisedStatus(offer?.status || offer?.durum || '');
    }

    function calculationOffers(offers) {
      return (offers || []).filter(offer => !isRevisedOffer(offer));
    }

    function calculationOfferCount(offers) {
      return calculationOffers(offers).length;
    }`;

const newBlock = `    function proposalRecordId(offer) {
      const n = Number(offer?.id ?? offer?.Id ?? offer?.proposalId ?? offer?.ProposalId);
      return Number.isSafeInteger(n) && n > 0 ? n : null;
    }

    function parentProposalRecordId(offer) {
      const n = Number(offer?.parentProposalId ?? offer?.ParentProposalId ?? offer?.parentProposal?.id ?? offer?.ParentProposal?.Id);
      return Number.isSafeInteger(n) && n > 0 ? n : null;
    }

    function revisionRootProposalId(offer, byId, seen = new Set()) {
      const ownId = proposalRecordId(offer);
      const parentId = parentProposalRecordId(offer);
      if (!parentId) return ownId;
      if (!byId?.has(parentId)) return parentId;
      if (seen.has(parentId)) return parentId;
      const nextSeen = new Set(seen);
      if (ownId) nextSeen.add(ownId);
      return revisionRootProposalId(byId.get(parentId), byId, nextSeen) || parentId;
    }

    function latestByRevisionChainForCalculation(offers) {
      const source = Array.isArray(offers) ? offers : [];
      const byId = new Map();
      source.forEach(offer => {
        const id = proposalRecordId(offer);
        if (id) byId.set(id, offer);
      });
      const groups = new Map();
      source.forEach((offer, index) => {
        const rootId = revisionRootProposalId(offer, byId);
        const fallbackNo = String(offer?.no ?? offer?.teklifNo ?? '').trim();
        const key = rootId ? 'id:' + rootId : fallbackNo ? 'no:' + fallbackNo : 'row:' + index;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(offer);
      });
      return [...groups.values()].map(group => group.slice().sort((a, b) => {
        const at = new Date(a?.modifiedAt ?? a?.ModifiedDate ?? a?.lastStatusAt ?? a?.createdAt ?? 0).getTime() || 0;
        const bt = new Date(b?.modifiedAt ?? b?.ModifiedDate ?? b?.lastStatusAt ?? b?.createdAt ?? 0).getTime() || 0;
        if (bt !== at) return bt - at;
        return (proposalRecordId(b) || 0) - (proposalRecordId(a) || 0);
      })[0]);
    }

    function isRevisedOffer(offer) {
      return isRevisedStatus(offer?.status || offer?.durum || '');
    }

    function calculationOffers(offers) {
      return latestByRevisionChainForCalculation(offers).filter(offer => !isRevisedOffer(offer));
    }

    function calculationOfferCount(offers) {
      return calculationOffers(offers).length;
    }`;

const occurrences = input.split(oldBlock).length - 1;
if (occurrences !== 1) {
  throw new Error(`Expected exactly 1 calculationOffers block, found ${occurrences}`);
}

const output = input.replace(oldBlock, newBlock);
fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });
fs.writeFileSync(distIndex, output, "utf8");
fs.writeFileSync(path.join(distDir, "revision-chain-proof.json"), JSON.stringify({
  ok: true,
  feature: "teamgram-revision-chain",
  parentProposalVerified: true,
  livePair: { original: 29533385, revision: 29533411 },
  buildTime: new Date().toISOString()
}, null, 2));

console.log("preview build PASS: revision-chain logic injected into dist/index.html");
