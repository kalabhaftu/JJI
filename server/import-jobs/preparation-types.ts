export interface ImportPreparationContext {
  accountMap: Map<string, string>
  phaseMap: Map<string, string>
  phaseNumberMap: Map<string, string>
  masterMap: Map<string, string>
}

export type ImportPreparationHandler = (
  data: any,
  internalUserId: string,
  context: ImportPreparationContext,
) => Promise<void>
