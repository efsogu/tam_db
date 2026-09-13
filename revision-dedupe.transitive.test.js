"use strict";
const assert = require("assert");
const { latestByRevisionChain } = require("./revision-dedupe");

const original = { Id: 29533385, ModifiedDate: "2026-09-13T12:59:00Z" };
const revision1 = { Id: 29533411, ParentProposal: { Id: 29533385 }, ModifiedDate: "2026-09-13T13:01:00Z" };
const revision2 = { Id: 29533499, ParentProposal: { Id: 29533411 }, ModifiedDate: "2026-09-13T13:05:00Z" };
const standalone = { Id: 40000001, ModifiedDate: "2026-09-13T12:50:00Z" };

const result = latestByRevisionChain([original, revision1, revision2, standalone]);
assert.strictEqual(result.length, 2);
assert.ok(result.some(row => Number(row.Id) === 29533499));
assert.ok(result.some(row => Number(row.Id) === 40000001));
assert.ok(!result.some(row => Number(row.Id) === 29533385));
assert.ok(!result.some(row => Number(row.Id) === 29533411));
console.log("revision-dedupe transitive tests: PASS");
