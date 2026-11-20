import type { SourcePort, SourceSimplePotentiometer } from "circuit-json"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { ResistorCommand } from "lib/spice-commands"
import { formatResistance, sanitizeIdentifier } from "./helpers"

const MINIMUM_SPICE_RESISTANCE = 1e-12
// Standard IEC / audio potentiometer taper: 10% of max resistance at 50% travel
// ((1 / 0.1 - 1)^2 = 81).
const LOG_TAPER_BASE = 81

export type PotentiometerTaper = "linear" | "log" | "logarithmic" | "antilog"

export interface SimulationPotentiometerConfig {
  source_component_id?: string
  wiper_position?: number
  sim_wiper_position?: number
  taper?: string
}

type ExtendedPotentiometerComponent = SourceSimplePotentiometer & {
  pin_variant?: "two_pin" | "three_pin"
  sim_wiper_position?: number
  wiper_position?: number
  taper?: string
  sim_taper?: string
}

const clampUnitInterval = (value: number): number =>
  Math.min(1, Math.max(0, value))

export const computePotentiometerResistanceRatio = (
  wiperPosition: number,
  taper: string | undefined,
): number => {
  const pos = clampUnitInterval(wiperPosition)
  switch (taper?.toLowerCase()) {
    case "log":
    case "logarithmic":
    case "audio":
      return (LOG_TAPER_BASE ** pos - 1) / (LOG_TAPER_BASE - 1)
    case "antilog":
    case "reverse_log":
    case "reverse-log":
      return 1 - (LOG_TAPER_BASE ** (1 - pos) - 1) / (LOG_TAPER_BASE - 1)
    default:
      return pos
  }
}

const clampSpiceResistance = (resistance: number): number => {
  const normalized = Number(resistance.toPrecision(12))
  return normalized <= 0 ? MINIMUM_SPICE_RESISTANCE : normalized
}

const findPotentiometerPort = (
  ports: SourcePort[],
  pinNumber: number,
  aliases: string[],
): SourcePort | undefined => {
  return ports.find((port) => {
    if (port.pin_number === pinNumber) return true
    const lowerName = port.name?.toLowerCase()
    if (lowerName && aliases.includes(lowerName)) return true
    return (
      port.port_hints?.some((hint) => aliases.includes(hint.toLowerCase())) ??
      false
    )
  })
}

const allocateResistorName = (
  desiredName: string,
  usedNames: Set<string>,
): string => {
  if (!usedNames.has(desiredName.toUpperCase())) {
    usedNames.add(desiredName.toUpperCase())
    return desiredName
  }
  let suffix = 2
  while (usedNames.has(`${desiredName}_${suffix}`.toUpperCase())) {
    suffix++
  }
  const uniqueName = `${desiredName}_${suffix}`
  usedNames.add(uniqueName.toUpperCase())
  return uniqueName
}

export const processSimplePotentiometer = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
  simulationPotentiometerMap,
  reservedResistorNames,
}: {
  netlist: SpiceNetlist
  component: SourceSimplePotentiometer
  componentPorts: SourcePort[]
  nodeMap: Map<string, string>
  simulationPotentiometerMap?: Map<string, SimulationPotentiometerConfig>
  reservedResistorNames?: Iterable<string>
}): SpiceComponent | null => {
  const pot = component as ExtendedPotentiometerComponent
  const maxResistance = pot.max_resistance
  if (
    typeof maxResistance !== "number" ||
    !Number.isFinite(maxResistance) ||
    maxResistance < 0
  ) {
    return null
  }

  const simConfig = simulationPotentiometerMap?.get(pot.source_component_id)
  const rawWiperPosition =
    simConfig?.sim_wiper_position ??
    simConfig?.wiper_position ??
    pot.sim_wiper_position ??
    pot.wiper_position
  const wiperPosition =
    typeof rawWiperPosition === "number" && Number.isFinite(rawWiperPosition)
      ? rawWiperPosition
      : 0.5

  const taper = simConfig?.taper ?? pot.sim_taper ?? pot.taper
  const ratio = computePotentiometerResistanceRatio(wiperPosition, taper)

  const baseName = sanitizeIdentifier(
    pot.name ?? pot.source_component_id,
    "POT",
  )
  const usedResistorNames = new Set(
    netlist.components
      .filter((existing) => existing.command.commandName === "resistor")
      .map((existing) => existing.name.toUpperCase()),
  )
  if (reservedResistorNames) {
    for (const reserved of reservedResistorNames) {
      usedResistorNames.add(reserved.toUpperCase())
    }
  }

  const pin1Port =
    findPotentiometerPort(componentPorts, 1, ["pin1", "1", "p1"]) ??
    componentPorts[0]
  const wiperPort =
    findPotentiometerPort(componentPorts, 2, [
      "pin2",
      "2",
      "wiper",
      "w",
      "p2",
    ]) ?? componentPorts[1]
  const pin3Port =
    findPotentiometerPort(componentPorts, 3, ["pin3", "3", "p3"]) ??
    (componentPorts.length >= 3 ? componentPorts[2] : undefined)

  const pin1Node = nodeMap.get(pin1Port?.source_port_id ?? "") || "0"
  const wiperNode = nodeMap.get(wiperPort?.source_port_id ?? "") || "0"

  const isTwoPinVariant =
    pot.pin_variant === "two_pin" ||
    (!pin3Port && pot.pin_variant !== "three_pin")

  if (isTwoPinVariant) {
    const rheostatName = allocateResistorName(baseName, usedResistorNames)
    const rheostatResistance = clampSpiceResistance(maxResistance * ratio)
    const rheostatCmd = new ResistorCommand({
      name: rheostatName,
      positiveNode: pin1Node,
      negativeNode: wiperNode,
      value: formatResistance(rheostatResistance),
    })
    return new SpiceComponent(rheostatName, rheostatCmd, [pin1Node, wiperNode])
  }

  const pin3Node = nodeMap.get(pin3Port?.source_port_id ?? "") || "0"
  const rawUpperResistance = maxResistance * ratio
  const rawLowerResistance = maxResistance - rawUpperResistance

  const r1Name = allocateResistorName(`${baseName}_1`, usedResistorNames)
  const r2Name = allocateResistorName(`${baseName}_2`, usedResistorNames)

  const r1Cmd = new ResistorCommand({
    name: r1Name,
    positiveNode: pin1Node,
    negativeNode: wiperNode,
    value: formatResistance(clampSpiceResistance(rawUpperResistance)),
  })
  netlist.addComponent(new SpiceComponent(r1Name, r1Cmd, [pin1Node, wiperNode]))

  const r2Cmd = new ResistorCommand({
    name: r2Name,
    positiveNode: wiperNode,
    negativeNode: pin3Node,
    value: formatResistance(clampSpiceResistance(rawLowerResistance)),
  })
  return new SpiceComponent(r2Name, r2Cmd, [wiperNode, pin3Node])
}
