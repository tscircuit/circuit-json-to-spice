export interface BaseSpiceCommand {
  commandName?: string
  statementName?: string

  toSpiceString(): string
}
