import assert from "node:assert/strict";
import { deliveryFor } from "../src/contract-sign.ts";

const delivery = deliveryFor("asset-7", "https://download.example/signed");
assert.equal(delivery.objectKey, "contracts/asset-7/signed.pdf");
assert.equal(delivery.expiresSeconds, 900);
assert.equal(delivery.downloadUrl, "https://download.example/signed");
console.log("creator delivery decision: signed PDF uses an asset-scoped key and a 900-second link");
