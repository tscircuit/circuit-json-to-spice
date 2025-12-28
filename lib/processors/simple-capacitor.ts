import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { CapacitorCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"
import { formatCapacitance } from "./helpers"

export const processSimpleCapacitor = ({
  component,
  nodes,
}: {
  component: AnyCircuitElement
  nodes: string[]
}): SpiceComponent | null => {
  if ("capacitance" in component && "name" in component) {
    const capacitorCmd = new CapacitorCommand({
      name: component.name as string,
      positiveNode: nodes[0] || "0",
      negativeNode: nodes[1] || "0",
      value: formatCapacitance(component.capacitance as number),
    })
    return new SpiceComponent(component.name as string, capacitorCmd, nodes)
  }
  return null
}
