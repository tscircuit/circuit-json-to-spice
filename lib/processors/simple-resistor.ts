import { SpiceComponent } from "lib/spice-classes/SpiceComponent"
import { ResistorCommand } from "lib/spice-commands"
import type { AnyCircuitElement } from "circuit-json"
import { formatResistance } from "./helpers"

// SPICE cannot represent an ideal short as a resistor with exactly zero
// resistance. ngspice clamps zero-ohm resistors to this value internally and
// emits a warning, so emit the clamped value directly instead.
const MINIMUM_SPICE_RESISTANCE = 1e-12

export const processSimpleResistor = ({
  component,
  nodes,
}: {
  component: AnyCircuitElement
  nodes: string[]
}): SpiceComponent | null => {
  if ("resistance" in component && "name" in component) {
    const resistance = component.resistance as number
    const resistorCmd = new ResistorCommand({
      name: component.name as string,
      positiveNode: nodes[0] || "0",
      negativeNode: nodes[1] || "0",
      value: formatResistance(
        resistance === 0 ? MINIMUM_SPICE_RESISTANCE : resistance,
      ),
    })
    return new SpiceComponent(component.name as string, resistorCmd, nodes)
  }
  return null
}
