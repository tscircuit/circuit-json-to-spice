import type { InductorCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class InductorCommand implements BaseSpiceCommand {
  commandName = "inductor" as const
  props: InductorCommandProps

  constructor(props: InductorCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, model, value, initialCondition } =
      this.props
    let spiceString = `L${name} ${positiveNode} ${negativeNode}`
    if (model) {
      spiceString += ` ${model}`
    }
    spiceString += ` ${value}`
    if (initialCondition) {
      spiceString += ` IC=${initialCondition}`
    }
    return spiceString
  }
}
