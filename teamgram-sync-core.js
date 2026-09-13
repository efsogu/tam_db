"use strict";

const BASE_URL = "https://api.teamgram.com";
const DEFAULT_DOMAIN = "ozlmed";

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function retryAfterMs(response, fallback = 1200) {
  const raw = response?.headers?.get?.("retry-after");
  const seconds = Number(raw);
  return Number.isFinite(seconds) && seconds > 0 ? Math.min(seconds, 60) * 1000 : fallback;
}
function text(v) { return v == null ? "" : String(v).trim(); }
function positiveInt(v) { const n = Number(v); return Number.isSafeInteger(n) && n > 0 ? n : null; }
function first(...values) { for (const v of values) { if (v !== undefined && v !== null && text(v) !== "") return v; } return null; }
function displayEntity(v) {
  if (!v) return "";
  if (typeof v === "string" || typeof v === "number") return text(v);
  return text(first(v.DisplayName, v.Displayname, v.TradingName, v.CompanyName, [v.Name, v.LastName].filter(Boolean).join(" "), v.Name, v.LastName));
}
function stageText(v) {
  if (v == null) return "";
  if (typeof v === "string") return text(v);
  if (typeof v === "object") return text(first(v.DisplayName, v.Displayname, v.Name, v.Value, v.Stage));
  return text(v);
}
function statusEntries(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.List)) return payload.List;
  if (Array.isArray(payload?.StatusLog)) return payload.StatusLog;
  return [];
}
function timestamp(value) {
  const ms = Date.parse(value || "");
  return Number.isFinite(ms) ? ms : 0;
}
function orderedStatusEntries(payload) {
  return statusEntries(payload).filter(Boolean).slice().sort((a, b) => timestamp(a?.Indate ?? a?.Date) - timestamp(b?.Indate ?? b?.Date));
}
function latestStage(payload, proposal) {
  const rows = orderedStatusEntries(payload);
  for (let i = rows.length - 1; i >= 0; i--) {
    const value = stageText(rows[i]?.Stage);
    if (value) return value;
  }
  return stageText(first(proposal?.StageName, proposal?.Stage, proposal?.StatusName, proposal?.Status)) || "Belirsiz";
}
function proposalNo(p) { return text(first(p?.LastName, p?.No, p?.Number, p?.ReferenceNo, p?.DisplayName, p?.Displayname)); }
function proposalCustomer(p) { return displayEntity(first(p?.RelatedEntity, p?.Customer, p?.Company, p?.Attn)) || "-"; }
function proposalOwner(p) { return displayEntity(first(p?.Owner, p?.Responsible, p?.ResponsibleUser, p?.SubmittedBy, p?.EnteredBy, p?.EnteredByIndividual)) || "-"; }
function parentProposalId(p) { return positiveInt(first(p?.ParentProposalId, p?.ParentProposal?.Id, p?.ParentProposal?.id)); }
function itemProduct(item) { return item?.Product && typeof item.Product === "object" ? item.Product : {}; }
function productName(product, item) { return text(first(product?.Name, product?.DisplayName, product?.Displayname, item?.ProductName, item?.Name)) || "-"; }
function productCode(product, item) { return text(first(product?.Sku, product?.SKU, product?.Code, product?.ProductCode, item?.Sku, item?.SKU, item?.Code)) || "-"; }
function productModel(product, item) { return text(first(product?.ProdModel, product?.Model, item?.Model)) || ""; }
function productBrand(product, item) { return displayEntity(first(product?.Brand, item?.Brand)); }
function directCategory(product) { return text(first(product?.ProductCategory?.Name, product?.Category?.Name, product?.ProductCategoryName, product?.CategoryName)); }
function parentCategory(product) { return text(first(product?.ProductCategory?.Parent?.Name, product?.Category?.Parent?.Name, product?.MainCategoryName)); }

