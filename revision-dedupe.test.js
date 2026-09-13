"use strict";

const assert = require("assert");
const { parentProposalId, rootProposalId, latestByRevisionChain } = require("./revision-dedupe");

const original = {
  Id: 29533385,
  status: "Revize edildi",
  ModifiedDate: "2026-09-13T12:59:00Z"
};

const revision = {
  Id: 29533411,
  ParentProposal: { Id: 29533385, Name: "Test test Teklifi" },
  status: "Final",
  ModifiedDate: "2026-09-13T13:01:00Z"
};

const standalone = {
  Id: 40000001,
  status: "Final",
  ModifiedDate: "2026-09-13T12:50:00Z"
};

assert.strictEqual(parentProposalId(revision), 29533385);
assert.strictEqual(rootProposalId(original), 29533385);
assert.strictEqual(rootProposalId(revision), 29533385);

const current = latestByRevisionChain([original, revision, standalone]);
assert.strictEqual(current.length, 2);
assert.ok(current.some(row => Number(row.Id) === 29533411));
assert.ok(current.some(row => Number(row.Id) === 40000001));
assert.ok(!current.some(row => Number(row.Id) === 29533385));

console.log("revision-dedupe tests: PASS");
