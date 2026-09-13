"use strict";

function toPositiveInt(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function hasOwn(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function proposalBody(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (payload.Data && typeof payload.Data === "object") return payload.Data;
  return payload;
}

function parentFieldPresent(raw) {
  return !!raw && (hasOwn(raw, "ParentProposal") || hasOwn(raw, "ParentProposalId"));
}

function parentProposalId(raw) {
  if (!raw || typeof raw !== "object") return null;
  return toPositiveInt(raw.ParentProposal?.Id ?? raw.ParentProposal?.id ?? raw.ParentProposalId);
}

function normalizeProposal(payload, options = {}) {
  const raw = proposalBody(payload);
  if (!raw) throw new Error("proposal_payload_missing");

  const id = toPositiveInt(raw.Id ?? raw.id);
  if (!id) throw new Error("proposal_id_missing");

  const enriched = parentFieldPresent(raw);
  if (options.requireEnrichedParentField && !enriched) {
    throw new Error("proposal_parent_field_not_enriched");
  }

  const parentId = parentProposalId(raw);
  const items = Array.isArray(raw.Items) ? raw.Items : [];

  return {
    id,
    proposalId: id,
    no: String(raw.LastName ?? raw.No ?? raw.no ?? "").trim(),
    name: String(raw.Name ?? raw.DisplayName ?? raw.Displayname ?? "").trim(),
    parentProposalId: parentId,
    parentProposal: parentId ? {
      id: parentId,
      name: String(raw.ParentProposal?.Name ?? raw.ParentProposal?.Displayname ?? "").trim() || null
    } : null,
    parentFieldEnriched: enriched,
    isRevision: Boolean(parentId),
    enteredAt: raw.EnteredDate ?? null,
    modifiedAt: raw.ModifiedDate ?? raw.LastActivityDate ?? null,
    stage: raw.Stage ?? null,
    currency: raw.CurrencyName ?? null,
    discountedTotal: Number(raw.DiscountedTotal ?? 0) || 0,
    itemCount: items.length,
    eventAction: payload?.EventAction ?? null,
    eventEntity: payload?.EventEntity ?? null,
    raw
  };
}

function normalizeWebhookTrigger(payload) {
  const raw = proposalBody(payload);
  if (!raw) throw new Error("proposal_payload_missing");
  return {
    id: toPositiveInt(raw.Id ?? raw.id),
    action: payload?.EventAction ?? null,
    entity: payload?.EventEntity ?? null,
    parentFieldPresent: parentFieldPresent(raw),
    requiresDetailEnrichment: !parentFieldPresent(raw)
  };
}

module.exports = {
  toPositiveInt,
  proposalBody,
  parentFieldPresent,
  parentProposalId,
  normalizeProposal,
  normalizeWebhookTrigger
};
