import type { ResistorCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class ResistorCommand implements BaseSpiceCommand {
  commandName = "resistor" as const
  props: ResistorCommandProps

  constructor(props: ResistorCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, model, value } = this.props
    let spiceString = `R${name} ${positiveNode} ${negativeNode}`
    if (model) {
      spiceString += ` ${model}`
    }
    spiceString += ` ${value}`
    return spiceString
  }
}
