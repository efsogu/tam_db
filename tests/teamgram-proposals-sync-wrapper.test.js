"use strict";

const assert = require("node:assert/strict");
const endpoint = require("../api/teamgram-proposals-sync");

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload)
  };
}

(async () => {
  const { unwrapData, fetchProposalIndexPage, fetchProposalBundle } = endpoint._test;

  assert.deepEqual(unwrapData({ Data: { Id: 7 } }), { Id: 7 });
  assert.equal(unwrapData({ Id: 8 }).Id, 8);

  const originalFetch = global.fetch;
  try {
    global.fetch = async url => {
      const u = String(url);
      if (u.includes("Proposals/Index")) {
        return response({ Data: { ProposalCount: 1, List: [{ Id: 123, ModifiedDate: "2026-09-13T10:00:00Z", DiscountedTotal: 100, CurrencyName: "TL" }] } });
      }
      if (u.includes("Proposals/Get")) {
        return response({ Data: {
          Id: 124,
          LastName: "TEST-124",
          Name: "Wrapper test",
          ParentProposal: { Id: 123 },
          RelatedEntity: { DisplayName: "Test Kurum" },
          EnteredDate: "2026-09-13T09:00:00Z",
          ModifiedDate: "2026-09-13T11:00:00Z",
          DiscountedTotal: 250,
          CurrencyName: "TL",
          Items: [{
            ItemId: 1,
            Quantity: 1,
            Price: 250,
            LineTotal: 250,
            Product: { Id: 99, Name: "Test Ürün", Sku: "TEST-99", ProductCategory: { Name: "Yedek Parça" } }
          }]
        } });
      }
      if (u.includes("Proposals/StatusLog")) {
        return response({ Data: { List: [{ Indate: "2026-09-13T10:30:00Z", Stage: { DisplayName: "Kabul edildi" } }] } });
      }
      throw new Error(`Unexpected URL: ${u}`);
    };

    const index = await fetchProposalIndexPage({ token: "test", domain: "test", page: 1, pageSize: 100 });
    assert.equal(index.count, 1);
    assert.equal(index.list.length, 1);
    assert.equal(index.fingerprints[0].id, 123);
    assert.ok(index.fingerprints[0].fingerprint);

    const bundle = await fetchProposalBundle({ token: "test", domain: "test", id: 124 });
    assert.equal(bundle.id, 124);
    assert.equal(bundle.parentProposalId, 123);
    assert.equal(bundle.offerRow.Id, 124);
    assert.equal(bundle.offerRow.ParentProposalId, 123);
    assert.equal(bundle.detailRows.length, 1);
    assert.equal(bundle.historyRows[0]["Aşama"], "Kabul edildi");
  } finally {
    global.fetch = originalFetch;
  }

  console.log("teamgram-proposals-sync-wrapper: PASS");
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
