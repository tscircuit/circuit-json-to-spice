import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface DiodeCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  model: string
  area?: string
}

export class DiodeCommand implements BaseSpiceCommand {
  commandName = "diode" as const
  props: DiodeCommandProps

  constructor(props: DiodeCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, model, area } = this.props
    let spiceString = `D${name} ${positiveNode} ${negativeNode} ${model}`
    if (area) {
      spiceString += ` ${area}`
    }
    return spiceString
  }
}
