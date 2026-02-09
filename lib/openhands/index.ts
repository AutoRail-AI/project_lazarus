export {
  isOpenHandsAvailable,
  createConversation,
  getConversationStatus,
  stopConversation,
  sendUserAction,
  connectEventStream,
} from "./client"
export type {
  OpenHandsEvent,
  ConversationStatus,
  CreateConversationOptions,
  EventCallback,
  DisconnectFn,
} from "./client"

export {
  mapOpenHandsEvent,
  isSelfHealEvent,
  isTestPassEvent,
  isCodeWriteEvent,
  extractLinesWritten,
} from "./event-mapper"
export type { MappedEvent } from "./event-mapper"

export { buildSliceBuildPrompt } from "./prompt-builder"
export type { BuildPromptOptions } from "./prompt-builder"

export { executeSliceBuild } from "./build-graph"
export type { BuildState, StartBuildOptions } from "./build-graph"
