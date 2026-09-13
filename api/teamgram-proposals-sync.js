"use strict";

const {
  DEFAULT_DOMAIN,
  positiveInt,
  fetchProposalIndexPage,
  fetchProposalBundle
} = require("../teamgram-sync-core");

function tokenFromEnv() { return process.env.TEAMGRAM_API_TOKEN || process.env.TEAMGRAM_TOKEN || ""; }
function headers(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}
function publicBundle(bundle) {
  return {
    id: bundle.id,
    parentProposalId: bundle.parentProposalId,
    offerRow: bundle.offerRow,
    detailRows: bundle.detailRows,
    historyRows: bundle.historyRows
  };
}

module.exports = async function handler(req, res) {
  headers(res);
  if (req.method !== "GET") { res.setHeader("Allow", "GET"); return res.status(405).json({ ok:false, error:"method_not_allowed" }); }
  const token = tokenFromEnv();
  const domain = String(process.env.TEAMGRAM_DOMAIN || DEFAULT_DOMAIN).trim() || DEFAULT_DOMAIN;
  if (String(req.query?.health || "") === "1") {
    return res.status(200).json({ ok:true, configured:Boolean(token), domain, secretExposed:false, modes:["index","detail"] });
  }
  if (!token) return res.status(503).json({ ok:false, error:"teamgram_token_not_configured" });

  const action = String(req.query?.action || "index").trim().toLowerCase();
  try {
    if (action === "index") {
      const page = Math.max(1, Math.min(10000, Number(req.query?.page) || 1));
      const pageSize = Math.max(1, Math.min(100, Number(req.query?.pageSize || req.query?.pagesize) || 100));
      const fid = Math.max(0, Number(req.query?.fid) || 0);
      const result = await fetchProposalIndexPage({ token, domain, page, pageSize, fid });
      return res.status(200).json({
        ok:true,
        fetchedAt:new Date().toISOString(),
        page:result.page,
        pageSize:result.pageSize,
        count:result.count,
        returned:result.list.length,
        fingerprints:result.fingerprints
      });
    }
    if (action === "detail") {
      const id = positiveInt(req.query?.id);
      if (!id) return res.status(400).json({ ok:false, error:"invalid_id" });
      const record = publicBundle(await fetchProposalBundle({ token, domain, id }));
      return res.status(200).json({ ok:true, fetchedAt:new Date().toISOString(), record });
    }
    return res.status(400).json({ ok:false, error:"invalid_action" });
  } catch (error) {
    const status = Number(error?.httpStatus) || 502;
    if (error?.retryAfter) res.setHeader("Retry-After", String(error.retryAfter));
    return res.status(status).json({
      ok:false,
      error:"teamgram_proposal_sync_failed",
      message:error?.message || "request_failed",
      retryAfter:error?.retryAfter || null,
      secretExposed:false
    });
  }
};
