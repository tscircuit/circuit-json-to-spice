import type { CurrentSourceCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class CurrentSourceCommand implements BaseSpiceCommand {
  commandName = "current_source" as const
  props: CurrentSourceCommandProps

  constructor(props: CurrentSourceCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, value, acMagnitude, acPhase } =
      this.props
    let spiceString = `I${name} ${positiveNode} ${negativeNode}`
    if (value) {
      spiceString += ` ${value}`
    }
    if (acMagnitude) {
      spiceString += ` AC ${acMagnitude}`
      if (acPhase) {
        spiceString += ` ${acPhase}`
      }
    }
    return spiceString
  }
}
