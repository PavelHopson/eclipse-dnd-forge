export const REFERENCE_MEDIA_POLICY_SCHEMA = "eclipse.reference-media-policy.v1" as const;
export const MAX_RAW_REFERENCE_RETENTION_DAYS = 30;

export type ReferenceMediaGateState = "allowed" | "review-required" | "blocked";

export type ReferenceMediaGateReason =
    | "invalid-metadata"
    | "source-rights-unverified"
    | "commercial-source-rights-missing"
    | "real-person-consent-missing"
    | "minor-or-unknown-subject"
    | "biometric-review-required"
    | "public-figure-review-required"
    | "derivative-risk-blocked"
    | "trademark-clearance-missing"
    | "commercial-approval-required"
    | "commercial-use-rejected"
    | "product-trademark-clearance-required"
    | "retention-limit-exceeded"
    | "takedown-active";

export type ReferenceMediaGateInput = {
    schemaVersion: typeof REFERENCE_MEDIA_POLICY_SCHEMA;
    assetId: string;
    source: {
        rightsBasis: "original" | "licensed" | "public-domain" | "written-permission" | "unverified";
        commercialUseAllowed: boolean;
        rightsRecordId: string | null;
        sourceUrl: string | null;
    };
    subject: {
        kind: "none" | "adult-private" | "public-figure" | "minor" | "unknown";
        consent: "not-applicable" | "documented-specific" | "missing";
        consentRecordId: string | null;
        biometricMode: "none" | "recognizable-likeness" | "voice-clone";
    };
    ipRisk: {
        derivativeRisk: "none" | "incidental" | "substantial-similarity";
        trademarkUse: "none" | "descriptive" | "prominent-branding";
        trademarkClearance: "not-applicable" | "documented" | "missing";
        trademarkRecordId: string | null;
    };
    generation: {
        provider: string;
        model: string;
        outputSha256: string;
        promptSha256: string;
        createdAt: string;
    };
    commercialUse: {
        requested: boolean;
        approval: "not-requested" | "pending" | "approved" | "rejected";
        approvalRecordId: string | null;
        productTrademarkStatus: "not-requested" | "pending" | "cleared" | "rejected";
        productTrademarkRecordId: string | null;
    };
    retention: {
        rawReferenceDeleteAt: string | null;
        provenanceDeleteAt: string | null;
    };
    takedown: {
        status: "active" | "quarantined" | "removed";
        caseId: string | null;
    };
};

export type ReferenceMediaGateDecision = {
    state: ReferenceMediaGateState;
    reasons: ReferenceMediaGateReason[];
};