function fingerprintIndexRecord(record) {
  const compact = {
    id: positiveInt(record?.Id ?? record?.id),
    modified: first(record?.ModifiedDate, record?.StageChangeDate, record?.LastActivityDate, record?.UpdatedAt),
    stage: stageText(first(record?.Stage, record?.StageName, record?.Status)),
    total: Number(record?.DiscountedTotal ?? 0) || 0,
    currency: first(record?.CurrencyName, record?.Currency),
    parent: parentProposalId(record),
    items: Array.isArray(record?.Items) ? record.Items.map(i => [i?.ItemId, i?.Quantity, i?.Price, i?.LineTotal]) : undefined
  };
  return Buffer.from(JSON.stringify(compact)).toString("base64url");
}

function rowsForProposal(proposal, statusPayload) {
  const no = proposalNo(proposal);
  const id = positiveInt(proposal?.Id ?? proposal?.id);
  if (!id) throw new Error("proposal_id_missing");
  if (!no) throw new Error(`proposal_no_missing:${id}`);

  const history = orderedStatusEntries(statusPayload);
  const lastHistory = history.length ? history[history.length - 1] : null;
  const status = latestStage(history, proposal);
  const currency = text(first(proposal?.CurrencyName, proposal?.Currency)) || "TL";
  const offerRow = {
    "No": no,
    "Id": id,
    "ParentProposalId": parentProposalId(proposal),
    "Müşteri": proposalCustomer(proposal),
    "Konu": text(first(proposal?.Name, proposal?.DisplayName, proposal?.Displayname)) || "-",
    "Durum": status,
    "Yetki sahibi": proposalOwner(proposal),
    "Müşterinin yetki sahibi": displayEntity(first(proposal?.RelatedEntity?.Owner, proposal?.CustomerOwner)),
    "Oluşturma tarihi": first(proposal?.EnteredDate, proposal?.SubmitDate, proposal?.CreatedDate, proposal?.CreatedAt),
    "Son durum değişikliği": first(lastHistory?.Indate, proposal?.StageChangeDate, proposal?.ModifiedDate),
    "Güncelleme tarihi": first(proposal?.ModifiedDate, proposal?.LastActivityDate, proposal?.UpdatedAt),
    "Geçerlilik sonu": first(proposal?.ValidUntil, proposal?.ValidityDate, proposal?.ExpirationDate, proposal?.ExpireDate),
    "Vergi hariç toplam": Number(proposal?.DiscountedTotal ?? proposal?.Total ?? 0) || 0,
    "Vergi hariç çevrilmiş toplam": Number(first(proposal?.ConvertedDiscountedTotal, proposal?.DiscountedTotalConverted, proposal?.ConvertedTotal) ?? 0) || 0,
    "Para birimi": currency,
    "Çevrilmiş para birimi": text(first(proposal?.ConvertedCurrencyName, proposal?.ConvertedCurrency))
  };

  const items = Array.isArray(proposal?.Items) ? proposal.Items : [];
  const detailRows = items.map(item => {
    const product = itemProduct(item);
    const category = directCategory(product);
    const mainCategory = parentCategory(product) || category;
    const price = Number(item?.Price ?? item?.DiscountedPrice ?? 0) || 0;
    const quantity = Number(item?.Quantity ?? 0) || 0;
    const lineTotal = Number(item?.LineTotal ?? (price * quantity)) || 0;
    return {
      "No": no,
      "Id": id,
      "Ürün Id": positiveInt(product?.Id),
      "Ürün ismi": productName(product, item),
      "Ürün adı": productName(product, item),
      "Marka": productBrand(product, item),
      "Model": productModel(product, item),
      "Ürün kodu": productCode(product, item),
      "Ek bilgi": text(first(item?.Description, item?.ExtraInfo, item?.Note)),
      "Not": text(first(item?.Note, item?.Description)),
      "Alt kategori": category,
      "Ana kategori": mainCategory,
      "Miktar": quantity,
      "Birim fiyat": price,
      "Fiyat": price,
      "İndirimli fiyat": Number(item?.DiscountedPrice ?? price) || price,
      "Satır toplamı": lineTotal,
      "Para birimi": text(first(item?.CurrencyName, currency)) || currency,
      "Birim": text(first(item?.Unit, product?.Unit)),
      "%KDV": Number(item?.Vat ?? item?.VAT ?? product?.VAT ?? 0) || 0,
      "Birim maliyet": Number(item?.UnitCost ?? 0) || 0,
      "Birim maliyeti para birimi": text(first(item?.UnitCostCurrencyName, item?.CostCurrencyName)),
      "TeamGram ItemId": positiveInt(item?.ItemId),
      "TeamGram ProductId": positiveInt(product?.Id)
    };
  });

  let historyRows = history.map(entry => ({
    "Tip": "TeamGram",
    "Id": id,
    "No": no,
    "Ne zaman": first(entry?.Indate, entry?.Date, entry?.CreatedDate, entry?.StageChangeDate),
    "Kim": text(first(entry?.Who, displayEntity(entry?.User))),
    "Durum": "Taslak",
    "Aşama": stageText(entry?.Stage)
  }));
  if (!historyRows.length) {
    historyRows = [{
      "Tip": "TeamGram",
      "Id": id,
      "No": no,
      "Ne zaman": first(offerRow["Son durum değişikliği"], offerRow["Güncelleme tarihi"], offerRow["Oluşturma tarihi"], new Date().toISOString()),
      "Kim": proposalOwner(proposal),
      "Durum": "Taslak",
      "Aşama": status
    }];
  }

  return { offerRow, detailRows, historyRows };
}

