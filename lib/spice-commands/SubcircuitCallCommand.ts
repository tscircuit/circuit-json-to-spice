import type { SubcircuitCallCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

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
