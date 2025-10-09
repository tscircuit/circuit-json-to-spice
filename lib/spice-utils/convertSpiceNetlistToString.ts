import type { SpiceNetlist } from "../spice-classes/SpiceNetlist"

export const convertSpiceNetlistToString = (netlist: SpiceNetlist): string => {
  const lines: string[] = []

  // Title line (required first line in SPICE)
  lines.push(netlist.title)

  // Add models
  if (netlist.models.size > 0) {
    lines.push(...Array.from(netlist.models.values()))
  }

  // Component lines
  for (const component of netlist.components) {
    lines.push(component.toSpiceString())
  }

  // Add subcircuit definitions
  for (const subcircuit of netlist.subcircuits) {
    lines.push(subcircuit.toSpiceString())
  }

  if (netlist.printStatements.length > 0) {
    lines.push(...netlist.printStatements)
  }

  // Add control block if present
  if (netlist.controls.length > 0) {
    lines.push(".control")
    lines.push(...netlist.controls)
    lines.push(".endc")
  }

  if (
    netlist.tranCommand &&
    !lines.some((l) => l.trim().toLowerCase().startsWith(".tran"))
  ) {
    lines.push(netlist.tranCommand)
  }

  // End with .END
  lines.push(".END")

  return lines.join("\n")
}
