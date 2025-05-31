import type { SpiceNetlist } from "../spice-classes/SpiceNetlist"

export const convertSpiceNetlistToString = (netlist: SpiceNetlist): string => {
  const lines: string[] = []
  
  // Title line (required first line in SPICE)
  lines.push(netlist.title)
  
  // Component lines
  for (const component of netlist.components) {
    lines.push(component.toSpiceString())
  }
  
  // End with .END
  lines.push(".END")
  
  return lines.join("\n")
}