const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: string[]): boolean {
    const actual = Object.keys(value).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function isEnum<T extends string>(value: unknown, values: readonly T[]): value is T {
    return typeof value === "string" && values.includes(value as T);
}

function isBoundedText(value: unknown, maxLength: number): value is string {
    return typeof value === "string" && value.trim() === value && value.length > 0 && value.length <= maxLength;
}

function isNullableSafeId(value: unknown): value is string | null {
    return value === null || (typeof value === "string" && SAFE_ID.test(value));
}

function isNullableTimestamp(value: unknown): value is string | null {
    return value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
}

function isSafeSourceUrl(value: unknown): value is string | null {
    if (value === null) return true;
    if (typeof value !== "string" || value.length > 2048) return false;
    try {
        return new URL(value).protocol === "https:";
    } catch {
        return false;
    }
}

function isValidInput(value: unknown): value is ReferenceMediaGateInput {
    if (!isRecord(value) || !hasExactKeys(value, [
        "schemaVersion", "assetId", "source", "subject", "ipRisk", "generation", "commercialUse", "retention", "takedown",
    ])) return false;
    if (value.schemaVersion !== REFERENCE_MEDIA_POLICY_SCHEMA || typeof value.assetId !== "string" || !SAFE_ID.test(value.assetId)) return false;

    const source = value.source;
    if (!isRecord(source) || !hasExactKeys(source, ["rightsBasis", "commercialUseAllowed", "rightsRecordId", "sourceUrl"])) return false;
    if (!isEnum(source.rightsBasis, ["original", "licensed", "public-domain", "written-permission", "unverified"])) return false;
    if (typeof source.commercialUseAllowed !== "boolean" || !isNullableSafeId(source.rightsRecordId) || !isSafeSourceUrl(source.sourceUrl)) return false;

    const subject = value.subject;
    if (!isRecord(subject) || !hasExactKeys(subject, ["kind", "consent", "consentRecordId", "biometricMode"])) return false;
    if (!isEnum(subject.kind, ["none", "adult-private", "public-figure", "minor", "unknown"])) return false;
    if (!isEnum(subject.consent, ["not-applicable", "documented-specific", "missing"])) return false;
    if (!isNullableSafeId(subject.consentRecordId) || !isEnum(subject.biometricMode, ["none", "recognizable-likeness", "voice-clone"])) return false;

    const ipRisk = value.ipRisk;
    if (!isRecord(ipRisk) || !hasExactKeys(ipRisk, ["derivativeRisk", "trademarkUse", "trademarkClearance", "trademarkRecordId"])) return false;
    if (!isEnum(ipRisk.derivativeRisk, ["none", "incidental", "substantial-similarity"])) return false;
    if (!isEnum(ipRisk.trademarkUse, ["none", "descriptive", "prominent-branding"])) return false;
    if (!isEnum(ipRisk.trademarkClearance, ["not-applicable", "documented", "missing"]) || !isNullableSafeId(ipRisk.trademarkRecordId)) return false;

    const generation = value.generation;
    if (!isRecord(generation) || !hasExactKeys(generation, ["provider", "model", "outputSha256", "promptSha256", "createdAt"])) return false;
    if (!isBoundedText(generation.provider, 80) || !isBoundedText(generation.model, 120)) return false;
    if (typeof generation.outputSha256 !== "string" || !SHA256.test(generation.outputSha256)) return false;
    if (typeof generation.promptSha256 !== "string" || !SHA256.test(generation.promptSha256)) return false;
    if (typeof generation.createdAt !== "string" || !Number.isFinite(Date.parse(generation.createdAt))) return false;

    const commercialUse = value.commercialUse;
    if (!isRecord(commercialUse) || !hasExactKeys(commercialUse, [
        "requested", "approval", "approvalRecordId", "productTrademarkStatus", "productTrademarkRecordId",
    ])) return false;
    if (typeof commercialUse.requested !== "boolean") return false;
    if (!isEnum(commercialUse.approval, ["not-requested", "pending", "approved", "rejected"])) return false;
    if (!isNullableSafeId(commercialUse.approvalRecordId)) return false;
    if (!isEnum(commercialUse.productTrademarkStatus, ["not-requested", "pending", "cleared", "rejected"])) return false;
    if (!isNullableSafeId(commercialUse.productTrademarkRecordId)) return false;

    const retention = value.retention;
    if (!isRecord(retention) || !hasExactKeys(retention, ["rawReferenceDeleteAt", "provenanceDeleteAt"])) return false;
    if (!isNullableTimestamp(retention.rawReferenceDeleteAt) || !isNullableTimestamp(retention.provenanceDeleteAt)) return false;

    const takedown = value.takedown;
    if (!isRecord(takedown) || !hasExactKeys(takedown, ["status", "caseId"])) return false;
    return isEnum(takedown.status, ["active", "quarantined", "removed"]) && isNullableSafeId(takedown.caseId);
}

function addReason(reasons: ReferenceMediaGateReason[], reason: ReferenceMediaGateReason): void {
    if (!reasons.includes(reason)) reasons.push(reason);
}

export function evaluateReferenceMediaGate(value: unknown): ReferenceMediaGateDecision {
    if (!isValidInput(value)) return { state: "blocked", reasons: ["invalid-metadata"] };

    const blocked: ReferenceMediaGateReason[] = [];
    const review: ReferenceMediaGateReason[] = [];

    if (value.source.rightsBasis === "unverified") addReason(blocked, "source-rights-unverified");
    if (["licensed", "written-permission"].includes(value.source.rightsBasis) && !value.source.rightsRecordId) {
        addReason(blocked, "source-rights-unverified");
    }
    if (value.source.rightsBasis === "public-domain" && !value.source.sourceUrl) addReason(blocked, "source-rights-unverified");

    if (value.subject.kind === "minor" || value.subject.kind === "unknown") {
        addReason(blocked, "minor-or-unknown-subject");
    } else if (value.subject.kind !== "none") {
        if (value.subject.consent !== "documented-specific" || !value.subject.consentRecordId) {
            addReason(blocked, "real-person-consent-missing");
        }
        if (value.subject.kind === "public-figure") addReason(review, "public-figure-review-required");
        if (value.subject.biometricMode !== "none") addReason(review, "biometric-review-required");
    } else if (value.subject.consent !== "not-applicable" || value.subject.consentRecordId || value.subject.biometricMode !== "none") {
        addReason(blocked, "invalid-metadata");
    }

    if (value.ipRisk.derivativeRisk === "substantial-similarity") addReason(blocked, "derivative-risk-blocked");
    if (value.ipRisk.trademarkUse !== "none") {
        if (value.ipRisk.trademarkClearance !== "documented" || !value.ipRisk.trademarkRecordId) {
            addReason(review, "trademark-clearance-missing");
        }
    } else if (value.ipRisk.trademarkClearance !== "not-applicable" || value.ipRisk.trademarkRecordId) {
        addReason(blocked, "invalid-metadata");
    }

    if (value.commercialUse.requested) {
        if (!value.source.commercialUseAllowed) addReason(blocked, "commercial-source-rights-missing");
        if (value.commercialUse.approval === "rejected") addReason(blocked, "commercial-use-rejected");
        if (value.commercialUse.approval !== "approved" || !value.commercialUse.approvalRecordId) {
            addReason(review, "commercial-approval-required");
        }
        if (value.commercialUse.productTrademarkStatus === "rejected") {
            addReason(blocked, "product-trademark-clearance-required");
        } else if (value.commercialUse.productTrademarkStatus !== "cleared" || !value.commercialUse.productTrademarkRecordId) {
            addReason(review, "product-trademark-clearance-required");
        }
    } else if (value.commercialUse.approval !== "not-requested" || value.commercialUse.approvalRecordId) {
        addReason(blocked, "invalid-metadata");
    }

    if (value.retention.rawReferenceDeleteAt) {
        const createdAt = Date.parse(value.generation.createdAt);
        const deleteAt = Date.parse(value.retention.rawReferenceDeleteAt);
        if (deleteAt < createdAt || deleteAt - createdAt > MAX_RAW_REFERENCE_RETENTION_DAYS * DAY_MS) {
            addReason(blocked, "retention-limit-exceeded");
        }
    }
    if (value.retention.provenanceDeleteAt && Date.parse(value.retention.provenanceDeleteAt) < Date.parse(value.generation.createdAt)) {
        addReason(blocked, "retention-limit-exceeded");
    }

    if (value.takedown.status !== "active") addReason(blocked, "takedown-active");
    if (value.takedown.status !== "active" && !value.takedown.caseId) addReason(blocked, "invalid-metadata");

    if (blocked.length > 0) return { state: "blocked", reasons: [...blocked, ...review] };
    if (review.length > 0) return { state: "review-required", reasons: review };
    return { state: "allowed", reasons: [] };
}
