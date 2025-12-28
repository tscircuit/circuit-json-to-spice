import type { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { DiodeCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"

export const processSimpleDiode = ({
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
    const anodePort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "anode" || p.port_hints?.includes("anode"),
    ) as any
    const cathodePort = componentPorts.find(
      (p: any) =>
        p.name?.toLowerCase() === "cathode" ||
        p.port_hints?.includes("cathode"),
    ) as any
    const positiveNode = nodeMap.get(anodePort?.source_port_id ?? "") || "0"
    const negativeNode = nodeMap.get(cathodePort?.source_port_id ?? "") || "0"

    const modelName = "D"
    const diodeCmd = new DiodeCommand({
      name: component.name as string,
      positiveNode,
      negativeNode,
      model: modelName, // generic model
    })
    netlist.models.set(modelName, `.MODEL ${modelName} D`)
    return new SpiceComponent(component.name as string, diodeCmd, [
      positiveNode,
      negativeNode,
    ])
  }
  return null
}
