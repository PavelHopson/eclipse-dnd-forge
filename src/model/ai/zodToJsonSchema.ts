import { z, ZodTypeAny } from "zod";

/**
 * Minimal zod → JSON Schema converter.
 *
 * Scope is deliberately narrow — only the shapes Eclipse DnD Forge actually
 * uses in structured-output prompts:
 *   - ZodObject (nested allowed)
 *   - ZodArray (with object / primitive items)
 *   - ZodString, ZodNumber, ZodBoolean
 *   - ZodEnum (string values only)
 *   - ZodOptional (unwrapped — handled via `required` array on the parent)
 *
 * Anything outside this set throws — we'd rather fail loudly than ship a
 * malformed schema to Anthropic / Ollama.
 *
 * Adding `zod-to-json-schema` as a dependency would solve the general case,
 * but our schemas are 100% predictable and the converter is ~40 LOC.
 */

export interface JsonSchema {
    type?: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    enum?: string[];
    description?: string;
    additionalProperties?: boolean;
}

export function zodToJsonSchema(schema: ZodTypeAny): JsonSchema {
    if (schema instanceof z.ZodOptional) {
        return zodToJsonSchema(schema._def.innerType);
    }
    if (schema instanceof z.ZodString) {
        return { type: "string" };
    }
    if (schema instanceof z.ZodNumber) {
        return { type: "number" };
    }
    if (schema instanceof z.ZodBoolean) {
        return { type: "boolean" };
    }
    if (schema instanceof z.ZodEnum) {
        const values = (schema as any).options || (schema as any)._def?.values || [];
        return { type: "string", enum: values };
    }
    if (schema instanceof z.ZodArray) {
        return {
            type: "array",
            items: zodToJsonSchema(schema._def.type),
        };
    }
    if (schema instanceof z.ZodObject) {
        const shape = (schema as z.ZodObject<any>).shape;
        const properties: Record<string, JsonSchema> = {};
        const required: string[] = [];
        for (const key of Object.keys(shape)) {
            const field = shape[key];
            properties[key] = zodToJsonSchema(field);
            if (!(field instanceof z.ZodOptional)) {
                required.push(key);
            }
        }
        return {
            type: "object",
            properties,
            required,
            additionalProperties: false,
        };
    }
    throw new Error(`zodToJsonSchema: unsupported schema type ${schema.constructor?.name ?? typeof schema}`);
}
