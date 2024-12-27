import type { BJTCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class BJTCommand implements BaseSpiceCommand {
  commandName = "bjt" as const
  props: BJTCommandProps

  constructor(props: BJTCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, collector, base, emitter, substrate, model, area } =
      this.props
    let spiceString = `Q${name} ${collector} ${base} ${emitter}`
    if (substrate) {
      spiceString += ` ${substrate}`
    }
    spiceString += ` ${model}`
    if (area) {
      spiceString += ` ${area}`
    }
    return spiceString
  }
}
