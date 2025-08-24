import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import { SpiceComponent } from "./spice-classes/SpiceComponent"
import { ResistorCommand } from "./spice-commands/ResistorCommand"
import { CapacitorCommand } from "./spice-commands/CapacitorCommand"
import { VoltageSourceCommand } from "./spice-commands/VoltageSourceCommand"
import type { AnyCircuitElement } from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { su } from "@tscircuit/soup-util"

export function circuitJsonToSpice(
  circuitJson: AnyCircuitElement[],
): SpiceNetlist {
  const netlist = new SpiceNetlist("* Circuit JSON to SPICE Netlist")
  const sourceComponents = su(circuitJson).source_component.list()
  const sourcePorts = su(circuitJson).source_port.list()

  const connMap = getSourcePortConnectivityMapFromCircuitJson(circuitJson)

  // Create node mapping from port connections
  const nodeMap = new Map<string, string>()
  const netToNodeName = new Map<string, string>()
  let nodeCounter = 1

  // Find ground node from ports named "GND"
  const groundPort = sourcePorts.find((p) => p.name?.toLowerCase() === "gnd")
  if (groundPort) {
    const groundNet = connMap.getNetConnectedToId(groundPort.source_port_id)
    if (groundNet) {
      netToNodeName.set(groundNet, "0")
    }
  }

  for (const simSource of su(circuitJson).simulation_voltage_source.list()) {
    const neg_port_id =
      (simSource as any).negative_source_port_id ??
      (simSource as any).terminal2_source_port_id
    if (neg_port_id) {
      const gnd_net = connMap.getNetConnectedToId(neg_port_id)
      if (gnd_net) {
        netToNodeName.set(gnd_net, "0")
      }
    }
  }

  for (const port of sourcePorts) {
    const portId = port.source_port_id
    const net = connMap.getNetConnectedToId(portId)
    if (net) {
      if (!netToNodeName.has(net)) {
        netToNodeName.set(net, `N${nodeCounter++}`)
      }
      nodeMap.set(portId, netToNodeName.get(net)!)
    }
  }

  // Process each component
  for (const component of sourceComponents) {
    if (component.type !== "source_component") continue

    const componentPorts = su(circuitJson)
      .source_port.list({
        source_component_id: component.source_component_id,
      })
      .sort((a, b) => (a.pin_number ?? 0) - (b.pin_number ?? 0))

    // Get node names for component ports
    const nodes = componentPorts.map((port) => {
      return nodeMap.get(port.source_port_id) || "0"
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

  // Process simulation voltage sources
  const simulationVoltageSources =
    su(circuitJson).simulation_voltage_source.list()

  for (const simSource of simulationVoltageSources) {
    if (simSource.type !== "simulation_voltage_source") continue

    if ((simSource as any).is_dc_source === false) {
      // AC Source
      if (
        "terminal1_source_port_id" in simSource &&
        "terminal2_source_port_id" in simSource &&
        (simSource as any).terminal1_source_port_id &&
        (simSource as any).terminal2_source_port_id
      ) {
        const positiveNode =
          nodeMap.get((simSource as any).terminal1_source_port_id) || "0"
        const negativeNode =
          nodeMap.get((simSource as any).terminal2_source_port_id) || "0"

        let value = ""
        if ((simSource as any).wave_shape === "sinewave") {
          const v_offset = 0 // not provided in circuitJson
          const v_peak = (simSource as any).voltage ?? 0
          const freq = (simSource as any).frequency ?? 0
          const delay = 0 // not provided in circuitJson
          const damping_factor = 0 // not provided in circuitJson
          const phase = (simSource as any).phase ?? 0
          value = `SIN(${v_offset} ${v_peak} ${freq} ${delay} ${damping_factor} ${phase})`
        }

        if (value) {
          const voltageSourceCmd = new VoltageSourceCommand({
            name: simSource.simulation_voltage_source_id,
            positiveNode,
            negativeNode,
            value,
          })

          const spiceComponent = new SpiceComponent(
            simSource.simulation_voltage_source_id,
            voltageSourceCmd,
            [positiveNode, negativeNode],
          )
          netlist.addComponent(spiceComponent)
        }
      }
    } else {
      // DC Source (is_dc_source is true or undefined)
      if (
        "positive_source_port_id" in simSource &&
        "negative_source_port_id" in simSource &&
        "voltage" in simSource &&
        (simSource as any).positive_source_port_id &&
        (simSource as any).negative_source_port_id
      ) {
        const positiveNode =
          nodeMap.get((simSource as any).positive_source_port_id) || "0"
        const negativeNode =
          nodeMap.get((simSource as any).negative_source_port_id) || "0"

        const voltageSourceCmd = new VoltageSourceCommand({
          name: simSource.simulation_voltage_source_id,
          positiveNode,
          negativeNode,
          value: `DC ${(simSource as any).voltage}`,
        })

        const spiceComponent = new SpiceComponent(
          simSource.simulation_voltage_source_id,
          voltageSourceCmd,
          [positiveNode, negativeNode],
        )
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
