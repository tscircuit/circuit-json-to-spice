import type { TransmissionLineCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class TransmissionLineCommand implements BaseSpiceCommand {
  commandName = "transmission_line" as const
  props: TransmissionLineCommandProps

  constructor(props: TransmissionLineCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const {
      name,
      aPositive,
      aNegative,
      bPositive,
      bNegative,
      impedance,
      delay,
      frequency,
      normalizedLength,
    } = this.props
    let spiceString = `T${name} ${aPositive} ${aNegative} ${bPositive} ${bNegative} Z0=${impedance}`
    if (delay) {
      spiceString += ` TD=${delay}`
    } else if (frequency) {
      spiceString += ` F=${frequency}`
      if (normalizedLength) {
        spiceString += ` NL=${normalizedLength}`
      }
    }
    return spiceString
  }
}
