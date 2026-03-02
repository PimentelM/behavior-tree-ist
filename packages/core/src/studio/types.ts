export const StudioErrorCode = {
    TreeNotFound: 'TREE_NOT_FOUND',
    UnknownCommand: 'UNKNOWN_COMMAND',
} as const;

export type StudioErrorCode = (typeof StudioErrorCode)[keyof typeof StudioErrorCode];

export const StudioCommandType = {
    EnableStreaming: 1,
    DisableStreaming: 2,
    EnableStateTrace: 3,
    DisableStateTrace: 4,
    EnableProfiling: 5,
    DisableProfiling: 6,
    GetTreeStatuses: 7,
} as const;

export type StudioCommandType = (typeof StudioCommandType)[keyof typeof StudioCommandType];

export interface TreeStatuses {
    streaming: boolean;
    stateTrace: boolean;
    profiling: boolean;
}
