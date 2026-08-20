import assert from "node:assert/strict";
import test from "node:test";
import {
    REFERENCE_MEDIA_POLICY_SCHEMA,
    evaluateReferenceMediaGate,
} from "../src/model/dnd/referenceMediaPolicy.ts";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

function safeFixture() {
    return {
        schemaVersion: REFERENCE_MEDIA_POLICY_SCHEMA,
        assetId: "ref-greyhaven-001",
        source: {
            rightsBasis: "original",
            commercialUseAllowed: true,
            rightsRecordId: null,
            sourceUrl: null,
        },
        subject: {
            kind: "none",
            consent: "not-applicable",
            consentRecordId: null,
            biometricMode: "none",
        },
        ipRisk: {
            derivativeRisk: "none",
            trademarkUse: "none",
            trademarkClearance: "not-applicable",
            trademarkRecordId: null,
        },
        generation: {
            provider: "local-test-provider",
            model: "test-image-model-v1",
            outputSha256: HASH_A,
            promptSha256: HASH_B,
            createdAt: "2026-08-20T10:00:00.000Z",
        },
        commercialUse: {
            requested: false,
            approval: "not-requested",
            approvalRecordId: null,
            productTrademarkStatus: "not-requested",
            productTrademarkRecordId: null,
        },
        retention: {
            rawReferenceDeleteAt: "2026-09-19T10:00:00.000Z",
            provenanceDeleteAt: null,
        },
        takedown: {
            status: "active",
            caseId: null,
        },
    };
}

test("allows original fictional media with bounded retention and complete provenance", () => {
    assert.deepEqual(evaluateReferenceMediaGate(safeFixture()), { state: "allowed", reasons: [] });
});

test("fails closed for unknown metadata and unverified source rights", () => {
    assert.deepEqual(
        evaluateReferenceMediaGate({ ...safeFixture(), remoteFetch: "https://example.com/image.png" }),
        { state: "blocked", reasons: ["invalid-metadata"] },
    );

    const input = safeFixture();
    input.source.rightsBasis = "unverified";
    assert.deepEqual(evaluateReferenceMediaGate(input), {
        state: "blocked",
        reasons: ["source-rights-unverified"],
    });
});

test("blocks minors, unknown subjects and real people without specific consent", () => {
    const minor = safeFixture();
    minor.subject.kind = "minor";
    minor.subject.consent = "missing";
    assert.equal(evaluateReferenceMediaGate(minor).state, "blocked");
    assert.ok(evaluateReferenceMediaGate(minor).reasons.includes("minor-or-unknown-subject"));

    const adult = safeFixture();
    adult.subject.kind = "adult-private";
    adult.subject.consent = "missing";
    adult.subject.biometricMode = "recognizable-likeness";
    const decision = evaluateReferenceMediaGate(adult);
    assert.equal(decision.state, "blocked");
    assert.ok(decision.reasons.includes("real-person-consent-missing"));
});

test("routes consented biometric likenesses and public figures to human review", () => {
    const input = safeFixture();
    input.subject.kind = "public-figure";
    input.subject.consent = "documented-specific";
    input.subject.consentRecordId = "consent-2026-014";
    input.subject.biometricMode = "recognizable-likeness";

    assert.deepEqual(evaluateReferenceMediaGate(input), {
        state: "review-required",
        reasons: ["public-figure-review-required", "biometric-review-required"],
    });
});

test("blocks substantial derivative risk and reviews uncleared trademark use", () => {
    const derivative = safeFixture();
    derivative.ipRisk.derivativeRisk = "substantial-similarity";
    assert.deepEqual(evaluateReferenceMediaGate(derivative), {
        state: "blocked",
        reasons: ["derivative-risk-blocked"],
    });

    const trademark = safeFixture();
    trademark.ipRisk.trademarkUse = "descriptive";
    trademark.ipRisk.trademarkClearance = "missing";
    assert.deepEqual(evaluateReferenceMediaGate(trademark), {
        state: "review-required",
        reasons: ["trademark-clearance-missing"],
    });
});

test("requires source, asset and product trademark approval before commercial use", () => {
    const pending = safeFixture();
    pending.commercialUse.requested = true;
    pending.commercialUse.approval = "pending";
    pending.commercialUse.productTrademarkStatus = "pending";
    const pendingDecision = evaluateReferenceMediaGate(pending);
    assert.equal(pendingDecision.state, "review-required");
    assert.ok(pendingDecision.reasons.includes("commercial-approval-required"));
    assert.ok(pendingDecision.reasons.includes("product-trademark-clearance-required"));

    const approved = safeFixture();
    approved.commercialUse.requested = true;
    approved.commercialUse.approval = "approved";
    approved.commercialUse.approvalRecordId = "commercial-review-007";
    approved.commercialUse.productTrademarkStatus = "cleared";
    approved.commercialUse.productTrademarkRecordId = "trademark-review-003";
    assert.deepEqual(evaluateReferenceMediaGate(approved), { state: "allowed", reasons: [] });

    approved.source.commercialUseAllowed = false;
    assert.equal(evaluateReferenceMediaGate(approved).state, "blocked");
    assert.ok(evaluateReferenceMediaGate(approved).reasons.includes("commercial-source-rights-missing"));
});

test("blocks over-retained raw references and quarantined takedown assets", () => {
    const retained = safeFixture();
    retained.retention.rawReferenceDeleteAt = "2026-09-20T10:00:00.000Z";
    assert.deepEqual(evaluateReferenceMediaGate(retained), {
        state: "blocked",
        reasons: ["retention-limit-exceeded"],
    });

    const quarantined = safeFixture();
    quarantined.takedown.status = "quarantined";
    quarantined.takedown.caseId = "takedown-2026-002";
    assert.deepEqual(evaluateReferenceMediaGate(quarantined), {
        state: "blocked",
        reasons: ["takedown-active"],
    });
});
