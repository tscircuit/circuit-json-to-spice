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
