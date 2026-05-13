/**
 * Dice expression parser + roller. Supports the common D&D 5e shapes:
 *   d20         → 1d20, no modifier
 *   2d6         → roll two d6, sum
 *   1d10+5      → roll one d10, add 5
 *   3d8-2       → roll three d8, subtract 2
 *
 * Multi-term expressions (e.g. "d20+1d4+3") are NOT supported in this slice
 * — they can be rolled as two separate rolls until we need otherwise.
 */

export interface DiceRollResult {
    expr: string;
    rolls: number[];
    modifier: number;
    total: number;
}

const DICE_RE = /^(\d*)d(\d+)([+-]\d+)?$/i;

export function parseDiceExpression(raw: string): { count: number; sides: number; modifier: number } | null {
    const m = raw.trim().match(DICE_RE);
    if (!m) return null;
    const count = parseInt(m[1] || "1", 10);
    const sides = parseInt(m[2], 10);
    const modifier = m[3] ? parseInt(m[3], 10) : 0;
    if (!Number.isFinite(count) || !Number.isFinite(sides)) return null;
    if (count < 1 || count > 100) return null;
    if (sides < 2 || sides > 1000) return null;
    return { count, sides, modifier };
}

export function rollDice(expr: string): DiceRollResult {
    const parsed = parseDiceExpression(expr);
    if (!parsed) {
        throw new Error(`Invalid dice expression: "${expr}". Expected something like d20, 2d6, 1d10+5.`);
    }
    const rolls: number[] = [];
    for (let i = 0; i < parsed.count; i++) {
        rolls.push(1 + Math.floor(Math.random() * parsed.sides));
    }
    const total = rolls.reduce((a, b) => a + b, 0) + parsed.modifier;
    return { expr: expr.trim(), rolls, modifier: parsed.modifier, total };
}

/**
 * Render a roll into compact markdown text suitable for inserting into
 * the session log. Examples:
 *   🎲 d20+5: **18** (13+5)
 *   🎲 2d6: **9** (3+6)
 *   🎲 1d8: **4**
 */
export function formatRoll(r: DiceRollResult): string {
    const rollStr = r.rolls.length === 1 ? `${r.rolls[0]}` : r.rolls.join("+");
    const modStr = r.modifier === 0 ? "" : (r.modifier > 0 ? `+${r.modifier}` : `${r.modifier}`);
    const inner = `${rollStr}${modStr}`;
    return `🎲 ${r.expr}: **${r.total}** (${inner})`;
}
