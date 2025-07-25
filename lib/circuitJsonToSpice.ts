import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import { SpiceComponent } from "./spice-classes/SpiceComponent"
import { ResistorCommand } from "./spice-commands/ResistorCommand"
import { CapacitorCommand } from "./spice-commands/CapacitorCommand"

export function circuitJsonToSpice(circuitJson: any[]): SpiceNetlist {
  const netlist = new SpiceNetlist("Circuit JSON to SPICE Netlist")

  // Extract components and ports for node mapping
  const sourceComponents = circuitJson.filter(
    (el) => el.type === "source_component",
  )
  const sourcePorts = circuitJson.filter((el) => el.type === "source_port")
  const sourceTraces = circuitJson.filter((el) => el.type === "source_trace")

  // Create node mapping from port connections
  const nodeMap = new Map<string, string>()
  let nodeCounter = 1

  // Process traces to create node assignments
  for (const trace of sourceTraces) {
    if (trace.type === "source_trace") {
      const connectedPorts = trace.connected_source_port_ids || []
      if (connectedPorts.length > 0) {
        const nodeName = `N${nodeCounter++}`
        for (const portId of connectedPorts) {
          nodeMap.set(portId, nodeName)
        }
      }
    }
  }

  // Process each component
  for (const component of sourceComponents) {
    if (component.type !== "source_component") continue

    const componentPorts = sourcePorts.filter(
      (port): port is typeof port & { type: "source_port" } =>
        port.type === "source_port" &&
        port.source_component_id === component.source_component_id,
    )

    // Get node names for component ports
    const nodes = componentPorts.map((port) => {
      const nodeName = nodeMap.get(port.source_port_id)
      return nodeName || `N${nodeCounter++}` // Create new node if not found
    })

    // Create SPICE component based on type
    if ("ftype" in component) {
      let spiceComponent: SpiceComponent | null = null

      switch (component.ftype) {
        case "simple_resistor": {
          if ("resistance" in component && "name" in component) {
            const resistorCmd = new ResistorCommand({
              name: component.name,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatResistance(component.resistance),
            })
            spiceComponent = new SpiceComponent(
              component.name,
              resistorCmd,
              nodes,
            )
          }
          break
        }

        case "simple_capacitor": {
          if ("capacitance" in component && "name" in component) {
            const capacitorCmd = new CapacitorCommand({
              name: component.name,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatCapacitance(component.capacitance),
            })
            spiceComponent = new SpiceComponent(
              component.name,
              capacitorCmd,
              nodes,
            )
          }
          break
        }
      }

      if (spiceComponent) {
        netlist.addComponent(spiceComponent)
      }
    }
  }

  return netlist
}

function formatResistance(resistance: number): string {
  if (resistance >= 1e6) return `${resistance / 1e6}MEG`
  if (resistance >= 1e3) return `${resistance / 1e3}K`
  return resistance.toString()
}

function formatCapacitance(capacitance: number): string {
  if (capacitance >= 1e-3) return `${capacitance * 1e3}M`
  if (capacitance >= 1e-6) return `${capacitance * 1e6}U`
  if (capacitance >= 1e-9) return `${capacitance * 1e9}N`
  if (capacitance >= 1e-12) return `${capacitance * 1e12}P`
  return capacitance.toString()
}
