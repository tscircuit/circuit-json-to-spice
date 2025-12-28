import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { InductorCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"
import { formatInductance } from "./helpers"

export const processSimpleInductor = ({
  component,
  nodes,
}: {
  component: AnyCircuitElement
  nodes: string[]
}): SpiceComponent | null => {
  if ("inductance" in component && "name" in component) {
    const inductorCmd = new InductorCommand({
      name: component.name as string,
      positiveNode: nodes[0] || "0",
      negativeNode: nodes[1] || "0",
      value: formatInductance(component.inductance as number),
    })
    return new SpiceComponent(component.name as string, inductorCmd, nodes)
  }
  return null
}
