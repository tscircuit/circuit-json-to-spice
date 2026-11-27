import type { SimulationSwitch, SourcePort } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import {
  VoltageControlledSwitchCommand,
  VoltageSourceCommand,
} from "lib/spice-commands"
import type { SourcePortOrNetIdToSpiceNodeNameMap } from "lib/spice-node-map"
import {
  buildSimulationSwitchControlValue,
  sanitizeIdentifier,
} from "./helpers"

export interface RotarySwitchSourceComponent {
  type: "source_component"
  source_component_id: string
  name?: string
  ftype: "simple_rotary_switch"
  poles?: number
  positions?: number
  selected_position?: number
  sim_position?: number
}

export type RotarySimulationSwitch = SimulationSwitch & {
  selected_position?: number
  sim_position?: number
}

interface RotarySwitchThrowSpec {
  pole: number
  position: number
  commonNode: string
  throwNode: string
  isSelected: boolean
}

const isMountPort = (port: SourcePort): boolean => {
  if (port.pin_number !== undefined) return false
  if (port.name?.trim().toUpperCase() === "MP") return true
  return (
    port.port_hints?.some((hint) => hint.trim().toUpperCase() === "MP") ?? false
  )
}

const getPortCandidateLabels = (port: SourcePort): string[] => {
  const raw = [port.name, ...(port.port_hints ?? [])]
  return raw
    .filter((label): label is string => typeof label === "string")
    .map((label) => label.trim().toLowerCase())
    .filter(Boolean)
}

const findRotaryCommonPort = ({
  ports,
  pole,
  poles,
  commonPinNumber,
  usedPortIds,
}: {
  ports: SourcePort[]
  pole: number
  poles: number
  commonPinNumber: number
  usedPortIds: Set<string>
}): SourcePort | undefined => {
  const byPinNumber = ports.find(
    (port) =>
      !usedPortIds.has(port.source_port_id) &&
      port.pin_number === commonPinNumber,
  )
  if (byPinNumber) return byPinNumber

  const aliases = new Set<string>([
    `${commonPinNumber}`,
    `pin${commonPinNumber}`,
    `common${pole}`,
    `com${pole}`,
    `pole${pole}`,
    `c${pole}`,
    `wiper${pole}`,
  ])
  if (poles === 1) {
    aliases.add("common")
    aliases.add("com")
    aliases.add("pole")
    aliases.add("c")
    aliases.add("wiper")
  }

  return ports.find((port) => {
    if (usedPortIds.has(port.source_port_id)) return false
    if (port.pin_number !== undefined && port.pin_number !== commonPinNumber) {
      return false
    }
    return getPortCandidateLabels(port).some((label) => aliases.has(label))
  })
}

const findRotaryThrowPort = ({
  ports,
  pole,
  position,
  poles,
  throwPinNumber,
  usedPortIds,
}: {
  ports: SourcePort[]
  pole: number
  position: number
  poles: number
  throwPinNumber: number
  usedPortIds: Set<string>
}): SourcePort | undefined => {
  const byPinNumber = ports.find(
    (port) =>
      !usedPortIds.has(port.source_port_id) &&
      port.pin_number === throwPinNumber,
  )
  if (byPinNumber) return byPinNumber

  const aliases = new Set<string>([
    `${throwPinNumber}`,
    `pin${throwPinNumber}`,
    `p${pole}_pos${position}`,
    `p${pole}pos${position}`,
    `p${pole}_t${position}`,
    `p${pole}t${position}`,
    `pole${pole}_pos${position}`,
    `pole${pole}_throw${position}`,
  ])
  if (poles === 1) {
    aliases.add(`pos${position}`)
    aliases.add(`position${position}`)
    aliases.add(`throw${position}`)
    aliases.add(`t${position}`)
  }

  return ports.find((port) => {
    if (usedPortIds.has(port.source_port_id)) return false
    if (port.pin_number !== undefined && port.pin_number !== throwPinNumber) {
      return false
    }
    return getPortCandidateLabels(port).some((label) => aliases.has(label))
  })
}

