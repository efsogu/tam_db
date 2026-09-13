"use strict";

const assert = require("node:assert/strict");
const {
  parentProposalId,
  latestStage,
  fingerprintIndexRecord,
  rowsForProposal
} = require("../teamgram-sync-core");

const revision = {
  Id: 29533411,
  LastName: "21056",
  Name: "Test test Teklifi - Revizyon",
  RelatedEntity: { DisplayName: "Test Hastanesi" },
  Owner: { Name: "Erdem", LastName: "Gunt" },
  EnteredDate: "2026-09-13T12:00:00Z",
  ModifiedDate: "2026-09-13T13:00:00Z",
  CurrencyName: "TL",
  DiscountedTotal: 25700,
  ParentProposal: { Id: 29533385, Name: "Original" },
  Items: [{
    ItemId: 1,
    Product: { Id: 9, Name: "3-lead ECG Cable, IEC", SKU: "901100003", Brand:{Name:"ZOLL"}, Model:"M2", ProductCategory:{Name:"Defibrilatör Sarf",Parent:{Name:"VSD"}} },
    Quantity: 2,
    Price: 12850,
    LineTotal: 25700,
    CurrencyName: "TL",
    Unit: "ADET",
    Description: "M2 uyumlu",
    Vat: 10,
    UnitCost: 500,
    UnitCostCurrencyName: "USD"
  }]
};
const logs = [
  { Indate:"2026-09-13T12:10:00Z", Who:"Erdem Gunt", Stage:"Final" },
  { Indate:"2026-09-13T13:10:00Z", Who:"Erdem Gunt", Stage:"Kabul edildi" }
];

assert.equal(parentProposalId(revision), 29533385);
assert.equal(latestStage(logs, revision), "Kabul edildi");
const mapped = rowsForProposal(revision, logs);
assert.equal(mapped.offerRow.Id, 29533411);
assert.equal(mapped.offerRow.ParentProposalId, 29533385);
assert.equal(mapped.offerRow.No, "21056");
assert.equal(mapped.offerRow.Durum, "Kabul edildi");
assert.equal(mapped.detailRows.length, 1);
assert.equal(mapped.detailRows[0]["Ürün kodu"], "901100003");
assert.equal(mapped.detailRows[0]["Miktar"], 2);
assert.equal(mapped.detailRows[0]["Fiyat"], 12850);
assert.equal(mapped.detailRows[0]["Satır toplamı"], 25700);
assert.equal(mapped.detailRows[0]["Ana kategori"], "VSD");
assert.equal(mapped.detailRows[0]["Alt kategori"], "Defibrilatör Sarf");
assert.equal(mapped.historyRows.at(-1)["Aşama"], "Kabul edildi");

const standalone = { ...revision, Id:29533385, LastName:"21055", ParentProposal:null, Items:[] };
assert.equal(parentProposalId(standalone), null);
const noHistory = rowsForProposal(standalone, []);
assert.equal(noHistory.historyRows.length, 1);
assert.ok(noHistory.historyRows[0]["Ne zaman"]);

const fp1 = fingerprintIndexRecord({ Id:1, ModifiedDate:"2026-01-01", Stage:"Final", DiscountedTotal:100, CurrencyName:"TL" });
const fp2 = fingerprintIndexRecord({ Id:1, ModifiedDate:"2026-01-02", Stage:"Final", DiscountedTotal:100, CurrencyName:"TL" });
const fp3 = fingerprintIndexRecord({ Id:1, ModifiedDate:"2026-01-01", Stage:"Kabul edildi", DiscountedTotal:100, CurrencyName:"TL" });
assert.notEqual(fp1, fp2);
assert.notEqual(fp1, fp3);

console.log("teamgram sync core tests: PASS");
