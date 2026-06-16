const crypto = require("node:crypto");

// WireGuard keys are raw 32-byte X25519 keys, base64-encoded. Node's DER
// encodings wrap that raw key in a small fixed-length ASN.1 header for the
// x25519 algorithm, so we generate via crypto and strip the header.
function generateKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519", {
    publicKeyEncoding: { type: "spki", format: "der" },
    privateKeyEncoding: { type: "pkcs8", format: "der" },
  });

  // SPKI DER for X25519 public keys: fixed 12-byte header + 32-byte raw key.
  const rawPublicKey = publicKey.subarray(publicKey.length - 32);
  // PKCS8 DER for X25519 private keys: fixed 16-byte header + 32-byte raw key.
  const rawPrivateKey = privateKey.subarray(privateKey.length - 32);

  return {
    publicKey: rawPublicKey.toString("base64"),
    privateKey: rawPrivateKey.toString("base64"),
  };
}

module.exports = { generateKeyPair };
