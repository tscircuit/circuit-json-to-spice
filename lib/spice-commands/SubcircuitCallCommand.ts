import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface SubcircuitCallCommandProps {
  name: string
  nodes: string[]
  subcircuitName: string
}

export class SubcircuitCallCommand implements BaseSpiceCommand {
  commandName = "subcircuit_call" as const
  props: SubcircuitCallCommandProps

  constructor(props: SubcircuitCallCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, nodes, subcircuitName } = this.props
    return `X${name} ${nodes.join(" ")} ${subcircuitName}`
  }
}
