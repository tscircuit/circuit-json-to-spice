import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import {
  BJTCommand,
  JFETCommand,
  MOSFETCommand,
  SubcircuitCallCommand,
} from "lib/spice-commands"
import type { SourcePort, SourceSimpleTransistor } from "circuit-json"

const IGBT_SUBCIRCUIT_NAME = "GENERIC_IGBT"
const IGBT_SUBCIRCUIT_DEFINITION = [
  `.SUBCKT ${IGBT_SUBCIRCUIT_NAME} collector gate emitter`,
  "M1 base_int gate emitter emitter IGBT_NMOS",
  "R_BLEED collector base_int 1G",
  "Q1 emitter base_int collector IGBT_PNP",
  ".MODEL IGBT_NMOS NMOS (VTO=2 KP=0.5)",
  ".MODEL IGBT_PNP PNP (BF=50)",
  `.ENDS ${IGBT_SUBCIRCUIT_NAME}`,
].join("\n")

const BJT_MODEL_TYPES: Record<string, "NPN" | "PNP"> = {
  npn: "NPN",
  pnp: "PNP",
  bjt: "NPN",
}

const findPortByHints = (
  componentPorts: SourcePort[],
  aliases: readonly string[],
): SourcePort | undefined => {
  for (const alias of aliases) {
    const port = componentPorts.find(
      (p) => p.name?.toLowerCase() === alias || p.port_hints?.includes(alias),
    )
    if (port) return port
  }
  return undefined
}

const getPortNode = (port: SourcePort, nodeMap: Map<string, string>) =>
  nodeMap.get(port.source_port_id) || "0"

export const processSimpleTransistor = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
}: {
  netlist: SpiceNetlist
  component: SourceSimpleTransistor
  componentPorts: SourcePort[]
  nodeMap: Map<string, string>
}): SpiceComponent | null => {
  if (!("name" in component)) {
    return null
  }

  const componentName = component.name as string
  const transistorType = (component.transistor_type ?? "npn").toLowerCase()

  if (transistorType === "jfet" || transistorType === "mosfet") {
    const drainPort = findPortByHints(componentPorts, ["drain", "collector"])
    const gatePort = findPortByHints(componentPorts, ["gate", "base"])
    const sourcePort = findPortByHints(componentPorts, ["source", "emitter"])

    if (!drainPort || !gatePort || !sourcePort) {
      throw new Error(
        `Transistor ${componentName} is missing required ports (drain, gate, source)`,
      )
    }

    const drainNode = getPortNode(drainPort, nodeMap)
    const gateNode = getPortNode(gatePort, nodeMap)
    const sourceNode = getPortNode(sourcePort, nodeMap)

    if (transistorType === "jfet") {
      const modelName = "NJF"
      if (!netlist.models.has(modelName)) {
        netlist.models.set(modelName, `.MODEL ${modelName} NJF`)
      }
      const jfetCmd = new JFETCommand({
        name: componentName,
        drain: drainNode,
        gate: gateNode,
        source: sourceNode,
        model: modelName,
      })
      return new SpiceComponent(componentName, jfetCmd, [
        drainNode,
        gateNode,
        sourceNode,
      ])
    }

    const modelName = "NMOS"
    if (!netlist.models.has(modelName)) {
      netlist.models.set(modelName, `.MODEL ${modelName} NMOS (VTO=1 KP=0.1)`)
    }
    const mosfetCmd = new MOSFETCommand({
      name: componentName,
      drain: drainNode,
      gate: gateNode,
      source: sourceNode,
      substrate: sourceNode,
      model: modelName,
    })
    return new SpiceComponent(componentName, mosfetCmd, [
      drainNode,
      gateNode,
      sourceNode,
      sourceNode,
    ])
  }

  const collectorPort = findPortByHints(componentPorts, ["collector"])
  const basePort = findPortByHints(
    componentPorts,
    transistorType === "igbt" ? ["gate", "base"] : ["base"],
  )
  const emitterPort = findPortByHints(componentPorts, ["emitter"])

  if (!collectorPort || !basePort || !emitterPort) {
    throw new Error(
      `Transistor ${componentName} is missing required ports (collector, base, emitter)`,
    )
  }

  const collectorNode = getPortNode(collectorPort, nodeMap)
  const baseNode = getPortNode(basePort, nodeMap)
  const emitterNode = getPortNode(emitterPort, nodeMap)

  if (transistorType === "igbt") {
    if (!netlist.models.has(IGBT_SUBCIRCUIT_NAME)) {
      netlist.models.set(IGBT_SUBCIRCUIT_NAME, IGBT_SUBCIRCUIT_DEFINITION)
    }
    const igbtCmd = new SubcircuitCallCommand({
      name: componentName,
      nodes: [collectorNode, baseNode, emitterNode],
      subcircuitName: IGBT_SUBCIRCUIT_NAME,
    })
    return new SpiceComponent(componentName, igbtCmd, [
      collectorNode,
      baseNode,
      emitterNode,
    ])
  }

  const bjtModelType = BJT_MODEL_TYPES[transistorType] ?? "NPN"
  if (!netlist.models.has(bjtModelType)) {
    netlist.models.set(bjtModelType, `.MODEL ${bjtModelType} ${bjtModelType}`)
  }

  const bjtCmd = new BJTCommand({
    name: componentName,
    collector: collectorNode,
    base: baseNode,
    emitter: emitterNode,
    model: bjtModelType,
  })
  return new SpiceComponent(componentName, bjtCmd, [
    collectorNode,
    baseNode,
    emitterNode,
  ])
}
