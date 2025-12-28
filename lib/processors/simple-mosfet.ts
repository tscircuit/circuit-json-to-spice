import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { MOSFETCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"

export const processSimpleMosfet = ({
  netlist,
  component,
  componentPorts,
  nodeMap,
}: {
  netlist: SpiceNetlist
  component: AnyCircuitElement
  componentPorts: AnyCircuitElement[]
  nodeMap: Map<string, string>
}): SpiceComponent | null => {
  if ("name" in component) {
    const drainPort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "drain" || p.port_hints?.includes("drain"),
    ) as any
    const gatePort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "gate" || p.port_hints?.includes("gate"),
    ) as any
    const sourcePort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "source" || p.port_hints?.includes("source"),
    ) as any

    const drainNode = nodeMap.get(drainPort?.source_port_id ?? "") || "0"
    const gateNode = nodeMap.get(gatePort?.source_port_id ?? "") || "0"
    const sourceNode = nodeMap.get(sourcePort?.source_port_id ?? "") || "0"

    // For 3-pin MOSFETs, substrate is typically connected to source
    const substrateNode = sourceNode

    const channel_type = (component as any).channel_type ?? "n"
    const mosfet_mode = (component as any).mosfet_mode ?? "enhancement"

    const modelType = `${channel_type.toUpperCase()}MOS`
    const modelName = `${modelType}_${mosfet_mode.toUpperCase()}`

    if (!netlist.models.has(modelName)) {
      if (mosfet_mode === "enhancement") {
        const vto = channel_type === "p" ? -1 : 1
        netlist.models.set(
          modelName,
          `.MODEL ${modelName} ${modelType} (VTO=${vto} KP=0.1)`,
        )
      } else {
        netlist.models.set(
          modelName,
          `.MODEL ${modelName} ${modelType} (KP=0.1)`,
        )
      }
    }

    const mosfetCmd = new MOSFETCommand({
      name: component.name as string,
      drain: drainNode,
      gate: gateNode,
      source: sourceNode,
      substrate: substrateNode,
      model: modelName,
    })

    return new SpiceComponent(component.name as string, mosfetCmd, [
      drainNode,
      gateNode,
      sourceNode,
    ])
  }
  return null
}
