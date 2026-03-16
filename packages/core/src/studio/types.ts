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

export type CorrelationId = string;

export interface StudioCommand {
    correlationId: CorrelationId;
    treeId: string;
    command: StudioCommandType;
}

export interface TreeStatuses {
    streaming: boolean;
    stateTrace: boolean;
    profiling: boolean;
}

// Maps each command to its response payload type (undefined = no data)
export interface CommandPayloadMap {
    [StudioCommandType.EnableStreaming]: undefined;
    [StudioCommandType.DisableStreaming]: undefined;
    [StudioCommandType.EnableStateTrace]: undefined;
    [StudioCommandType.DisableStateTrace]: undefined;
    [StudioCommandType.EnableProfiling]: undefined;
    [StudioCommandType.DisableProfiling]: undefined;
    [StudioCommandType.GetTreeStatuses]: TreeStatuses;
}

// Union of all non-undefined response data types from the command payload map
export type CommandResponseData = {
    [K in StudioCommandType]: CommandPayloadMap[K] extends undefined ? never : CommandPayloadMap[K];
}[StudioCommandType];

// Discriminated union for command responses
// When parameterized with a specific command type, narrows the data field accordingly
export type CommandResponseSuccess<T extends StudioCommandType = StudioCommandType> =
    T extends T
        ? CommandPayloadMap[T] extends undefined
            ? { success: true }
            : { success: true; data: CommandPayloadMap[T] }
        : never;

export interface CommandResponseError {
    success: false;
    errorCode: StudioErrorCode;
    errorMessage: string;
}

export type CommandResponse<T extends StudioCommandType = StudioCommandType> =
    CommandResponseSuccess<T> | CommandResponseError;
