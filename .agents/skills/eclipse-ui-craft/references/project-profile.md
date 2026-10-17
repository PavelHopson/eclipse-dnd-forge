# Eclipse DnD Forge — product / editorial fantasy

The web workspace organizes campaigns, maps, narrative and session actions. User context
is a continuing game: preserve campaign selection, editor text, map position, saved state and
player/GM permissions. Local product goals include live-GM group, AI-GM group and solo-AI play;
this profile does not certify any mode as implemented or verified.

## Product sources

- [Repository guide](../../../../docs/repository-guide.md)
- [Styles and tokens](../../../../src/index.css)
- [Tailwind / NextUI integration](../../../../tailwind.config.js)
- [Launcher](../../../../src/view/Launcher.tsx)
- [Package manifest](../../../../package.json)

Preserve the existing --ef-* dark surfaces, warm-gold/blue hierarchy, Inter/Outfit,
NextUI and React Icons patterns. Fantasy depth belongs to campaign/world content;
editing controls, errors and game state remain quiet and readable. Do not turn the
workspace into Landing's cinematic hero. Legacy study routes are not the product target.
The manifest declares React 18, framer-motion ^11.2.12, @xyflow/react and Slate;
verify the installed versions and adapters before future gesture or spring work.

## One next pilot — proposed, not implemented

[CampaignLoadError](../../../../src/view/dnd/CampaignLoadError.tsx): a bounded keyboard
and focus review of the recovery screen and its return-to-campaign-list action.
The component already displays an alert and a recovery button; preserve the existing
storage/write-lock safety and do not overwrite a campaign during visual recovery.

Acceptance: route entry is understandable to keyboard/screen-reader users; button focus
is visible; recovery activates once and reaches the campaign list; interrupted/reduced
motion does not hide the error. Use disposable local fixtures only. Runtime reproduction
and any change require a separate UI task; no AI calls or campaign mutations in this PR.

## Checks and boundaries

Docs-only checks: frontmatter, links, provenance, conflict and diff review.
Future UI/session changes require concrete game-path and recovery checks, not merely a
build or HTTP success. Do not feed this skill or upstream design text into AI GM prompts.
The source checkout's untracked AGENTS.md and docs/PROJECT-CONTEXT.md were read as local
context, not copied into this isolated feature branch.
