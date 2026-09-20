"use strict";
const fs = require("fs");
const path = require("path");
const root = __dirname;
const dist = path.join(root, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
fs.copyFileSync(path.join(root, "index.html"), path.join(dist, "index.html"));
fs.writeFileSync(path.join(dist, "deploy-proof.json"), JSON.stringify({
  ok: true,
  project: "PRJ-026",
  mode: "read-only-pilot",
  buildTime: new Date().toISOString()
}, null, 2));
console.log("PRJ-026 web pilot build PASS");
