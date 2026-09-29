import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CONFIG, normalizeConfig, resolveJevEndpoint } from "../src/config.js";

test("old service settings migrate to direct TypeSafe without reusing credentials", () => {
  const old = structuredClone(DEFAULT_CONFIG);
  old.jev.endpoint = "https://jev-api.org/api/v1/decisions";
  old.jev.model = "jev-1.13";
  const migrated = normalizeConfig(old);
  assert.equal(migrated.jev.endpoint, "https://api.typesafe.ai/v1/systemone");
  assert.equal(migrated.jev.model, "jev-1.13.0");
  assert.equal(resolveJevEndpoint(old), migrated.jev.endpoint);
  assert.equal(normalizeConfig({}).jev.model, "jev-1.13.0");
});
