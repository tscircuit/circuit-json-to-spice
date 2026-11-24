import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface VoltageSourceCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  value?: string
  acMagnitude?: string
  acPhase?: string
}

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
    if (acMagnitude || acPhase) {
      spiceString += ` AC ${acMagnitude ?? "1"}`
      if (acPhase) {
        spiceString += ` ${acPhase}`
      }
    }
    return spiceString
  }
}
