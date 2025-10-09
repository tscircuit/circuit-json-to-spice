import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

// A simple resistor divider circuit
const baseCircuit: AnyCircuitElement[] = [
  {
    type: "source_component",
    source_component_id: "R1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_port",
    source_port_id: "R1_p1",
    source_component_id: "R1",
    name: "p1",
  },
  {
    type: "source_port",
    source_port_id: "R1_p2",
    source_component_id: "R1",
    name: "p2",
  },
  {
    type: "source_component",
    source_component_id: "R2",
    name: "R2",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_port",
    source_port_id: "R2_p1",
    source_component_id: "R2",
    name: "p1",
  },
  {
    type: "source_port",
    source_port_id: "R2_p2",
    source_component_id: "R2",
    name: "p2",
  },
  {
    type: "source_trace",
    source_trace_id: "t1",
    connected_source_port_ids: ["R1_p2", "R2_p1"],
    connected_source_net_ids: ["net1"],
  },
  {
    type: "source_net",
    source_net_id: "net1",
    name: "VOUT",
    member_source_group_ids: [],
  },
  {
    type: "simulation_experiment",
    simulation_experiment_id: "se1",
    name: "Test Transient Analysis",
    experiment_type: "spice_transient_analysis" as const,
    time_per_step: 1, // ms
    end_time_ms: 100, // ms
  },
]

test("voltage probe with source_port_id creates .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "probe1",
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  const r1Match = /RR1 (N\d+) (N\d+)/.exec(spiceString)
  expect(r1Match).not.toBeNull()
  const r1p2Node = r1Match![2]

  expect(spiceString).toContain(`.PRINT TRAN V(${r1p2Node.toLowerCase()})`)
})

test("voltage probe with source_net_id creates .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      source_net_id: "net1",
      name: "probe2",
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  const r1Match = /RR1 (N\d+) (N\d+)/.exec(spiceString)
  expect(r1Match).not.toBeNull()
  const net1Node = r1Match![2]

  expect(spiceString).toContain(`.PRINT TRAN V(${net1Node.toLowerCase()})`)
})

test("voltage probe without transient analysis does not create .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit.filter((e) => e.type !== "simulation_experiment"),
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "probe1",
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).not.toContain(".PRINT")
})

test("voltage probe on ground node is ignored, but other probes are not", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "source_net",
      source_net_id: "gnd_net",
      name: "gnd",
      member_source_group_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "t_gnd",
      connected_source_port_ids: ["R2_p2"],
      connected_source_net_ids: ["gnd_net"],
    },
    {
      type: "simulation_voltage_probe",
      source_port_id: "R2_p2",
      name: "probe_gnd",
    } as any,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "probe_non_gnd",
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  const r1Match = /RR1 (N\d+) (N\d+)/.exec(spiceString)
  expect(r1Match).not.toBeNull()
  const r1p2Node = r1Match![2]

  // `R2_p2` is now connected to GND, so it's node 0 and should be ignored
  // `R1_p2` is a non-gnd node and should be printed.
  expect(spiceString).toContain(`.PRINT TRAN V(${r1p2Node.toLowerCase()})`)
  expect(spiceString).not.toContain("V(0)")
})

test("multiple voltage probes create single .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p1",
      name: "probe1",
    } as any,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "probe2",
    } as any,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  const r1Match = /RR1 (N\d+) (N\d+)/.exec(spiceString)
  expect(r1Match).not.toBeNull()
  const r1p1Node = r1Match![1]
  const r1p2Node = r1Match![2]

  // R1_p1 and R1_p2 are probed
  expect(spiceString).toContain(
    `.PRINT TRAN V(${r1p1Node.toLowerCase()}) V(${r1p2Node.toLowerCase()})`,
  )
})
