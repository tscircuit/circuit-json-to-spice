import type { InductorCouplingCommandProps } from "."
import type { BaseSpiceCommand } from "./BaseSpiceCommand"

export class InductorCouplingCommand implements BaseSpiceCommand {
  commandName = "inductor_coupling" as const
  props: InductorCouplingCommandProps

  constructor(props: InductorCouplingCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, inductors, coupling } = this.props
    return `K${name} ${inductors.join(" ")} ${coupling}`
  }
}
