import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export interface JFETCommandProps {
  name: string
  drain: string
  gate: string
  source: string
  model: string
  area?: string
}

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
