import type { MOSFETCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class MOSFETCommand implements BaseSpiceCommand {
  commandName = "mosfet" as const
  props: MOSFETCommandProps

  constructor(props: MOSFETCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const {
      name,
      drain,
      gate,
      source,
      substrate,
      model,
      length,
      width,
      drainArea,
      sourceArea,
      drainPerimeter,
      sourcePerimeter,
      drainResistance,
      sourceResistance,
    } = this.props

    let spiceString = `M${name} ${drain} ${gate} ${source} ${substrate} ${model}`

    const params: Record<string, string | undefined> = {
      L: length,
      W: width,
      AD: drainArea,
      AS: sourceArea,
      PD: drainPerimeter,
      PS: sourcePerimeter,
      NRD: drainResistance,
      NRS: sourceResistance,
    }

    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        spiceString += ` ${key}=${value}`
      }
    })

    return spiceString
  }
}
