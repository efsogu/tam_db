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

function rootProposalId(row, byId = null, seen = new Set()) {
  const ownId = ownProposalId(row);
  const parentId = parentProposalId(row);
  if (!parentId) return ownId;
  if (!byId || !byId.has(parentId)) return parentId;
  if (seen.has(parentId)) return parentId;

  const nextSeen = new Set(seen);
  if (ownId) nextSeen.add(ownId);
  const parentRow = byId.get(parentId);
  return rootProposalId(parentRow, byId, nextSeen) || parentId;
}

function latestByRevisionChain(rows) {
  const source = Array.isArray(rows) ? rows : [];
  const byId = new Map();
  source.forEach(row => {
    const id = ownProposalId(row);
    if (id) byId.set(id, row);
  });

  const groups = new Map();
  source.forEach((row, index) => {
    const rootId = rootProposalId(row, byId);
    const fallbackNo = String(row?.no ?? row?.teklifNo ?? "").trim();
    const key = rootId ? `id:${rootId}` : fallbackNo ? `no:${fallbackNo}` : `row:${index}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });

  return [...groups.values()].map(group => group.slice().sort((a, b) => {
    const at = new Date(a?.modifiedAt ?? a?.ModifiedDate ?? a?.lastStatusAt ?? a?.createdAt ?? 0).getTime() || 0;
    const bt = new Date(b?.modifiedAt ?? b?.ModifiedDate ?? b?.lastStatusAt ?? b?.createdAt ?? 0).getTime() || 0;
    if (bt !== at) return bt - at;
    return (ownProposalId(b) || 0) - (ownProposalId(a) || 0);
  })[0]);
}

if (typeof module !== "undefined") module.exports = { proposalId, parentProposalId, ownProposalId, rootProposalId, latestByRevisionChain };
if (typeof window !== "undefined") window.TeamGramRevisionDedupe = { proposalId, parentProposalId, ownProposalId, rootProposalId, latestByRevisionChain };
