import type { BaseSpiceCommand } from "../spice-commands/BaseSpiceCommand"

export class SpiceComponent {
  name: string
  command: BaseSpiceCommand
  nodes: string[]

  constructor(name: string, command: BaseSpiceCommand, nodes: string[]) {
    this.name = name
    this.command = command
    this.nodes = nodes
  }

  toSpiceString(): string {
    return this.command.toSpiceString()
  }
}
