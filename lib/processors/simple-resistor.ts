import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { ResistorCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"
import { formatResistance } from "./helpers"

export const processSimpleResistor = ({
  component,
  nodes,
}: {
  component: AnyCircuitElement
  nodes: string[]
}): SpiceComponent | null => {
  if ("resistance" in component && "name" in component) {
    const resistorCmd = new ResistorCommand({
      name: component.name as string,
      positiveNode: nodes[0] || "0",
      negativeNode: nodes[1] || "0",
      value: formatResistance(component.resistance as number),
    })
    return new SpiceComponent(component.name as string, resistorCmd, nodes)
  }
  return null
}
