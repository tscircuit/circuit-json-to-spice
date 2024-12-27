import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface CapacitorCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  modelName?: string
  value: string
  initialCondition?: string
}

export class CapacitorCommand implements BaseSpiceCommand {
  commandName = "capacitor" as const

  props: CapacitorCommandProps

  constructor(props: CapacitorCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const {
      name,
      positiveNode,
      negativeNode,
      modelName,
      value,
      initialCondition,
    } = this.props

    let spiceString = `C${name} ${positiveNode} ${negativeNode}`
    if (modelName) {
      spiceString += ` ${modelName}`
    }
    spiceString += ` ${value}`
    if (initialCondition) {
      spiceString += ` IC=${initialCondition}`
    }
    return spiceString
  }
}
