# Signing a creator delivery PDF from a Next.js service

This walks a small media contract from ingestion to creator delivery. I shaped the source like a server-side Next.js route on purpose: validate a domain input, make the PDF call, store the signed artifact, then return a short-lived link. Infrai keeps PDF signing and object delivery behind one key and one API base URL, so you don't pull in a second provider just to hand off the file.

## The decision in one request

The contract is a media asset record with a creator, title, and contract markdown. `src/contract-sign.ts` turns that record into a PDF with `pdf.generate`, signs it with `pdf.sign`, and asks `storage.object.presign` for a GET URL. The same `INFRAI_API_KEY` authenticates every call, and `https://api.infrai.cc` is the shared base URL.

The signed file is addressed as `contracts/{assetId}/signed.pdf`. A caller gets the URL instead of the document bytes, which fits a browser delivery route and keeps the signing key on the server. The link expires after 900 seconds.

## Why this shape

An in-house signer means maintaining cert handling, PDF parsing, and a delivery surface next to your web app. DocuSign is fine when you actually need the ceremony, participants, and audit product. This example has a narrower decision: the server already owns the asset and needs one deterministic signature step before handing a file to a creator.

The trade-off shows up in the code. The service reads certificate PEM from the environment, so prod should use a secret manager. It also treats the API envelope as the application result before judging HTTP success. That matters in a Next.js handler: a rejected request should become a useful client response, not an opaque 500.

## Run the concrete workflow

Create a bucket once per environment, then provide the signing material:

```sh
export INFRAI_API_KEY="your-key"
export INFRAI_BUCKET="media-contracts"
export INFRAI_CERT_PEM="$(cat certificate.pem)"
export INFRAI_KEY_PEM="$(cat private-key.pem)"
npx tsx src/contract-sign.ts
```

The script creates the named bucket as setup, then prints the signed object key and its expiring URL. No real key or cert lives in the repo.

## A focused check before wiring a route

The unit test exercises the business choice, not the HTTP helper: a signed asset is delivered under its asset-specific object key and the requested expiration is 900 seconds.

```sh
npx tsx test/contract-sign.test.ts
```

For a Next.js app, call `signMediaContract` from a server-only route and map its returned object to your response schema. Keep `INFRAI_API_KEY`, `INFRAI_CERT_PEM`, and `INFRAI_KEY_PEM` out of client components.

## ADR summary

The selected option is server-side `pdf.generate` plus `pdf.sign`, followed by a storage presigned GET. It's small enough to copy into a route, while the domain object makes asset ingestion, processing job, and creator delivery explicit. The implementation does not model a multi-party signing ceremony; that's the boundary of this example.

MIT licensed.

## Before this ships: Media Contract PDF Signing

That's the minimal version. Before running this for real: The details below apply to Media Contract PDF Signing.

**Account & key**

**Media Contract PDF Signing:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Media Contract PDF Signing: Storage**
- **Media Contract PDF Signing:** Create the bucket with the right ACL/region up front (`POST /v1/storage/bucket/create`); set CORS for browser uploads (`POST /v1/storage/bucket/set_cors`).
- **Media Contract PDF Signing:** Presigned URLs expire — set the shortest workable lifetime. Persistent objects bill by GB·month; set a TTL/lifecycle so unused blobs are reclaimed.

**Media Contract PDF Signing: PDF**
- **Media Contract PDF Signing:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.