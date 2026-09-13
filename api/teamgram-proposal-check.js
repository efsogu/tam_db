"use strict";

const {
  normalizeProposal
} = require("../teamgram-proposal-normalizer");

const BASE_URL = "https://api.teamgram.com";
const DEFAULT_DOMAIN = "ozlmed";

function tokenFromEnv() {
  return process.env.TEAMGRAM_API_TOKEN || process.env.TEAMGRAM_TOKEN || "";
}

function setHeaders(res) {
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
}

function positiveId(value) {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function fetchProposal(id, token, domain) {
  const url = new URL(`/${domain}/Proposals/Get`, BASE_URL);
  url.searchParams.set("id", String(id));

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Token: token
    },
    cache: "no-store",
    signal: AbortSignal.timeout(15000)
  });

  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }

  if (!response.ok) {
    const error = new Error(`TeamGram HTTP ${response.status}`);
    error.httpStatus = response.status;
    error.retryAfter = response.headers.get("retry-after");
    throw error;
  }

  if (!body || typeof body !== "object") {
    throw new Error("TeamGram response is not valid JSON");
  }

  return body;
}

module.exports = async function handler(req, res) {
  setHeaders(res);

  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  const token = tokenFromEnv();
  const domain = String(process.env.TEAMGRAM_DOMAIN || DEFAULT_DOMAIN).trim() || DEFAULT_DOMAIN;

  if (String(req.query?.health || "") === "1") {
    return res.status(200).json({
      ok: true,
      configured: Boolean(token),
      domain,
      endpoint: "Proposals/Get",
      secretExposed: false
    });
  }

  if (!token) {
    return res.status(503).json({
      ok: false,
      error: "teamgram_token_not_configured"
    });
  }

  const id = positiveId(req.query?.id);
  if (!id) {
    return res.status(400).json({ ok: false, error: "invalid_id" });
  }

  try {
    const raw = await fetchProposal(id, token, domain);
    const normalized = normalizeProposal(raw, { requireEnrichedParentField: true });
    return res.status(200).json({
      ok: true,
      checkedAt: new Date().toISOString(),
      proposal: {
        id: normalized.id,
        no: normalized.no,
        name: normalized.name,
        parentProposalId: normalized.parentProposalId,
        isRevision: normalized.isRevision,
        parentFieldEnriched: normalized.parentFieldEnriched,
        modifiedAt: normalized.modifiedAt,
        stage: normalized.stage,
        currency: normalized.currency,
        discountedTotal: normalized.discountedTotal,
        itemCount: normalized.itemCount
      }
    });
  } catch (error) {
    const upstreamStatus = Number(error?.httpStatus) || null;
    const status = upstreamStatus && upstreamStatus >= 400 && upstreamStatus < 600 ? upstreamStatus : 502;
    return res.status(status).json({
      ok: false,
      error: "teamgram_proposal_check_failed",
      upstreamStatus,
      retryAfter: error?.retryAfter || null,
      message: error?.message || "request_failed"
    });
  }
};
