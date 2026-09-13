"use strict";

function proposalId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function parentProposalId(row) {
  if (!row || typeof row !== "object") return null;
  return proposalId(row.parentProposalId ?? row.ParentProposalId ?? row.parentProposal?.id ?? row.ParentProposal?.Id);
}

function ownProposalId(row) {
  if (!row || typeof row !== "object") return null;
  return proposalId(row.id ?? row.Id ?? row.proposalId ?? row.ProposalId);
}

function rootProposalId(row) {
  return parentProposalId(row) || ownProposalId(row);
}

function latestByRevisionChain(rows) {
  const groups = new Map();
  for (const row of rows || []) {
    const rootId = rootProposalId(row);
    const fallbackNo = String(row?.no ?? row?.teklifNo ?? "").trim();
    const key = rootId ? `id:${rootId}` : `no:${fallbackNo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()].map(group => group.slice().sort((a, b) => {
    const at = new Date(a?.modifiedAt ?? a?.ModifiedDate ?? a?.lastStatusAt ?? a?.createdAt ?? 0).getTime() || 0;
    const bt = new Date(b?.modifiedAt ?? b?.ModifiedDate ?? b?.lastStatusAt ?? b?.createdAt ?? 0).getTime() || 0;
    return bt - at;
  })[0]);
}

if (typeof module !== "undefined") module.exports = { proposalId, parentProposalId, ownProposalId, rootProposalId, latestByRevisionChain };
if (typeof window !== "undefined") window.TeamGramRevisionDedupe = { proposalId, parentProposalId, ownProposalId, rootProposalId, latestByRevisionChain };
