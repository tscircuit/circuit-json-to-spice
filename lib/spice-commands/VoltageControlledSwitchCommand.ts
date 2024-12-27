import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface VoltageControlledSwitchCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  positiveControl: string
  negativeControl: string
  model: string
}

export class VoltageControlledSwitchCommand implements BaseSpiceCommand {
  commandName = "voltage_controlled_switch" as const
  props: VoltageControlledSwitchCommandProps

  constructor(props: VoltageControlledSwitchCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const {
      name,
      positiveNode,
      negativeNode,
      positiveControl,
      negativeControl,
      model,
    } = this.props
    return `S${name} ${positiveNode} ${negativeNode} ${positiveControl} ${negativeControl} ${model}`
  }
}
