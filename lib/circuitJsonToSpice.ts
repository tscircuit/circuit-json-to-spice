import { SpiceNetlist } from "./spice-classes/SpiceNetlist"
import { SpiceComponent } from "./spice-classes/SpiceComponent"
import { ResistorCommand } from "./spice-commands/ResistorCommand"
import { CapacitorCommand } from "./spice-commands/CapacitorCommand"
import { VoltageSourceCommand } from "./spice-commands/VoltageSourceCommand"
import { BJTCommand } from "./spice-commands/BJTCommand"
import { DiodeCommand } from "./spice-commands/DiodeCommand"
import { InductorCommand } from "./spice-commands/InductorCommand"
import { VoltageControlledSwitchCommand } from "./spice-commands/VoltageControlledSwitchCommand"
import type {
  AnyCircuitElement,
  SimulationSwitch,
  SimulationVoltageProbe,
} from "circuit-json"
import { getSourcePortConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import { su } from "@tscircuit/circuit-json-util"

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
        case "simple_switch": {
          const sanitizedBase = sanitizeIdentifier(
            component.name ?? component.source_component_id,
            "SW",
          )
          const positiveNode = nodes[0] || "0"
          const negativeNode = nodes[1] || "0"
          const controlNode = `NCTRL_${sanitizedBase}`
          const modelName = `SW_${sanitizedBase}`

          const associatedSimulationSwitch = simulationSwitchMap.get(
            component.source_component_id,
          )

          const controlValue = buildSimulationSwitchControlValue(
            associatedSimulationSwitch,
          )

          const switchCmd = new VoltageControlledSwitchCommand({
            name: sanitizedBase,
            positiveNode,
            negativeNode,
            positiveControl: controlNode,
            negativeControl: "0",
            model: modelName,
          })

          spiceComponent = new SpiceComponent(sanitizedBase, switchCmd, [
            positiveNode,
            negativeNode,
            controlNode,
            "0",
          ])

          if (!netlist.models.has(modelName)) {
            netlist.models.set(
              modelName,
              `.MODEL ${modelName} SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)`,
            )
          }

          const controlSourceName = `CTRL_${sanitizedBase}`
          const controlSourceCmd = new VoltageSourceCommand({
            name: controlSourceName,
            positiveNode: controlNode,
            negativeNode: "0",
            value: controlValue,
          })

          const controlComponent = new SpiceComponent(
            controlSourceName,
            controlSourceCmd,
            [controlNode, "0"],
          )

          netlist.addComponent(controlComponent)
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

            const channel_type = component.channel_type

            let positiveControl = gateNode
            let negativeControl = sourceNode
            if (channel_type === "p") {
              positiveControl = sourceNode
              negativeControl = gateNode
            }

            const modelName = "ENH_SW"
            if (!netlist.models.has(modelName)) {
              netlist.models.set(
                modelName,
                `.MODEL ${modelName} SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)`,
              )
            }

            const switchCmd = new VoltageControlledSwitchCommand({
              name: component.name,
              positiveNode: drainNode,
              negativeNode: sourceNode,
              positiveControl,
              negativeControl,
              model: modelName,
            })

            spiceComponent = new SpiceComponent(component.name, switchCmd, [
              drainNode,
              gateNode,
              sourceNode,
            ])
          }
          break
        }
        case "simple_transistor": {
          if ("name" in component) {
            const collectorPort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "collector" ||
                p.port_hints?.includes("collector"),
            )
            const basePort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "base" ||
                p.port_hints?.includes("base"),
            )
            const emitterPort = componentPorts.find(
              (p) =>
                p.name?.toLowerCase() === "emitter" ||
                p.port_hints?.includes("emitter"),
            )

            if (!collectorPort || !basePort || !emitterPort) {
              throw new Error(
                `Transistor ${component.name} is missing required ports (collector, base, emitter)`,
              )
            }

            const collectorNode =
              nodeMap.get(collectorPort.source_port_id) || "0"
            const baseNode = nodeMap.get(basePort.source_port_id) || "0"
            const emitterNode = nodeMap.get(emitterPort.source_port_id) || "0"

            const transistor_type = (component as any).transistor_type ?? "npn"
            const modelName = transistor_type.toUpperCase()
            if (!netlist.models.has(modelName)) {
              netlist.models.set(
                modelName,
                `.MODEL ${modelName} ${transistor_type.toUpperCase()}`,
              )
            }

            const bjtCmd = new BJTCommand({
              name: component.name,
              collector: collectorNode,
              base: baseNode,
              emitter: emitterNode,
              model: modelName,
            })
            spiceComponent = new SpiceComponent(component.name, bjtCmd, [
              collectorNode,
              baseNode,
              emitterNode,
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

  const simExperiment = circuitJson.find(
    (elm) => elm.type === "simulation_experiment",
  )

  if (simExperiment) {
    // Process simulation voltage probes
    if (simulationProbes.length > 0) {
      const nodesToProbe = new Set<string>()

      const getPortIdFromNetId = (netId: string) => {
        const trace = sourceTraces.find((t) =>
          t.connected_source_net_ids.includes(netId),
        )
        return trace?.connected_source_port_ids[0]
      }

      for (const probe of simulationProbes) {
        let signalPortId = probe.signal_input_source_port_id
        if (!signalPortId) {
          const signalNetId = probe.signal_input_source_net_id
          if (signalNetId) {
            signalPortId = getPortIdFromNetId(signalNetId)
          }
        }

        if (!signalPortId) continue

        const signalNodeName = nodeMap.get(signalPortId)
        if (!signalNodeName) continue

        let referencePortId = probe.reference_input_source_port_id
        if (!referencePortId && probe.reference_input_source_net_id) {
          referencePortId = getPortIdFromNetId(
            probe.reference_input_source_net_id,
          )
        }

        if (referencePortId) {
          const referenceNodeName = nodeMap.get(referencePortId)
          if (referenceNodeName && referenceNodeName !== "0") {
            nodesToProbe.add(`V(${signalNodeName},${referenceNodeName})`)
          } else if (signalNodeName !== "0") {
            nodesToProbe.add(`V(${signalNodeName})`)
          }
        } else {
          // Single-ended probe
          if (signalNodeName !== "0") {
            nodesToProbe.add(`V(${signalNodeName})`)
          }
        }
      }

      if (
        nodesToProbe.size > 0 &&
        (simExperiment as any).experiment_type?.includes("transient")
      ) {
        netlist.printStatements.push(
          `.PRINT TRAN ${[...nodesToProbe].join(" ")}`,
        )
      }
    }

    const timePerStep = (simExperiment as any).time_per_step
    const endTime = (simExperiment as any).end_time_ms
    const startTimeMs = (simExperiment as any).start_time_ms

    if (timePerStep && endTime) {
      // circuit-json values are in ms, SPICE requires seconds
      const startTime = (startTimeMs ?? 0) / 1000

      let tranCmd = `.tran ${formatNumberForSpice(
        timePerStep / 1000,
      )} ${formatNumberForSpice(endTime / 1000)}`
      if (startTime > 0) {
        tranCmd += ` ${formatNumberForSpice(startTime)}`
      }
      tranCmd += " UIC"
      netlist.tranCommand = tranCmd
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

function sanitizeIdentifier(value: string | undefined, prefix: string) {
  if (!value) return prefix
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_")
  if (!sanitized) return prefix
  if (/^[0-9]/.test(sanitized)) {
    return `${prefix}_${sanitized}`
  }
  return sanitized
}

function buildSimulationSwitchControlValue(
  simulationSwitch: SimulationSwitch | undefined,
) {
  const highVoltage = 5
  const lowVoltage = 0
  const riseTime = "1n"
  const fallTime = "1n"

  if (!simulationSwitch) {
    return `DC ${lowVoltage}`
  }

  const startsClosed = simulationSwitch.starts_closed ?? false
  const closesAt = simulationSwitch.closes_at ?? 0
  const opensAt = simulationSwitch.opens_at
  const switchingFrequency = simulationSwitch.switching_frequency

  const [initialVoltage, pulsedVoltage] = startsClosed
    ? [highVoltage, lowVoltage]
    : [lowVoltage, highVoltage]

  if (switchingFrequency && switchingFrequency > 0) {
    const period = 1 / switchingFrequency
    const widthFromOpenClose =
      opensAt && opensAt > closesAt ? Math.min(opensAt - closesAt, period) : 0
    const pulseWidth =
      widthFromOpenClose > 0 ? widthFromOpenClose : Math.max(period / 2, 1e-9)

    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  if (opensAt !== undefined && opensAt > closesAt) {
    const pulseWidth = Math.max(opensAt - closesAt, 1e-9)
    const period = closesAt + pulseWidth * 2

    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  if (closesAt > 0) {
    const period = closesAt * 2
    const pulseWidth = Math.max(period / 2, 1e-9)
    return `PULSE(${formatNumberForSpice(initialVoltage)} ${formatNumberForSpice(pulsedVoltage)} ${formatNumberForSpice(closesAt)} ${riseTime} ${fallTime} ${formatNumberForSpice(pulseWidth)} ${formatNumberForSpice(period)})`
  }

  return `DC ${startsClosed ? highVoltage : lowVoltage}`
}

function formatNumberForSpice(value: number) {
  if (!Number.isFinite(value)) return `${value}`
  if (value === 0) return "0"

  const absValue = Math.abs(value)

  if (absValue >= 1e3 || absValue <= 1e-3) {
    return Number(value.toExponential(6)).toString()
  }

  return Number(value.toPrecision(6)).toString()
}
