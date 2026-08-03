import { create } from 'zustand';
import { useHistoryModelStore } from '../model/HistoryModel';
import { useModelStore } from '../model/Model';
import { useViewModelStore } from '../model/ViewModel';
import { extractedEntitiesToNodeEntities } from '../model/prompts/textExtractors/EntitiesExtractor';
import { extractedLocationsToNodeLocations } from '../model/prompts/textExtractors/LocationsExtractor';
import { extractedActionsToEdgeActions } from '../model/prompts/textExtractors/SentenceActionsExtractor';
import { VisualRefresher } from '../model/prompts/textExtractors/VisualRefresher';
import { StudyStep } from './WritingStudyTaskGenerator';

const TIMEOUT_TIME = 4 * 60 * 1000; // 4 min
let previousTimeout: NodeJS.Timeout | null = null;

/** 
 * Model 
 **/
interface StudyModelState {
    participantId: number,
    stepId: number,
    steps: StudyStep[],
    isDataSaved: boolean,
    csvData: string,
    isOutOfTime: boolean,
    studyType: "READING" | "WRITING"
}

interface StudyModelAction {
    reset: () => void,
    resetStep: () => void,
    setParticipantId: (participantId: number) => void,
    setStepId: (stepId: number) => void,
    setSteps: (steps: StudyStep[]) => void,
    nextStep: () => void,
    saveData: (clear?: boolean, fromCookie?: boolean) => void,
    logEvent: (eventName: string, parameters?: any) => void,
    setIsDataSaved: (isDataSaved: boolean) => void,
    setStudyType: (studyType: "READING" | "WRITING") => void
}

const CSV_HEADER = "Timestamp,ParticipantId,StepId,StepType,Task,Condition,Event,Parameters"


const initialState: StudyModelState = {
    participantId: -1,
    stepId: -1,
    studyType: "READING",
    isDataSaved: true,
    csvData: CSV_HEADER,
    steps: [],
    isOutOfTime: false
}


export const useStudyStore = create<StudyModelState & StudyModelAction>()((set, get) => ({
    ...initialState,
    reset: () => set({ ...initialState }),
    setParticipantId: (participantId: number) => set({ participantId: participantId }),
    resetStep: () => {
        useModelStore.getState().reset();
        useViewModelStore.getState().reset();
        useHistoryModelStore.getState().reset();
        useModelStore.getState().setIsReadOnly(get().studyType === "READING");

        // Set the new text fields
        const step = JSON.parse(JSON.stringify(get().steps[get().stepId])) as StudyStep;
        if (step.startingState) {
            useModelStore.getState().setTextState(step.startingState.textState as any, true, false);
            useModelStore.getState().setIsStale(false);
            VisualRefresher.getInstance().previousText = useModelStore.getState().text;
            VisualRefresher.getInstance().onUpdate();
        }

        if (step.hardcodedData) {
            const entityNodes = extractedEntitiesToNodeEntities(step.hardcodedData);
            const locationNodes = extractedLocationsToNodeLocations(step.hardcodedData);
            const actionEdges = step.hardcodedData.actions.map(h => extractedActionsToEdgeActions({actions: [h]}, h.passage, entityNodes)).flat();
            useModelStore.getState().setEntityNodes(entityNodes);
            useModelStore.getState().setLocationNodes(locationNodes);
            useModelStore.getState().setActionEdges(actionEdges);
        }
    },
    setStepId: (stepId: number) => {
        set({ stepId: stepId })

        if (get().stepId < get().steps.length) {
            const newStepId = get().stepId;
            const step = get().steps[newStepId];

            get().resetStep();


            if (get().isDataSaved && step.saveData && get().csvData.length > 0) {
                get().saveData();
            }

            // Set up a timeout of 3min before setting the isOutOfTime flag
            if (previousTimeout !== null) {
                // Clear any previous timeout
                clearTimeout(previousTimeout);
                previousTimeout = null;
            }

            set({ isOutOfTime: false });

            if (step.type === "TASK") {
                previousTimeout = setTimeout(() => {
                    useStudyStore.setState({ isOutOfTime: true });
                    useStudyStore.getState().logEvent("TIMEOUT_REACHED");
                }, TIMEOUT_TIME);    
            }
            useHistoryModelStore.getState().reset();
        }

        // Change the URL to make it match if it is not already the case
        const hashSplitted = window.location.hash.split("?");
        const search = hashSplitted[hashSplitted.length - 1]
        const params = new URLSearchParams(search);

        if (params.get("stepId") !== get().stepId.toString()) {
            params.set("stepId", stepId.toString());
            window.location.hash = hashSplitted.slice(0, hashSplitted.length - 1).join("?") + "?" + params.toString();
        }
    },
    setSteps: (steps: StudyStep[]) => set({ steps: steps }),
    nextStep: () => {
        if (get().stepId + 1 < get().steps.length) {
            get().setStepId(get().stepId + 1);
        }
    },
    setStudyType: (studyType: "READING" | "WRITING") => set({ studyType: studyType }),
    logEvent(_eventName: string, _parameters?: any) {
        //console.log("LOG:", eventName, parameters)
       /*if (get().isDataSaved) {
            let strParams = parameters ? btoa(unescape(encodeURIComponent(JSON.stringify(parameters)))) : "";

            const currentStep = get().steps[get().stepId];
            if (currentStep) {
                const values = [Date.now(), get().participantId, get().stepId, currentStep.type, currentStep.task, currentStep.condition, eventName, strParams];
                set((state) => ({ csvData: state.csvData + "\n" + values.join(",") }));

                const cookieName = "studyData_" + get().participantId;
                let cookieValue = localStorage.getItem(cookieName) || CSV_HEADER;
                cookieValue += "\n" + values.join(",");
                localStorage.setItem(cookieName, cookieValue);
            }
        }*/
    },

    saveData(_clear = true, _fromCookie = false): void {
        /*if (get().isDataSaved) {
            const element = document.createElement('a');
            element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(fromCookie ? localStorage.getItem("studyData_" + get().participantId) || "" : get().csvData));
            element.setAttribute('download', "P" + get().participantId + "_" + (fromCookie ? "FULL" : get().stepId) + ".csv");

            element.style.display = 'none';
            document.body.appendChild(element);

            element.click();

            document.body.removeChild(element);

            if (clear) {
                set((state) => ({ csvData: "" }))
            }
        }*/
    },

    setIsDataSaved: (isDataSaved) => set({ isDataSaved: isDataSaved }),
}))


//         
