

import basicsVideo from '/videos/Basics.mp4';
import entitiesVideo from '/videos/Entities.mp4';
import locationsVideo from '/videos/Locations.mp4';
import reorderVideo from '/videos/Reorder.mp4';

import { Entity, Location, ModelState } from '../model/Model';
import { dataTextB, textB } from './data/TextB';
import { dataTextC, textC } from './data/TextC';


export type StudyStepType = "TASK" | "MESSAGE" | "VIDEO" | "FREEFORM_LAUNCHER" | "TEST_TOOL";

export type StudyTask = "EDIT_ENTITIES" | "MOVE_ENTITIES" | "REORDER_EVENTS" | "NOT_A_TASK" | "FREE_FORM" | 
"READING_BEFORE_PLANNING" |
"PLANNING_CHARACTERS" | "PLANNING_SPACE" | "PLANNING_TEMPORALITY" | "PLANNING_FOCALIZATION";

export type StudyCondition = "VISUALWRITING" | "BASELINE" | "NOT_A_CONDITION";

export interface StudyStep {
    type: StudyStepType;
    instructions?: string[];
    message?: string;
    startingState?: Partial<ModelState>;
    task: StudyTask;
    condition: StudyCondition;
    saveData?: boolean;
    hardcodedData?: {actions: any[], entities: Entity[], locations: Location[]};
}




export class WritingStudyTaskGenerator {

    static generateSteps(participantId: number): StudyStep[] {
        let steps : StudyStep[] = [];

        // First, add the opening message with the link to complete the demographic survey
        steps.push({
            condition: "NOT_A_CONDITION",
            task: "NOT_A_TASK",
            type: "MESSAGE",
            message: `Thank you for participating in this study. Please, first complete this survey questionnaire: <a>Demographic survey</a>. After completing the survey, return to this page to continue the study.`,
        });

        steps.push({
            type: "VIDEO",
            task: "NOT_A_TASK",
            condition: "VISUALWRITING",
            saveData: false,
            message: basicsVideo,
          });

          steps.push({
            condition: "NOT_A_CONDITION",
            task: "NOT_A_TASK",
            type: "MESSAGE",
            message: `Now you will watch a second video that will introduce how to edit the story.`,
        });


        const latinSquare = [
            [['E1','M1','R1']],
            [['E1','R1','M1']],
            [['R1','E1','M1']],
            [['R1','M1','E1']],
            [['M1','R1','E1']],
            [['M1','E1','R1']],
        ];

        const order = latinSquare[(participantId-1) % latinSquare.length];


        for (let conditionIdx = 0; conditionIdx < order.length; ++conditionIdx) {
            const condition = "VISUALWRITING";//(participantId % 2) !== conditionIdx ? "VISUALWRITING" : "BASELINE";
            const tasks = order[conditionIdx];
      
            tasks.forEach((taskId, idx) => {
              const task = taskDictionary[taskId];
      
              const videoName : {[name: string]: string} = {
                "E": entitiesVideo,
                "M": locationsVideo,
                "R": reorderVideo,
              }


              steps.push({
                type: "VIDEO",
                task: "NOT_A_TASK",
                condition: condition,
                saveData: idx !== 0,
                message: videoName[taskId[0]],
              });

              steps.push({
                ...task,
                type: "TASK",
                condition: condition,
              })

              const url = ``

              steps.push({
                type: "MESSAGE",
                task: "NOT_A_TASK",
                condition: condition,
                saveData: true,
                message: `Feel free to take a break. Please answer this questionnaire: <a href='${url}' target="_blank">Questionnaire</a>.`        ,
          });

            });
            
          }

          /*steps.push({
            type: "VIDEO",
            task: "NOT_A_TASK",
            condition: "VISUALWRITING",
            message: freeformVideo,
          });*/

          /*steps.push({
            type: "FREEFORM_LAUNCHER",
            task: "NOT_A_TASK",
            condition: "VISUALWRITING",
        });*/

        steps.push({
            type: "TASK",
            task: "FREE_FORM",
            condition: "VISUALWRITING",
            instructions: ["Using the beginning of the story, explore what could happen next..."],
            startingState: { textState: [{ children: [{ text: textC }]}]},
        hardcodedData: dataTextC
        });

        const url = "";
        //const url = `https://docs.google.com/forms/d/e/1FAIpQLSdoVCmxaLUTmEoGgecHhwWhuMeXWBLHzsh3CmgqNolwpW64Lg/viewform?usp=pp_url&entry.1411851810=${participantId}`
        steps.push({
            type: "MESSAGE",
            task: "NOT_A_TASK",
            condition: "VISUALWRITING",
            saveData: true,
            message: `Please answer this questionnaire: <a href='${url}' target="_blank">Questionnaire</a>.`        ,
      });
      

        return steps;
    }
}


const taskDictionary: { [name: string]: StudyStep} = {

    /**
     * WRITE AN EMAIL USING A TEMPLATE
     * VARIATION 1
     */
    "E1": {
        task: "EDIT_ENTITIES",
        instructions: [
            "What if the hay bales were not there?",
            "What if Jack went sledding with a friend?"
        ],
        
        startingState: {
            textState: [
                {
                    children: [
                        {text: textB}
                    ]
                },
            ]

        },
        hardcodedData: dataTextB

    } as StudyStep,
    "M1": {
        task: "MOVE_ENTITIES",
        instructions: [
            "What if Jack had forgotten his hat at home?",
            "What if Jack flies into a place he's never been to before?"
        ],
        
        startingState: { textState: [{ children: [{ text: textB }]}]},
        hardcodedData: dataTextB

    } as StudyStep,
    "R1": {
        task: "REORDER_EVENTS",
        instructions: [
            "What if we move the last scene to the start of the story?",
            "What if Jack loses his hat when he flies into the sky?"
        ],
        
        startingState: { textState: [{ children: [{ text: textB }]}]},
        hardcodedData: dataTextB

    } as StudyStep,

   
} as any;
