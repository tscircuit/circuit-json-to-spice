import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { DiodeCommand } from "lib/spice-commands"
import type {
  SourcePort,
  SourceSimpleDiode,
  SourceSimpleLed,
} from "circuit-json"

const ANODE_TOKENS = new Set(["anode", "pos", "positive", "+", "a"])
const CATHODE_TOKENS = new Set(["cathode", "neg", "negative", "-", "k"])

const portMatchesTokens = (port: SourcePort, tokens: Set<string>): boolean => {
  const normalizedName = port.name?.trim().toLowerCase()
  if (normalizedName && tokens.has(normalizedName)) return true
  return (
    port.port_hints?.some((hint) => tokens.has(hint.trim().toLowerCase())) ??
    false
  )
}

const getDiodeNodes = (
  componentPorts: SourcePort[],
  nodeMap: Map<string, string>,
) => {
  const matchedAnodePort = componentPorts.find((p) =>
    portMatchesTokens(p, ANODE_TOKENS),
  )
  const matchedCathodePort = componentPorts.find(
    (p) => p !== matchedAnodePort && portMatchesTokens(p, CATHODE_TOKENS),
  )

  const anodePort =
    matchedAnodePort ??
    componentPorts.find((p) => p !== matchedCathodePort) ??
    componentPorts[0]
  const cathodePort =
    matchedCathodePort ??
    componentPorts.find((p) => p !== anodePort) ??
    componentPorts[1]

  return {
    positiveNode: nodeMap.get(anodePort?.source_port_id ?? "") || "0",
    negativeNode: nodeMap.get(cathodePort?.source_port_id ?? "") || "0",
  }
}

const processDiodeLikeComponent = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
  modelName,
  modelDefinition,
}: {
  netlist: SpiceNetlist
  component: SourceSimpleDiode | SourceSimpleLed
  componentPorts: SourcePort[]
  nodeMap: Map<string, string>
  modelName: string
  modelDefinition: string
}): SpiceComponent | null => {
  if ("name" in component) {
    const { positiveNode, negativeNode } = getDiodeNodes(
      componentPorts,
      nodeMap,
    )

    const diodeCmd = new DiodeCommand({
      name: component.name as string,
      positiveNode,
      negativeNode,
      model: modelName,
    })
    netlist.models.set(modelName, modelDefinition)
    return new SpiceComponent(component.name as string, diodeCmd, [
      positiveNode,
      negativeNode,
    ])
  }
  return null
}

export const processSimpleDiode = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
}: {
  netlist: SpiceNetlist
  component: SourceSimpleDiode
  componentPorts: SourcePort[]
  nodeMap: Map<string, string>
}): SpiceComponent | null => {
  return processDiodeLikeComponent({
    netlist,
    component,
    componentPorts,
    nodeMap,
    modelName: "D",
    modelDefinition: ".MODEL D D",
  })
}

export const processSimpleLed = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
}: {
  netlist: SpiceNetlist
  component: SourceSimpleLed
  componentPorts: SourcePort[]
  nodeMap: Map<string, string>
}): SpiceComponent | null => {
  return processDiodeLikeComponent({
    netlist,
    component,
    componentPorts,
    nodeMap,
    modelName: "LED",
    modelDefinition:
      ".MODEL LED D(IS=1e-20 N=2 RS=10 CJO=2p EG=2.1 BV=5 IBV=10u)",
  })
}
