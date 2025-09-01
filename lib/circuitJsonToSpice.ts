import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import { SpiceComponent } from "./spice-classes/SpiceComponent"
import { ResistorCommand } from "./spice-commands/ResistorCommand"
import { CapacitorCommand } from "./spice-commands/CapacitorCommand"
import { VoltageSourceCommand } from "./spice-commands/VoltageSourceCommand"
import { DiodeCommand } from "./spice-commands/DiodeCommand"
import { InductorCommand } from "./spice-commands/InductorCommand"
import { VoltageControlledSwitchCommand } from "./spice-commands/VoltageControlledSwitchCommand"
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

  const groundNets = new Set<string>()

  // Find ground from source nets that include "gnd" in the name
  const gndSourceNetIds = new Set(
    su(circuitJson)
      .source_net.list()
      .filter((sn) => sn.name?.toLowerCase().includes("gnd"))
      .map((sn) => sn.source_net_id),
  )

  if (gndSourceNetIds.size > 0) {
    for (const trace of su(circuitJson).source_trace.list()) {
      if (trace.connected_source_port_ids.length > 0) {
        const isOnGndNet = trace.connected_source_net_ids.some((netId) =>
          gndSourceNetIds.has(netId),
        )
        if (isOnGndNet) {
          const aPortOnGnd = trace.connected_source_port_ids[0]
          const gndNet = connMap.getNetConnectedToId(aPortOnGnd)
          if (gndNet) {
            groundNets.add(gndNet)
          }
        }
      }
    }
  }

  // Find ground node from ports named "GND"
  const groundPorts = sourcePorts.filter((p) => p.name?.toLowerCase() === "gnd")
  for (const groundPort of groundPorts) {
    const groundNet = connMap.getNetConnectedToId(groundPort.source_port_id)
    if (groundNet) {
      groundNets.add(groundNet)
    }
  }

  for (const simSource of su(circuitJson).simulation_voltage_source.list()) {
    const neg_port_id =
      (simSource as any).negative_source_port_id ??
      (simSource as any).terminal2_source_port_id
    if (neg_port_id) {
      const gnd_net = connMap.getNetConnectedToId(neg_port_id)
      if (gnd_net) {
        groundNets.add(gnd_net)
      }
    }
  }

  for (const groundNet of groundNets) {
    netToNodeName.set(groundNet, "0")
  }

  // First pass: assign node numbers to all connected nets
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

  // Second pass: assign node numbers to unconnected ports
  for (const port of sourcePorts) {
    const portId = port.source_port_id
    // If a port wasn't in a net, it won't be in the nodeMap yet
    if (!nodeMap.has(portId)) {
      // Unconnected port, create a new floating node for it
      nodeMap.set(portId, `N${nodeCounter++}`)
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
        case "simple_diode": {
          if ("name" in component) {
            const anodePort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "anode" ||
                p.port_hints?.includes("anode"),
            )
            const cathodePort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "cathode" ||
                p.port_hints?.includes("cathode"),
            )
            const positiveNode =
              nodeMap.get(anodePort?.source_port_id ?? "") || "0"
            const negativeNode =
              nodeMap.get(cathodePort?.source_port_id ?? "") || "0"

            const modelName = "D"
            const diodeCmd = new DiodeCommand({
              name: component.name,
              positiveNode,
              negativeNode,
              model: modelName, // generic model
            })
            netlist.models.set(modelName, `.MODEL ${modelName} D`)
            spiceComponent = new SpiceComponent(component.name, diodeCmd, [
              positiveNode,
              negativeNode,
            ])
          }
          break
        }
        case "simple_inductor": {
          if ("inductance" in component && "name" in component) {
            const inductorCmd = new InductorCommand({
              name: component.name,
              positiveNode: nodes[0] || "0",
              negativeNode: nodes[1] || "0",
              value: formatInductance(component.inductance),
            })
            spiceComponent = new SpiceComponent(
              component.name,
              inductorCmd,
              nodes,
            )
          }
          break
        }
        case "simple_mosfet": {
          if ("name" in component) {
            const drainPort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "drain" ||
                p.port_hints?.includes("drain"),
            )
            const gatePort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "gate" ||
                p.port_hints?.includes("gate"),
            )
            const sourcePort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "source" ||
                p.port_hints?.includes("source"),
            )

            const drainNode =
              nodeMap.get(drainPort?.source_port_id ?? "") || "0"
            const gateNode = nodeMap.get(gatePort?.source_port_id ?? "") || "0"
            const sourceNode =
              nodeMap.get(sourcePort?.source_port_id ?? "") || "0"

            const modelName = "SWMOD"
            const switchCmd = new VoltageControlledSwitchCommand({
              name: component.name,
              positiveNode: drainNode,
              negativeNode: sourceNode,
              positiveControl: gateNode,
              negativeControl: sourceNode,
              model: modelName,
            })
            netlist.models.set(modelName, `.MODEL ${modelName} SW`)

            spiceComponent = new SpiceComponent(component.name, switchCmd, [
              drainNode,
              gateNode,
              sourceNode,
            ])
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
        const wave_shape = (simSource as any).wave_shape
        if (wave_shape === "sinewave") {
          const v_offset = 0 // not provided in circuitJson
          const v_peak = (simSource as any).voltage ?? 0
          const freq = (simSource as any).frequency ?? 0
          const delay = 0 // not provided in circuitJson
          const damping_factor = 0 // not provided in circuitJson
          const phase = (simSource as any).phase ?? 0
          if (freq > 0) {
            value = `SIN(${v_offset} ${v_peak} ${freq} ${delay} ${damping_factor} ${phase})`
          } else {
            value = `DC ${(simSource as any).voltage ?? 0}`
          }
        } else if (wave_shape === "square") {
          const v_initial = 0
          const v_pulsed = (simSource as any).voltage ?? 0
          const freq = (simSource as any).frequency ?? 0
          const period_from_freq = freq === 0 ? Infinity : 1 / freq
          const period = (simSource as any).period ?? period_from_freq
          const duty_cycle = (simSource as any).duty_cycle ?? 0.5
          const pulse_width = period * duty_cycle
          const delay = 0
          const rise_time = "1n"
          const fall_time = "1n"
          value = `PULSE(${v_initial} ${v_pulsed} ${delay} ${rise_time} ${fall_time} ${pulse_width} ${period})`
        } else if ((simSource as any).voltage !== undefined) {
          value = `DC ${(simSource as any).voltage}`
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
      const positivePortId =
        (simSource as any).positive_source_port_id ??
        (simSource as any).terminal1_source_port_id
      const negativePortId =
        (simSource as any).negative_source_port_id ??
        (simSource as any).terminal2_source_port_id

      if (
        positivePortId &&
        negativePortId &&
        "voltage" in simSource &&
        (simSource as any).voltage !== undefined
      ) {
        const positiveNode = nodeMap.get(positivePortId) || "0"
        const negativeNode = nodeMap.get(negativePortId) || "0"

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

function formatInductance(inductance: number): string {
  if (inductance >= 1) return inductance.toString()
  if (inductance >= 1e-3) return `${inductance * 1e3}m`
  if (inductance >= 1e-6) return `${inductance * 1e6}u`
  if (inductance >= 1e-9) return `${inductance * 1e9}n`
  if (inductance >= 1e-12) return `${inductance * 1e12}p`
  return inductance.toString()
}
