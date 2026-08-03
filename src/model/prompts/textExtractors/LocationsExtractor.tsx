import { z } from "zod";
import { CreateLocatioNode } from "../../../view/locationView/LocationNodeComponent";
import { LayoutUtils } from "../../LayoutUtils";
import { Location, LocationNode, useModelStore } from "../../Model";
import { JSONPrompt } from "../utils/JSONPrompt";

const LOCATION_KIND_ENUM = z.enum(["dungeon", "town", "wild", "plane", "stronghold", "unknown"]);

const LOCATION_SCHEMA = z.object({
    locations: z.array(z.object({
        name: z.string(),
        emoji: z.string(),
        kind: LOCATION_KIND_ENUM,
        biome: z.string(),
        danger: z.number(),
    }))
});

export function extractedLocationsToNodeLocations(extractedData: { locations: Location[] }) : LocationNode[] {
    return extractedData.locations.map((location, index) => CreateLocatioNode(location, index));
}



export function LocationExtractor(text : string, center: {x: number, y: number}) : Promise<LocationNode[]> {
    const prompt = text +
    `\n\nYou are extracting locations from a Dungeons & Dragons campaign log or session notes. ` +
    `Identify every named place that the party visits, references, or hears about as a destination. ` +
    `For each location, extract:\n` +
    `- 'name': the location's proper name\n` +
    `- 'emoji': a single emoji best visually representing the place (avoid reusing the same emoji)\n` +
    `- 'kind': one of "dungeon" (cave, crypt, ruin, lair, hideout), "town" (village, city, settlement, inn interior), "wild" (forest, mountain, road, marsh, sea), "plane" (planar realm, demi-plane, mist-realm), "stronghold" (fortress, keep, castle, citadel), or "unknown"\n` +
    `- 'biome': a short descriptor of the environment ("frontier town", "cave warren", "haunted forest", "gothic-decay", "marsh", "interior", "road"). Max 3 words.\n` +
    `- 'danger': estimated threat level for a low-to-mid level party on a 1-10 scale (1 = safe town hub, 10 = certain death without preparation).\n\n` +
    `Skip incidental references that are not locations the party can travel to or operate within.`


    const locationExtractor = new JSONPrompt({ prompt:  prompt}, LOCATION_SCHEMA)
    useModelStore.getState().setLocationNodes([]);

    locationExtractor.onPartialResponse = (partialResult) => {
        const newLocations = extractedLocationsToNodeLocations(partialResult.result);
        const oldLocations = useModelStore.getState().locationNodes;

        // Reuse the position of the locations that already existed
        const locations = newLocations.map((newLocation) => {
            const oldLocation = oldLocations.find(e => e.data.name === newLocation.data.name);
            if (oldLocation && oldLocation.position) newLocation.position = oldLocation.position;
            if (oldLocation && oldLocation.measured) newLocation.measured = oldLocation.measured;

            return newLocation;
        });

        
        useModelStore.getState().setLocationNodes(locations);
        LayoutUtils.optimizeNodeLayout("location", locations, useModelStore.getState().setLocationNodes, {x: center.x, y: center.y}, 120);
    }

    return new Promise((resolve) => {
        locationExtractor.execute().then((result) => {
            console.log("Extracted locations:", result.result);
            resolve(useModelStore.getState().locationNodes);
    })
    });
}
