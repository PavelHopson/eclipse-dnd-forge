

import readingVideo from '/videos/Reading.mp4';

import { dataTextA, textA } from './data/TextA';
import { dataTextF, textF } from './data/TextF';
import { dataTextG, textG } from './data/TextG';
import { StudyStep } from './WritingStudyTaskGenerator';





export class ReadingStudyTaskGenerator {

    static generateSteps(participantId: number): StudyStep[] {
        let steps : StudyStep[] = [];


        const link = ``

        // First, add the opening message with the link to complete the demographic survey
        steps.push({
            condition: "NOT_A_CONDITION",
            task: "NOT_A_TASK",
            type: "MESSAGE",
            message: `Thank you for participating in this study. Please, first complete this survey questionnaire: <a target="_blank" href='${link}'>Demographic survey</a>. After completing the survey, return to this page to continue the study.`,
        });

          /*const latinSquare = [
            [['C1',	'C2',	'S1',	'T2',	'S2',	'T1',	'F2',	'F1'], ['C2',	'T2',	'C1',	'T1',	'S1',	'F1',	'S2',	'F2']],
            [['C2',	'T2',	'C1',	'T1',	'S1',	'F1',	'S2',	'F2'], ['T2',	'T1',	'C2',	'F1',	'C1',	'F2',	'S1',	'S2']],
            [['T2',	'T1',	'C2',	'F1',	'C1',	'F2',	'S1',	'S2'], ['T1',	'F1',	'T2',	'F2',	'C2',	'S2',	'C1',	'S1']],
            [['T1',	'F1',	'T2',	'F2',	'C2',	'S2',	'C1',	'S1'], ['F1',	'F2',	'T1',	'S2',	'T2',	'S1',	'C2',	'C1']],
            [['F1',	'F2',	'T1',	'S2',	'T2',	'S1',	'C2',	'C1'], ['F2',	'S2',	'F1',	'S1',	'T1',	'C1',	'T2',	'C2']],
            [['F2',	'S2',	'F1',	'S1',	'T1',	'C1',	'T2',	'C2'], ['S2',	'S1',	'F2',	'C1',	'F1',	'C2',	'T1',	'T2']],
            [['S2',	'S1',	'F2',	'C1',	'F1',	'C2',	'T1',	'T2'], ['S1',	'C1',	'S2',	'C2',	'F2',	'T2',	'F1',	'T1']],
            [['S1',	'C1',	'S2',	'C2',	'F2',	'T2',	'F1',	'T1'], ['C1',	'C2',	'S1',	'T2',	'S2',	'T1',	'F2',	'F1']],
            
            [['C1',	'C2',	'S1',	'T2',	'S2',	'T1',	'F2',	'F1'], ['T2',	'T1',	'C2',	'F1',	'C1',	'F2',	'S1',	'S2']],
            [['C2',	'T2',	'C1',	'T1',	'S1',	'F1',	'S2',	'F2'], ['T1',	'F1',	'T2',	'F2',	'C2',	'S2',	'C1',	'S1']],
            [['T2',	'T1',	'C2',	'F1',	'C1',	'F2',	'S1',	'S2'], ['F1',	'F2',	'T1',	'S2',	'T2',	'S1',	'C2',	'C1']],
            [['T1',	'F1',	'T2',	'F2',	'C2',	'S2',	'C1',	'S1'], ['F2',	'S2',	'F1',	'S1',	'T1',	'C1',	'T2',	'C2']]
            ];*/

            const latinSquare = [
                [['C1', 'S2', 'T2', 'F2'], ['S1', 'F1', 'C2', 'T1']], 
                [['S2', 'F2', 'C2', 'T2'], ['F1', 'T1', 'S1', 'C1']], 
                [['F2', 'T2', 'S2', 'C1'], ['T1', 'C2', 'F1', 'S1']], 
                [['T2', 'C2', 'F2', 'S2'], ['C1', 'S1', 'T1', 'F1']], 
                [['C2', 'S2', 'T2', 'F2'], ['F1', 'T1', 'S1', 'C1']], 
                [['S2', 'F2', 'C2', 'T2'], ['T1', 'C1', 'F1', 'S1']], 
                [['F2', 'T2', 'S2', 'C2'], ['C1', 'S1', 'T1', 'F1']], 
                [['T2', 'C2', 'F2', 'S2'], ['S1', 'F1', 'C1', 'T1']], 
                [['C2', 'S1', 'T1', 'F1'], ['T2', 'C1', 'F2', 'S2']], 
                [['S1', 'F1', 'C1', 'T1'], ['C2', 'S2', 'T2', 'F2']], 
                [['F1', 'T1', 'S1', 'C2'], ['S2', 'F2', 'C1', 'T2']], 
                [['T1', 'C1', 'F1', 'S1'], ['F2', 'T2', 'S2', 'C2']], 
                [['C1', 'S1', 'T1', 'F1'], ['C2', 'S2', 'T2', 'F2']], 
                [['S1', 'F1', 'C1', 'T1'], ['S2', 'F2', 'C2', 'T2']], 
                [['F1', 'T1', 'S1', 'C1'], ['F2', 'T2', 'S2', 'C2']], 
                [['T1', 'C1', 'F1', 'S1'], ['T2', 'C2', 'F2', 'S2']],
            ];





            const order = latinSquare[(participantId-1) % latinSquare.length];


        for (let conditionIdx = 0; conditionIdx < order.length; ++conditionIdx) {
            const condition = (participantId % 2) !== conditionIdx ? "VISUALWRITING" : "BASELINE";
            const text = conditionIdx === 0 ? {
                startingState: { textState: [{ children: [{ text: textG }]}]},
                hardcodedData: JSON.parse(JSON.stringify(dataTextG))
            } : {
                startingState: { textState: [{ children: [{ text: textF }]}]},
                hardcodedData: JSON.parse(JSON.stringify(dataTextF))
            };
            const tasks = order[conditionIdx];

            if (condition === "VISUALWRITING") {
                // Add a video tutorial before the first visual writing task
                steps.push({
                    type: "VIDEO",
                    task: "NOT_A_TASK",
                    condition: "VISUALWRITING",
                    saveData: false,
                    message: readingVideo,
                  });

                  steps.push({
                    type: "TEST_TOOL",
                    task: "NOT_A_TASK",
                    condition: "VISUALWRITING",
                    saveData: false,
                    instructions: [`Explore the tool. Make sure to test:\n- Hovering over some entities to see who they interact with\n- Hovering over the timeline to see the actions in chronological order\n- Displaying the locations and hovering over the timeline to see the movements`],
                    startingState: { textState: [{ children: [{ text: textA }]}]},
                    hardcodedData: JSON.parse(JSON.stringify(dataTextA))
                });

                steps.push({
                    type: "MESSAGE",
                    task: "NOT_A_TASK",
                    condition: "NOT_A_CONDITION",
                    saveData: false,
                    message: `Feel free to take a break.`        ,
            });


            }

            // Before the task, there should be an opportunity to read the text
            steps.push({
                type: "TASK",
                task: "READING_BEFORE_PLANNING",
                condition: "BASELINE",
                saveData: false,
                instructions: [`Please read the text in its entirety before clicking next`],
                ...text
            });
      
            tasks.forEach((taskId) => {
              const task = taskDictionary[taskId];

                steps.push({
                    ...task,
                    type: "TASK",
                    condition: condition,
                    saveData: false,
                    ...text
                });


                steps.push({
                    type: "MESSAGE",
                    task: "NOT_A_TASK",
                    condition: "NOT_A_CONDITION",
                    saveData: true,
                    message: `Feel free to take a break.`        ,
            });
            });



            const tlx_url = ``

            steps.push({
                type: "MESSAGE",
                task: "NOT_A_TASK",
                condition: "NOT_A_CONDITION",
                saveData: false,
                message: `Please answer this questionnaire: <a href='${tlx_url}' target="_blank">Questionnaire</a>.`        ,
            });
        }




        steps.push({
            type: "MESSAGE",
            task: "NOT_A_TASK",
            condition: "VISUALWRITING",
            saveData: true,
            message: `Thank you for participating in this study!`,
      });
      

        return steps;
    }
}


const taskDictionary: { [name: string]: StudyStep} = {

    "C1": {
        task: "PLANNING_CHARACTERS",
        instructions: [
            "Could characters be combined without changing the outcome of the story?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,
    "C2": {
        task: "PLANNING_CHARACTERS",
        instructions: [
            "Is any character too passive?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,



    "S1": {
        task: "PLANNING_SPACE",
        instructions: [
            "Are there any locations which could be removed?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,
    "S2": {
        task: "PLANNING_SPACE",
        instructions: [
            "Are there moments where the spatial logic is broken or unclear?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,



    "T1": {
        task: "PLANNING_TEMPORALITY",
        instructions: [
            "Is there a large gap between two actions that make the story progress (lull moment)?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,
    "T2": {
        task: "PLANNING_TEMPORALITY",
        instructions: [
            "Is there a scene you think could take place later/earlier in the story?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,



    "F1": {
        task: "PLANNING_FOCALIZATION",
        instructions: [
            "If told from another character's perspective, how would the story change?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,
    "F2": {
        task: "PLANNING_FOCALIZATION",
        instructions: [
            "What does the main character mention that no other character would?",
            "How did you accomplish this task?"
        ]
    } as StudyStep,
} as any;
