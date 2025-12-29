import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import { SpiceComponent } from "./spice-classes/SpiceComponent"
import type {
  AnyCircuitElement,
  SimulationSwitch,
  SimulationVoltageProbe,
  SourceSimpleDiode,
  SourceSimpleMosfet,
  SourceSimpleSwitch,
  SourceSimpleTransistor,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { su } from "@tscircuit/circuit-json-util"
import { processSimpleResistor } from "./processors/simple-resistor"
import { processSimpleSwitch } from "./processors/simple-switch"
import { processSimpleCapacitor } from "./processors/simple-capacitor"
import { processSimpleDiode } from "./processors/simple-diode"
import { processSimpleInductor } from "./processors/simple-inductor"
import { processSimpleMosfet } from "./processors/simple-mosfet"
import { processSimpleTransistor } from "./processors/simple-transistor"
import { processSimulationVoltageSources } from "./processors/process-simulation-voltage-sources"
import { processSimulationCurrentSources } from "./processors/process-simulation-current-sources"
import { processSimulationExperiment } from "./processors/process-simulation-experiment"

export function circuitJsonToSpice(
  circuitJson: AnyCircuitElement[],
): SpiceNetlist {
  const netlist = new SpiceNetlist("* Circuit JSON to SPICE Netlist")
  const sourceComponents = su(circuitJson).source_component.list()
  const sourcePorts = su(circuitJson).source_port.list()
  const sourceTraces = su(circuitJson).source_trace.list()
  const simulationProbes = circuitJson.filter(
    (elm) => elm.type === "simulation_voltage_probe",
  ) as SimulationVoltageProbe[]
  const simulationSwitches = circuitJson
    .filter(
      (element) => (element as { type?: string }).type === "simulation_switch",
    )
    .map((element) => element as unknown as SimulationSwitch)
  const simulationSwitchMap = new Map<string, SimulationSwitch>()

  for (const simSwitch of simulationSwitches) {
    if (simSwitch.source_component_id) {
      simulationSwitchMap.set(simSwitch.source_component_id, simSwitch)
    }
  }

  const connMap = getSourcePortConnectivityMapFromCircuitJson(circuitJson)

  // Create node mapping from port connections
  const nodeMap = new Map<string, string>()
  const netToNodeName = new Map<string, string>()
  let nodeCounter = 1

  const probeNames = new Set<string>()
  if (simulationProbes.length > 0) {
    for (const probe of simulationProbes) {
      if (probe.name) {
        probeNames.add(probe.name)
      }
    }
  }

  // If there are probe names like N1, N2, make sure we don't have conflicts
  const numericProbeNames = [...probeNames]
    .map((name) => /^N(\d+)$/i.exec(name))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => parseInt(m[1], 10))

  if (numericProbeNames.length > 0) {
    nodeCounter = Math.max(...numericProbeNames) + 1
  }

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

  // Pre-assign node names from voltage probes
  if (simulationProbes.length > 0) {
    for (const probe of simulationProbes) {
      if (!probe.name) continue

      if (
        probe.reference_input_source_port_id ||
        probe.reference_input_source_net_id
      ) {
        continue
      }

      let net: string | undefined | null
      const signal_port_id = probe.signal_input_source_port_id
      const signal_net_id = probe.signal_input_source_net_id

      if (signal_port_id) {
        net = connMap.getNetConnectedToId(signal_port_id)
      } else if (signal_net_id) {
        const trace = sourceTraces.find((t) =>
          t.connected_source_net_ids.includes(signal_net_id!),
        )
        if (trace && trace.connected_source_port_ids.length > 0) {
          const portId = trace.connected_source_port_ids[0]
          net = connMap.getNetConnectedToId(portId)
        }
      }

      if (net) {
        if (!netToNodeName.has(net)) {
          netToNodeName.set(net, probe.name)
        }
      } else if (signal_port_id && probe.name) {
        // It's a floating port with a probe, so we map it directly. This port
        // will now be skipped in the second-pass for unconnected ports.
        nodeMap.set(signal_port_id, probe.name)
      }
    }
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

      switch ((component as { ftype: string }).ftype) {
        case "simple_resistor": {
          spiceComponent = processSimpleResistor({ component, nodes })
          break
        }
        case "simple_switch": {
          spiceComponent = processSimpleSwitch({
            netlist,
            component: component as SourceSimpleSwitch,
            nodes,
            simulationSwitchMap,
          })
          break
        }
        case "simple_capacitor": {
          spiceComponent = processSimpleCapacitor({ component, nodes })
          break
        }
        case "simple_diode": {
          spiceComponent = processSimpleDiode({
            netlist,
            component: component as SourceSimpleDiode,
            componentPorts,
            nodeMap,
          })
          break
        }
        case "simple_inductor": {
          spiceComponent = processSimpleInductor({ component, nodes })
          break
        }
        case "simple_mosfet": {
          spiceComponent = processSimpleMosfet({
            netlist,
            component: component as SourceSimpleMosfet,
            componentPorts,
            nodeMap,
          })
          break
        }
        case "simple_transistor": {
          spiceComponent = processSimpleTransistor({
            netlist,
            component: component as SourceSimpleTransistor,
            componentPorts,
            nodeMap,
          })
          break
        }
      }

      if (spiceComponent) {
        netlist.addComponent(spiceComponent)
      }
    }
  }

  processSimulationVoltageSources(
    netlist,
    su(circuitJson).simulation_voltage_source.list(),
    nodeMap,
  )

  processSimulationCurrentSources(
    netlist,
    su(circuitJson).simulation_current_source.list(),
    nodeMap,
  )

  const simulationExperiment = circuitJson.find(
    (elm) => elm.type === "simulation_experiment",
  )
  if (simulationExperiment)
    processSimulationExperiment(
      netlist,
      simulationExperiment,
      simulationProbes,
      sourceTraces,
      nodeMap,
    )

  return netlist
}
