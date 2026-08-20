# Reference Board and Generated Media Policy

Version: 1.0 · effective 2026-08-20 · owner: Eclipse Forge

This policy governs reference images, generated images, voices, likenesses, and other media used by Eclipse DnD Forge. It is a product safety contract, not a claim that an automated check can guarantee copyright, privacy, publicity-right, or trademark compliance.

## Scope and current boundary

- The Reference Board is a local planning surface. An `approved` reference means only that its basic provenance is complete enough for internal campaign work.
- Generated output, external publication, paid delivery, advertising, billing, and marketplace distribution require the separate `eclipse.reference-media-policy.v1` gate.
- `review-required` and `blocked` are fail-closed states: they cannot be treated as approval, exported for commercial use, sent to a generation provider, or used in marketing.
- The policy does not authorize network fetching, scraping, model training, biometric identification, or silent upload of local previews.

## Decision states

| State | Meaning | Permitted action |
|---|---|---|
| `allowed` | Required metadata is valid and no blocked/review condition is present. | Internal generation/use; commercial use only when its dedicated approval and product trademark clearance are both recorded. |
| `review-required` | Rights or person/trademark context needs a named human decision. | Local draft/quarantine only. No generation, public export, billing, marketing, or distribution. |
| `blocked` | A hard prohibition, active takedown, invalid metadata, or missing mandatory rights/consent exists. | Do not generate, publish, distribute, or restore. Keep only the minimum audit/takedown record required by this policy. |

Absence of a reason code never overrides a provider policy, applicable law, contract, or takedown instruction.

## Source rights

Allowed sources must have one documented basis:

- original work controlled by the contributor;
- a commission or written permission covering the intended use;
- a license whose scope covers the intended transformation and distribution;
- a verified public-domain source; or
- generated media with provider/model provenance and rights for the intended use.

Random web images, search-result thumbnails, social-media posts, screenshots from games/films/books, scraped collections, leaked assets, and “found online” material are `blocked` until an actual rights basis is documented. A URL identifies a source; it does not prove permission.

License/permission evidence is stored as a stable record ID. Credentials, identity documents, private contracts, and full consent files must not be embedded in exported board JSON or public provenance.

## Real people, consent, and biometric likeness

- A recognizable real person requires specific, documented consent for the exact medium, purpose, audience, duration, territory, and commercial/non-commercial use. General platform terms, public availability, or prior publication are not consent.
- Minors and subjects whose age/identity cannot be verified are `blocked` for generated likeness or voice work.
- Public figures are not consent-free. Their references are always `review-required`, even when a source image is licensed.
- Recognizable likenesses and voice clones are `review-required` after consent is documented. Consent can be withdrawn; withdrawal opens a takedown and blocks future generation.
- Biometric identification/verification, deceptive endorsement, impersonation/fraud, and sexualized real-person media are `blocked` even when a consent record is presented.
- Reference images and outputs must never be used to derive authentication templates, face embeddings, voiceprints, health traits, ethnicity, sexuality, political beliefs, or other sensitive inferences.

Fictional characters must not be represented as a real person without the same consent and likeness review.

## Derivative works and trademarks

- Substantial similarity to protected characters, settings, scenes, maps, prose, logos, trade dress, or signature assets is `blocked`; changing names or restyling does not cure copying.
- Prompts requesting a direct copy, “the same character/world,” official logos, or confusingly similar branding are `blocked`. Reference material may inform high-level functional constraints, not reproduce protected expression.
- Descriptive or incidental trademark use is `review-required` unless clearance is documented. Nothing may imply sponsorship, affiliation, or official status.
- The public product name “Eclipse DnD Forge” retains a separate trademark/branding risk. It must receive documented clearance before billing, paid distribution, or commercial marketing; this media policy does not resolve that decision.
- Official tabletop/VTT products may be research references only. Their code, UI design, text, maps, art, icons, characters, and assets are not source material for generated deliverables.

## Provenance metadata

Every generated or distributable asset must carry a validated metadata envelope containing:

- policy schema version and stable asset ID;
- source rights basis, commercial-use scope, source URL where applicable, and a rights-record ID;
- real-person category, consent status/record ID, biometric mode, and intended use;
- derivative/trademark risk and clearance record IDs;
- provider, model, creation timestamp, output SHA-256, and prompt SHA-256;
- commercial approval and product trademark-clearance status;
- raw-reference and provenance retention deadlines; and
- takedown status and case ID when quarantined/removed.

