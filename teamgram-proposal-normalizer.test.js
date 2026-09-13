"use strict";

const assert = require("assert");
const {
  normalizeProposal,
  normalizeWebhookTrigger,
  parentFieldPresent
} = require("./teamgram-proposal-normalizer");

// Observed TeamGram webhook shape for the live revision proposal.
// The webhook trigger contains the proposal body but does not carry ParentProposal.
const webhookRevision = {
  Data: {
    Id: 29533411,
    LastName: "21056",
    Name: "Test test Teklifi - Revizyon",
    ModifiedDate: "2026-09-13T13:00:27",
    CurrencyName: "USD",
    DiscountedTotal: 570,
    Items: [{ ItemId: 35556190 }]
  },
  EventAction: "New",
  EventEntity: "Proposal"
};

const trigger = normalizeWebhookTrigger(webhookRevision);
assert.strictEqual(trigger.id, 29533411);
assert.strictEqual(trigger.action, "New");
assert.strictEqual(trigger.entity, "Proposal");
assert.strictEqual(trigger.parentFieldPresent, false);
assert.strictEqual(trigger.requiresDetailEnrichment, true);
assert.throws(
  () => normalizeProposal(webhookRevision, { requireEnrichedParentField: true }),
  /proposal_parent_field_not_enriched/
);

// Live Proposals/Get verification from 13 Sep 2026:
// Proposal 29533411 returned ParentProposal.Id 29533385.
const enrichedRevision = {
  Id: 29533411,
  LastName: "21056",
  Name: "Test test Teklifi - Revizyon",
  ModifiedDate: "2026-09-13T13:00:27",
  ParentProposal: {
    Id: 29533385,
    Name: "Test test Teklifi"
  },
  CurrencyName: "USD",
  DiscountedTotal: 570,
  Items: [{ ItemId: 35556190 }]
};

assert.strictEqual(parentFieldPresent(enrichedRevision), true);
const normalized = normalizeProposal(enrichedRevision, { requireEnrichedParentField: true });
assert.strictEqual(normalized.id, 29533411);
assert.strictEqual(normalized.no, "21056");
assert.strictEqual(normalized.parentProposalId, 29533385);
assert.strictEqual(normalized.parentProposal.id, 29533385);
assert.strictEqual(normalized.isRevision, true);
assert.strictEqual(normalized.parentFieldEnriched, true);
assert.strictEqual(normalized.currency, "USD");
assert.strictEqual(normalized.discountedTotal, 570);
assert.strictEqual(normalized.itemCount, 1);

const standalone = normalizeProposal({
  Id: 40000001,
  LastName: "30001",
  Name: "Standalone",
  ParentProposal: null,
  Items: []
}, { requireEnrichedParentField: true });
assert.strictEqual(standalone.parentProposalId, null);
assert.strictEqual(standalone.isRevision, false);
assert.strictEqual(standalone.parentFieldEnriched, true);

console.log("teamgram proposal normalizer tests: PASS");
