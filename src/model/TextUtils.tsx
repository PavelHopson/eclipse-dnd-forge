import * as Diff from 'diff';
import { Action } from "./Model";

export interface TextActionMatch {
    action: Action;
    start: number;
    end: number;
    isExact: boolean;
}

const punctuationMarks = [".", ",", ";", ":", "!", "?", "(", ")", "[", "]", "{", "}", "<", ">", "\"", "'"];

export class TextUtils {
    /**
     * Find all the matching strings in str and return their starting indices
     * @param str 
     * @param search 
     * @returns 
     */
    static findAllMatches(str: string, search: string): number[] {
        const indices: number[] = [];
        let startIndex = 0;
        let index;
    
        while ((index = str.indexOf(search, startIndex)) > -1) {
            indices.push(index);
            startIndex = index + search.length;
        }
    
        return indices;
    }

    /**
     * Clean up a string to make it easier to be matched against (mostly for GPT because it seems to mess with special characters)
     * @param str 
     * @param replacement 
     * @returns 
     */
    static prepareStringForMatching(str: string, replacement = " "): string {
        return str.replace(/[^a-zA-Z0-9]/g, replacement).toLocaleLowerCase();
    }

    /**
     * Tries very hard to find the action in the text. Implements some fuzzy matching if an exact match is not found
     * @param actions 
     * @param text 
     * @returns 
     */
    static matchActionsToText(actions : Action[], text: string): TextActionMatch[] {
        // Simplify the string as much as possible to simplify the matching
        // Also seems like GPT struggles with preserving special characters and spaces...
        text = TextUtils.prepareStringForMatching(text);

        // Most naive solution, we first match all the passages to the text
        let matches : TextActionMatch[] = [];
        for (const action of actions) {
            const passage = TextUtils.prepareStringForMatching(action.passage);

            const start = text.indexOf(passage);
            if (start !== -1) {
                matches.push({start, end: start + passage.length, action, isExact: true});
            } else {
                matches.push({start: -1, end: -1, action, isExact: false});
            }
        }

        // For the remaining strings that could not be found, we do some fuzzy matching
        // Actions should appear in chronological order in the text
        // This means we can already approximate the general area the missing text should be by looking at its known neighbours
        let lastEnd = 0;
        matches = matches.map((match, index) => {
            if (match.end === -1) {
                // This passage was not matched yet
                // We first approximate its position by looking at its neighbors
                match.start = lastEnd;
                match.end = text.length;

                // Refine the endPos by looking at the next passage
                const closestNextRange = matches.slice(index+1).find((r) => r.start !== null);
                if (closestNextRange) {
                    match.end = closestNextRange.start!;
                }

                // Now we can look for the passage in a narrower passage
                const textBeingSearched = text.slice(match.start, match.end);

                // We look for the first and last long subsequence in common, and mark those as the start and end
                let subsequenceIdx = 0;
                let startIdx = -1;
                let endIdx = -1;
                Diff.diffWords(actions[index].passage, textBeingSearched, {ignoreWhitespace: true}).forEach((part) => {
                    if (!part.added && !part.removed) {
                        // This is a common subsquence, but we only consider it if is longer than 4 characters and 2 words
                        const words = part.value.split(" ");
                        // Remove all the spaces from the value to only count visible characters
                        const characters = part.value.replace(/\s/g, '');
                        if (words.length > 2 && characters.length > 5) {
                            if (startIdx === -1) startIdx = subsequenceIdx;
                            endIdx = subsequenceIdx + part.value.length;
                        }
                    }
                    if (!part.removed) {
                        subsequenceIdx += part.value.length;
                    }
                });

                if (startIdx !== -1 && endIdx !== -1) {
                    match.end = match.start + endIdx;
                    match.start += startIdx;
                    match.isExact = true; // Technically not exact, but close enough
                }
            } else {
                lastEnd = match.end;
            }
            return match;
        });

        return matches;
    }

    /**
     * Find the actions at a given position/range in the text
     * @param textActionMatches 
     * @param start 
     * @param end 
     * @param precedingIfNoMatch If no action found, returns the actions that precede the range
     * @returns 
     */
    static getActionsAtPosition(textActionMatches: TextActionMatch[], start: number, end: number, precedingIfNoMatch : boolean = false): {action: Action, index: number}[] {
        const results = [];

        let actionBefore : {action: Action, index: number, endPos: number}[] = [];

        for (let i = 0; i < textActionMatches.length; i++) {
            const match = textActionMatches[i];
            if (actionBefore.length > 0 && actionBefore[0].endPos === match.end) {
                actionBefore.push({action: match.action, index: i, endPos: match.end});
            }

            if (match.end < start && (actionBefore.length === 0 || actionBefore[0].endPos < match.end)) {
                actionBefore = [{action: match.action, index: i, endPos: match.end}];
            }

            // If the range intersects the action
            if (match.start <= end && match.end >= start) {
                results.push({action: match.action, index: i});
            }
        }
        return results.length === 0 && precedingIfNoMatch && actionBefore.length > 0 ? actionBefore : results;
    }


    static caretPositionFromPoint(x: number, y: number) : {offsetNode : Node, offset : number} | null {
        if ((document as any).caretPositionFromPoint) {
            return (document as any).caretPositionFromPoint(x, y);
          } else if (document.caretRangeFromPoint) {
            // Use WebKit-proprietary fallback method
            const range = document.caretRangeFromPoint(x, y);
            if (range) {
                return { offsetNode: range.startContainer, offset: range.startOffset };
            }
          }
          return null;
    }

    // Function to make a string beginning and end match another string so that it could "fit" wherever that other string was placed
    // The reason of this function is mostly because the LLM often adds an upper case and punctuation to every result, even if they are just text fragments. So this function mitigates that problem.
    static getFittingString(inputString: string, modelString: string) : string {
        // The result has to match with what appears before and after
        let result = inputString;

        if (result.length <= 1) {
            return result;
        }

        // Extract the spaces before and after the selected text
        const spacesBefore = modelString.match(/^\s*/);
        const spaceBeforeStr = spacesBefore ? spacesBefore[0] : "";
        const spacesAfter = modelString.match(/\s*$/);
        const spaceAfterStr = spacesAfter ? spacesAfter[0] : "";
        // Remove the spaces before and after the model string and input string
        modelString = modelString.trim();
        result = result.trim();

        const firstChar = modelString[0];
        const lastChar = modelString[modelString.length - 1];
        const firstCharResult = result[0];
        const lastCharResult = result[result.length - 1];

        // Make the first letter of the result match the case of the first letter of the selected text
        if (firstChar === firstChar.toUpperCase()) {
            result = result[0].toUpperCase() + result.substring(1);
        } else {
            result = result[0].toLowerCase() + result.substring(1);
        }

        // Use the punctuation from modelString instead of/in addition to result
        if (lastChar !== lastCharResult) {
            // If result finishes with some punctuation, remove it
            if (punctuationMarks.includes(lastCharResult)) {
                result = result.substring(0, result.length - 1);
            }

            // If the selected text finishes with some punctuation, add it to the result
            if (punctuationMarks.includes(lastChar)) {
                result = result + lastChar;
            }
        }

        // Do the same for the first character
        if (firstChar !== firstCharResult) {
            // If result starts with some punctuation, remove it
            if (punctuationMarks.includes(firstCharResult)) {
                result = result.substring(1);
            }

            // If the selected text starts with some punctuation, add it to the result
            if (punctuationMarks.includes(firstChar)) {
                result = firstChar + result;
            }
        }

        // Add the spaces before and after the selected text
        return spaceBeforeStr + result + spaceAfterStr;
    }
}
