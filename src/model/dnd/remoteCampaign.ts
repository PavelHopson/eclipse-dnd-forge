import { dndApiJson } from "../auth/dndSession";
import type { SharedTableAction, SharedTableScene, SharedTableSnapshot } from "./sharedTableContract";

export type RemoteCampaignRole = "owner" | "co_dm" | "player" | "viewer";

export type RemoteCampaignProjection = {
    schemaVersion: string;
    campaignId: string;
    title: string;
    revision: number;
    updatedAt: number;
    role: RemoteCampaignRole;
    scene: SharedTableScene;
    actions: SharedTableAction[];
    initiative: Array<{ id: string; name: string; value: number; active: boolean }>;
    characters: Array<{ characterId: string; name: string; summary: string; hp: number; initiative: number }>;
    members?: Array<{ displayName: string; role: RemoteCampaignRole; joinedAt: number }>;
    privateNotes?: Array<{ text: string; createdAt: number }>;
};

export function remoteToSharedTable(campaign: RemoteCampaignProjection): SharedTableSnapshot {
    return {
        schemaVersion: "eclivarium.shared-table.v1",
        roomId: campaign.campaignId,
        title: campaign.title,
        scene: campaign.scene,
        actions: campaign.actions,
        revision: campaign.revision,
        updatedAt: campaign.updatedAt,
        role: campaign.role === "owner" || campaign.role === "co_dm" ? "master" : "player",
        initiative: campaign.initiative,
        characters: campaign.characters,
    };
}

export function remoteCampaignUrl(campaignId: string, inviteToken?: string): string {
    const params = new URLSearchParams({ campaignId });
    if (inviteToken) params.set("invite", inviteToken);
    params.set("role", inviteToken ? "player" : "master");
    return `${window.location.origin}${window.location.pathname}#/party?${params.toString()}`;
}

export async function createRemoteCampaign(title: string): Promise<RemoteCampaignProjection> {
    const result = await dndApiJson<{ campaign: RemoteCampaignProjection }>("/api/v1/campaigns", {
        method: "POST",
        body: JSON.stringify({ title }),
    }, true);
    return result.campaign;
}

export async function joinRemoteCampaign(inviteToken: string): Promise<RemoteCampaignProjection> {
    const result = await dndApiJson<{ campaign: RemoteCampaignProjection }>("/api/v1/campaigns/join", {
        method: "POST",
        body: JSON.stringify({ inviteToken }),
    }, true);
    return result.campaign;
}

export async function getRemoteCampaign(campaignId: string): Promise<RemoteCampaignProjection> {
    const result = await dndApiJson<{ campaign: RemoteCampaignProjection }>(`/api/v1/campaigns/${encodeURIComponent(campaignId)}`);
    return result.campaign;
}

export async function getRemoteCampaignEvents(
    campaignId: string,
    afterRevision: number,
): Promise<{ revision: number; events: Array<{ eventId: string; revision: number; type: string; createdAt: number; payload?: unknown }>; snapshot: RemoteCampaignProjection }> {
    const cursor = Number.isSafeInteger(afterRevision) && afterRevision >= 0 ? afterRevision : 0;
    const result = await dndApiJson<{ revision: number; events: Array<{ eventId: string; revision: number; type: string; createdAt: number; payload?: unknown }>; snapshot: RemoteCampaignProjection }>(
        `/api/v1/campaigns/${encodeURIComponent(campaignId)}/events?afterRevision=${cursor}`,
    );
    return result;
}

export async function createRemoteInvite(campaignId: string): Promise<{ inviteToken: string; expiresAt: number; role: "player" | "viewer" }> {
    return dndApiJson(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/invites`, {
        method: "POST",
        body: JSON.stringify({ role: "player" }),
    }, true);
}

export async function appendRemoteEvent(
    campaignId: string,
    event: { type: string; payload: unknown; expectedRevision: number },
    idempotencyKey: string,
): Promise<{ campaign: RemoteCampaignProjection }> {
    return dndApiJson(`/api/v1/campaigns/${encodeURIComponent(campaignId)}/events`, {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify(event),
    }, true);
}
