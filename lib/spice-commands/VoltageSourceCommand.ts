import type { VoltageSourceCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class VoltageSourceCommand implements BaseSpiceCommand {
  commandName = "voltage_source" as const
  props: VoltageSourceCommandProps

  constructor(props: VoltageSourceCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, value, acMagnitude, acPhase } =
      this.props
    let spiceString = `V${name} ${positiveNode} ${negativeNode}`
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