Store a prompt digest, not a public raw prompt containing personal or confidential data. A changed source, prompt, model, output, use, audience, or license scope requires a new decision; approvals are not inherited by derivatives.

## Retention and deletion

- Raw uploaded references: delete as soon as generation/review finishes, with an absolute maximum of 30 days.
- Blocked/rejected raw inputs: delete within 7 days unless preservation is required for an active dispute or security investigation.
- Local thumbnails follow the Reference Board lifecycle and are removed when the asset or board is deleted.
- Provenance and approval records: retain while an asset is active; for commercial distribution retain for three years after the last distribution or longer only when contract/law requires it.
- Consent evidence is kept in access-controlled storage, not browser export/localStorage. Retain only the record ID and scope summary in asset metadata.
- Takedown audit records: retain the minimum case metadata for three years; do not retain the removed media merely “for history.”

Retention exceptions need a named owner, reason, expiry, and access restriction. An exception never permits continued generation or publication.

## Takedown and withdrawal

1. Set the asset to `quarantined` immediately and stop generation, export, marketing, and distribution.
2. Record a case ID, claimant/contact channel, affected asset IDs/hashes, reason, and timestamps without copying unnecessary sensitive material.
3. Acknowledge receipt within one business day; target a documented decision within seven calendar days.
4. Remove confirmed infringing/non-consensual assets and downstream variants; notify known distributors where practical.
5. Preserve only the minimum evidence needed for the dispute. Restoration requires a new documented rights/consent review and never reuses the old approval silently.

## Commercial-use gate

Commercial use is `allowed` only when all of the following are true:

1. every source permits the exact commercial use and has a stable evidence record;
2. required person/biometric consent is documented and no categorical prohibition applies;
3. derivative/trademark review is clear, including product-name clearance;
4. the exact output and prompt digests match the reviewed item;
5. provider/model terms allow the planned use;
6. a named reviewer approved the asset and recorded scope/expiry; and
7. no takedown, withdrawal, or retention violation is active.

A pending, missing, expired, or rejected approval is not “temporarily allowed.”

## Risk assessment (NIST SP 800-30, Tier 3)

Scope: local Reference Board metadata and future generated-media handoff. Assessment is architecture-driven; no production media service or storage backend exists in this checkout.

| ID | Threat event | Likelihood | Impact | Inherent risk | Treatment/control | Residual risk |
|---|---|---:|---:|---|---|---|
| RM-01 | User imports an unlicensed work and publishes a close derivative. | High | High | High | Rights basis, derivative block, exact hashes, human commercial review. | Moderate |
| RM-02 | Real-person image/voice is used without valid specific consent. | Moderate | Very High | High | Minor/unknown block, consent record, biometric review, withdrawal/takedown. | Moderate |
| RM-03 | Generated media implies endorsement or enables impersonation. | Moderate | Very High | High | Categorical use block and no biometric verification/identity templates. | Low |
| RM-04 | Missing provenance makes a commercial claim unauditable. | High | High | High | Strict schema, exact fields, digests, approval record IDs, fail-closed state. | Low |
| RM-05 | Raw references or consent evidence are retained or exposed unnecessarily. | Moderate | High | Moderate | 30-day raw cap, 7-day blocked-input target, private evidence storage, minimization. | Low |
| RM-06 | Trademark/official-content use creates confusion or billing exposure. | Moderate | High | Moderate | Separate product-name clearance and blocked official assets/trade dress. | Moderate until clearance |

Reassess before adding remote upload/storage, provider-side generation, voice cloning, team sharing, public galleries, payments, or a new jurisdiction. Review this register at least quarterly while generated-media work is active.

## Implementation contract

- Runtime evaluator: `src/model/dnd/referenceMediaPolicy.ts`.
- Regression coverage: `tests/reference-media-policy.test.mjs`.
- The deny/review rules are regression guards, not legal guarantees.
- Current Reference Board V1 lacks the full commercial/biometric envelope. Its `approved` status must therefore remain internal and non-commercial until a separate policy decision is attached.
