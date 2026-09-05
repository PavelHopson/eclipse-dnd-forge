import type { CampaignTemplate } from "./campaignTemplates";
import { campaignRepository } from "./campaignStorage";
import { templateWorld } from "./campaignDocument";

export function startCampaignFromTemplate(template: CampaignTemplate): void {
    const repository = campaignRepository();
    repository.migrateLegacy();
    const id = repository.create(template.title, templateWorld(template.text, template.seed.entities, template.seed.locations));
    repository.activate(id);
}
