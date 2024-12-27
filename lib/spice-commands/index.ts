import type { BaseSpiceCommand } from "./BaseSpiceCommand"

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

export class CurrentSourceCommand implements BaseSpiceCommand {
  commandName = "current_source" as const
  props: CurrentSourceCommandProps

  constructor(props: CurrentSourceCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, value, acMagnitude, acPhase } =
      this.props
    let spiceString = `I${name} ${positiveNode} ${negativeNode}`
    if (value) {
      spiceString += ` ${value}`
    }
    if (acMagnitude) {
      spiceString += ` AC ${acMagnitude}`
      if (acPhase) {
        spiceString += ` ${acPhase}`
      }
    }
    return spiceString
  }
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

export class InductorCommand implements BaseSpiceCommand {
  commandName = "inductor" as const
  props: InductorCommandProps

  constructor(props: InductorCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, model, value, initialCondition } =
      this.props
    let spiceString = `L${name} ${positiveNode} ${negativeNode}`
    if (model) {
      spiceString += ` ${model}`
    }
    spiceString += ` ${value}`
    if (initialCondition) {
      spiceString += ` IC=${initialCondition}`
    }
    return spiceString
  }
}

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

export class VoltageSourceCommand implements BaseSpiceCommand {
  commandName = "voltage_source" as const
  props: VoltageSourceCommandProps

  constructor(props: VoltageSourceCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, positiveNode, negativeNode, value, acMagnitude, acPhase } =
      this.props
    let spiceString = `V${name} ${positiveNode} ${negativeNode}`
    if (value) {
      spiceString += ` ${value}`
    }
    if (acMagnitude) {
      spiceString += ` AC ${acMagnitude}`
      if (acPhase) {
        spiceString += ` ${acPhase}`
      }
    }
    return spiceString
  }
}

export class SubcircuitCallCommand implements BaseSpiceCommand {
  commandName = "subcircuit_call" as const
  props: SubcircuitCallCommandProps

  constructor(props: SubcircuitCallCommandProps) {
    this.props = props
  }

  toSpiceString(): string {
    const { name, nodes, subcircuitName } = this.props
    return `X${name} ${nodes.join(" ")} ${subcircuitName}`
  }
}

export interface DiodeCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  model: string
  area?: string
}

export interface CurrentSourceCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  value?: string
  acMagnitude?: string
  acPhase?: string
}

export interface JFETCommandProps {
  name: string
  drain: string
  gate: string
  source: string
  model: string
  area?: string
}

export interface InductorCouplingCommandProps {
  name: string
  inductors: string[]
  coupling: string
}

export interface InductorCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  model?: string
  value: string
  initialCondition?: string
}

export interface MOSFETCommandProps {
  name: string
  drain: string
  gate: string
  source: string
  substrate: string
  model: string
  length?: string
  width?: string
  drainArea?: string
  sourceArea?: string
  drainPerimeter?: string
  sourcePerimeter?: string
  drainResistance?: string
  sourceResistance?: string
}

export interface BJTCommandProps {
  name: string
  collector: string
  base: string
  emitter: string
  substrate?: string
  model: string
  area?: string
}

export interface ResistorCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  model?: string
  value: string
}

export interface VoltageControlledSwitchCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  positiveControl: string
  negativeControl: string
  model: string
}

export interface TransmissionLineCommandProps {
  name: string
  aPositive: string
  aNegative: string
  bPositive: string
  bNegative: string
  impedance: string
  delay?: string
  frequency?: string
  normalizedLength?: string
}

export interface VoltageSourceCommandProps {
  name: string
  positiveNode: string
  negativeNode: string
  value?: string
  acMagnitude?: string
  acPhase?: string
}

export interface SubcircuitCallCommandProps {
  name: string
  nodes: string[]
  subcircuitName: string
}
