import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { BJTCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"

export const processSimpleTransistor = ({
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
    const collectorPort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "collector" ||
        p.port_hints?.includes("collector"),
    ) as any
    const basePort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "base" || p.port_hints?.includes("base"),
    ) as any
    const emitterPort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "emitter" ||
        p.port_hints?.includes("emitter"),
    ) as any

    if (!collectorPort || !basePort || !emitterPort) {
      throw new Error(
        `Transistor ${(component as any).name} is missing required ports (collector, base, emitter)`,
      )
    }

    const collectorNode = nodeMap.get(collectorPort.source_port_id) || "0"
    const baseNode = nodeMap.get(basePort.source_port_id) || "0"
    const emitterNode = nodeMap.get(emitterPort.source_port_id) || "0"

    const transistor_type = (component as any).transistor_type ?? "npn"
    const modelName = transistor_type.toUpperCase()
    if (!netlist.models.has(modelName)) {
      netlist.models.set(
        modelName,
        `.MODEL ${modelName} ${transistor_type.toUpperCase()}`,
      )
    }

    const bjtCmd = new BJTCommand({
      name: component.name as string,
      collector: collectorNode,
      base: baseNode,
      emitter: emitterNode,
      model: modelName,
    })
    return new SpiceComponent(component.name as string, bjtCmd, [
      collectorNode,
      baseNode,
      emitterNode,
    ])
  }
  return null
}
