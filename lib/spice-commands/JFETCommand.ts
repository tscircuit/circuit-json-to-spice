import type { JFETCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class JFETCommand implements BaseSpiceCommand {
  commandName = "jfet" as const
  props: JFETCommandProps

  constructor(props: JFETCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, drain, gate, source, model, area } = this.props
    let spiceString = `J${name} ${drain} ${gate} ${source} ${model}`
    if (area) {
      spiceString += ` ${area}`
    }
    return spiceString
  }
}