async function fetchJson(url, token, { attempts = 5, timeoutMs = 20000 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    let response;
    try {
      response = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json", Token: token },
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs)
      });
    } catch (error) {
      lastError = error;
      if (attempt + 1 >= attempts) throw error;
      await sleep(500 * (attempt + 1));
      continue;
    }
    if (response.status === 429) {
      lastError = new Error("TeamGram rate limit");
      lastError.httpStatus = 429;
      lastError.retryAfter = response.headers.get("retry-after");
      if (attempt + 1 >= attempts) break;
      await sleep(retryAfterMs(response));
      continue;
    }
    const raw = await response.text();
    let payload;
    try { payload = raw ? JSON.parse(raw) : null; } catch { throw new Error(`TeamGram JSON dönmedi (HTTP ${response.status}).`); }
    if (!response.ok) {
      const err = new Error(`TeamGram HTTP ${response.status}`);
      err.httpStatus = response.status;
      err.retryAfter = response.headers.get("retry-after");
      throw err;
    }
    return payload;
  }
  throw lastError || new Error("TeamGram isteği başarısız");
}

function apiUrl(domain, path, params = {}) {
  const url = new URL(`/${domain}/${path}`, BASE_URL);
  Object.entries(params).forEach(([k,v]) => { if (v !== undefined && v !== null) url.searchParams.set(k, String(v)); });
  return url.toString();
}

async function fetchProposalIndexPage({ token, domain = DEFAULT_DOMAIN, page = 1, pageSize = 100, fid = 0 }) {
  const payload = await fetchJson(apiUrl(domain, "Proposals/Index", { page, pagesize: pageSize, letter: "", fid }), token);
  const list = Array.isArray(payload?.List) ? payload.List : Array.isArray(payload?.Proposals) ? payload.Proposals : [];
  const count = Number(payload?.ProposalCount ?? payload?.count ?? payload?.Count);
  return {
    page,
    pageSize,
    count: Number.isFinite(count) && count >= 0 ? count : null,
    list,
    fingerprints: list.map(record => ({ id: positiveInt(record?.Id ?? record?.id), fingerprint: fingerprintIndexRecord(record) }))
  };
}

async function fetchProposalBundle({ token, domain = DEFAULT_DOMAIN, id }) {
  id = positiveInt(id);
  if (!id) throw new Error("invalid_proposal_id");
  const [proposal, status] = await Promise.all([
    fetchJson(apiUrl(domain, "Proposals/Get", { id }), token),
    fetchJson(apiUrl(domain, "Proposals/StatusLog", { id }), token)
  ]);
  const rows = rowsForProposal(proposal, status);
  return { id, parentProposalId: parentProposalId(proposal), proposal, status, ...rows };
}

module.exports = {
  DEFAULT_DOMAIN,
  positiveInt,
  stageText,
  statusEntries,
  orderedStatusEntries,
  latestStage,
  parentProposalId,
  fingerprintIndexRecord,
  rowsForProposal,
  fetchJson,
  fetchProposalIndexPage,
  fetchProposalBundle
};