const buildRotarySelectedControlValue = (
  simulationSwitch: RotarySimulationSwitch | undefined,
): string => {
  if (!simulationSwitch) {
    return "DC 5"
  }

  const hasTimingParameters =
    (simulationSwitch.closes_at !== undefined &&
      simulationSwitch.closes_at > 0) ||
    simulationSwitch.opens_at !== undefined ||
    (simulationSwitch.switching_frequency !== undefined &&
      simulationSwitch.switching_frequency > 0)

  if (!hasTimingParameters && simulationSwitch.starts_closed === undefined) {
    return "DC 5"
  }

  return buildSimulationSwitchControlValue({
    ...simulationSwitch,
    starts_closed: simulationSwitch.starts_closed ?? false,
  })
}

const getUniqueSwitchBaseName = (
  netlist: SpiceNetlist,
  component: RotarySwitchSourceComponent,
): string => {
  const initialBase = sanitizeIdentifier(
    component.name ?? component.source_component_id,
    "SW",
  )
  const existingComponentNames = new Set(
    netlist.components.map((comp) => comp.name.toUpperCase()),
  )
  const isBaseTaken = (candidate: string) =>
    netlist.models.has(`SW_${candidate}`) ||
    existingComponentNames.has(`CTRL_${candidate}_ON`.toUpperCase()) ||
    existingComponentNames.has(`CTRL_${candidate}_OFF`.toUpperCase()) ||
    existingComponentNames.has(`${candidate}_P1_T1`.toUpperCase())

  if (!isBaseTaken(initialBase)) {
    return initialBase
  }

  const withId = `${initialBase}_${sanitizeIdentifier(
    component.source_component_id,
    "ID",
  )}`
  if (!isBaseTaken(withId)) {
    return withId
  }

  let suffix = 2
  while (isBaseTaken(`${initialBase}_${suffix}`)) {
    suffix++
  }
  return `${initialBase}_${suffix}`
}

