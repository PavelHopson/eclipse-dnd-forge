export function downloadCampaignFile(raw: string, id: string) {
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `${id.replace(/[^a-zA-Z0-9-]/g, "-")}.campaign.json`;
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