export const processSimpleRotarySwitch = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
  simulationSwitchMap,
  externallyReferencedPortIds,
}: {
  netlist: SpiceNetlist
  component: RotarySwitchSourceComponent
  componentPorts: SourcePort[]
  nodeMap: SourcePortOrNetIdToSpiceNodeNameMap
  simulationSwitchMap: Map<string, SimulationSwitch>
  externallyReferencedPortIds: Set<string>
}): SpiceComponent | null => {
  const electricalPorts = componentPorts.filter((port) => !isMountPort(port))
  const poles =
    typeof component.poles === "number" &&
    Number.isInteger(component.poles) &&
    component.poles >= 1
      ? component.poles
      : 1

  const inferredPositions =
    electricalPorts.length >= poles * 3
      ? Math.floor(electricalPorts.length / poles) - 1
      : 0
  const positions =
    typeof component.positions === "number" &&
    Number.isInteger(component.positions) &&
    component.positions >= 2
      ? component.positions
      : inferredPositions

  if (positions < 2) {
    return null
  }

  const associatedSimulationSwitch = simulationSwitchMap.get(
    component.source_component_id,
  ) as RotarySimulationSwitch | undefined

  const rawSelectedPosition =
    associatedSimulationSwitch?.selected_position ??
    associatedSimulationSwitch?.sim_position ??
    component.selected_position ??
    component.sim_position ??
    1
  const selectedPosition = Number.isFinite(rawSelectedPosition)
    ? Math.min(positions, Math.max(1, Math.round(rawSelectedPosition)))
    : 1

  const hasAnyReferencedPortOnSwitch = electricalPorts.some((port) =>
    externallyReferencedPortIds.has(port.source_port_id),
  )

  const usedPortIds = new Set<string>()
  const throwSpecs: RotarySwitchThrowSpec[] = []

  for (let pole = 1; pole <= poles; pole++) {
    const commonPinNumber = poles * positions + pole
    const commonPort = findRotaryCommonPort({
      ports: electricalPorts,
      pole,
      poles,
      commonPinNumber,
      usedPortIds,
    })
    if (!commonPort) continue
    usedPortIds.add(commonPort.source_port_id)

    const resolvedThrows: Array<{ position: number; port: SourcePort }> = []
    for (let position = 1; position <= positions; position++) {
      const throwPinNumber = (pole - 1) * positions + position
      const throwPort = findRotaryThrowPort({
        ports: electricalPorts,
        pole,
        position,
        poles,
        throwPinNumber,
        usedPortIds,
      })
      if (!throwPort) continue
      usedPortIds.add(throwPort.source_port_id)
      resolvedThrows.push({ position, port: throwPort })
    }

    if (resolvedThrows.length === 0) continue

    if (hasAnyReferencedPortOnSwitch) {
      const poleHasExternalReference =
        externallyReferencedPortIds.has(commonPort.source_port_id) ||
        resolvedThrows.some(({ port }) =>
          externallyReferencedPortIds.has(port.source_port_id),
        )
      if (!poleHasExternalReference) {
        continue
      }
    }

    const commonNode = nodeMap.get(commonPort.source_port_id) ?? "0"
    for (const { position, port } of resolvedThrows) {
      const throwNode = nodeMap.get(port.source_port_id) ?? "0"
      throwSpecs.push({
        pole,
        position,
        commonNode,
        throwNode,
        isSelected: position === selectedPosition,
      })
    }
  }

  if (throwSpecs.length === 0) {
    return null
  }

  const sanitizedBase = getUniqueSwitchBaseName(netlist, component)
  const modelName = `SW_${sanitizedBase}`
  if (!netlist.models.has(modelName)) {
    netlist.models.set(
      modelName,
      `.MODEL ${modelName} SW(Ron=0.001 Roff=1e9 Vt=2.5 Vh=0.1)`,
    )
  }

  const onControlNode = `NCTRL_${sanitizedBase}_ON`
  const offControlNode = `NCTRL_${sanitizedBase}_OFF`

  if (throwSpecs.some((spec) => spec.isSelected)) {
    const onSourceName = `CTRL_${sanitizedBase}_ON`
    const onSourceCmd = new VoltageSourceCommand({
      name: onSourceName,
      positiveNode: onControlNode,
      negativeNode: "0",
      value: buildRotarySelectedControlValue(associatedSimulationSwitch),
    })
    netlist.addComponent(
      new SpiceComponent(onSourceName, onSourceCmd, [onControlNode, "0"]),
    )
  }

  if (throwSpecs.some((spec) => !spec.isSelected)) {
    const offSourceName = `CTRL_${sanitizedBase}_OFF`
    const offSourceCmd = new VoltageSourceCommand({
      name: offSourceName,
      positiveNode: offControlNode,
      negativeNode: "0",
      value: "DC 0",
    })
    netlist.addComponent(
      new SpiceComponent(offSourceName, offSourceCmd, [offControlNode, "0"]),
    )
  }

  const switchComponents = throwSpecs.map((spec) => {
    const switchName = `${sanitizedBase}_P${spec.pole}_T${spec.position}`
    const controlNode = spec.isSelected ? onControlNode : offControlNode
    const switchCmd = new VoltageControlledSwitchCommand({
      name: switchName,
      positiveNode: spec.commonNode,
      negativeNode: spec.throwNode,
      positiveControl: controlNode,
      negativeControl: "0",
      model: modelName,
    })
    return new SpiceComponent(switchName, switchCmd, [
      spec.commonNode,
      spec.throwNode,
      controlNode,
      "0",
    ])
  })

  for (let i = 0; i < switchComponents.length - 1; i++) {
    netlist.addComponent(switchComponents[i])
  }

  return switchComponents[switchComponents.length - 1]
}
