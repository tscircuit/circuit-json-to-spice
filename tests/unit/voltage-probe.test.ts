import { expect, test } from "bun:test"
import type { AnyCircuitElement, SimulationVoltageProbe } from "circuit-json"
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
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "R1_p2",
    source_component_id: "R1",
    name: "p2",
    pin_number: 2,
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
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "R2_p2",
    source_component_id: "R2",
    name: "p2",
    pin_number: 2,
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
      name: "VOUT",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(`.PRINT TRAN V(VOUT)`)
  expect(spiceString).toContain(`RR1 N1 VOUT 1K`)
  expect(spiceString).toContain(`RR2 VOUT N2 1K`)
})

test("voltage probe with source_net_id creates .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      source_net_id: "net1",
      name: "VOUT",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(`.PRINT TRAN V(VOUT)`)
  expect(spiceString).toContain(`RR1 N1 VOUT 1K`)
  expect(spiceString).toContain(`RR2 VOUT N2 1K`)
})

test("voltage probe without transient analysis does not create .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit.filter((e) => e.type !== "simulation_experiment"),
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "VOUT",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).not.toContain(".PRINT")
  expect(spiceString).toContain("RR1 N1 VOUT 1K")
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
    } as SimulationVoltageProbe,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "VOUT",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  // `R2_p2` is now connected to GND, so it's node 0 and should be ignored
  // `R1_p2` is a non-gnd node and should be printed.
  expect(spiceString).toContain(`.PRINT TRAN V(VOUT)`)
  expect(spiceString).not.toContain("V(0)")
  expect(spiceString).toContain("RR1 N1 VOUT 1K")
  expect(spiceString).toContain("RR2 VOUT 0 1K")
})

test("multiple voltage probes create single .PRINT statement", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p1",
      name: "N1",
    } as SimulationVoltageProbe,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p2",
      name: "VOUT",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  // R1_p1 is probed as "N1", R1_p2 probed as "VOUT"
  expect(spiceString).toContain("RR1 N1 VOUT 1K")
  expect(spiceString).toContain("RR2 VOUT N2 1K")

  // The order of probes in the .PRINT statement is not guaranteed
  expect(spiceString).toContain(".PRINT TRAN")
  expect(spiceString).toContain("V(N1)")
  expect(spiceString).toContain("V(VOUT)")
})

test("probes with N-style names don't conflict with auto-generated names", () => {
  const circuitJson: AnyCircuitElement[] = [
    // R1
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
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: "R1_p2",
      source_component_id: "R1",
      name: "p2",
      pin_number: 2,
    },
    // R2
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
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: "R2_p2",
      source_component_id: "R2",
      name: "p2",
      pin_number: 2,
    },
    // R3
    {
      type: "source_component",
      source_component_id: "R3",
      name: "R3",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_port",
      source_port_id: "R3_p1",
      source_component_id: "R3",
      name: "p1",
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: "R3_p2",
      source_component_id: "R3",
      name: "p2",
      pin_number: 2,
    },
    // R4
    {
      type: "source_component",
      source_component_id: "R4",
      name: "R4",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_port",
      source_port_id: "R4_p1",
      source_component_id: "R4",
      name: "p1",
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: "R4_p2",
      source_component_id: "R4",
      name: "p2",
      pin_number: 2,
    },
    // R5
    {
      type: "source_component",
      source_component_id: "R5",
      name: "R5",
      ftype: "simple_resistor",
      resistance: 1000,
    },
    {
      type: "source_port",
      source_port_id: "R5_p1",
      source_component_id: "R5",
      name: "p1",
      pin_number: 1,
    },
    {
      type: "source_port",
      source_port_id: "R5_p2",
      source_component_id: "R5",
      name: "p2",
      pin_number: 2,
    },

    // Traces
    {
      type: "source_trace",
      source_trace_id: "t1",
      connected_source_port_ids: ["R1_p2", "R2_p1"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "t2",
      connected_source_port_ids: ["R2_p2", "R3_p1"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "t3",
      connected_source_port_ids: ["R3_p2", "R4_p1"],
      connected_source_net_ids: [],
    },
    {
      type: "source_trace",
      source_trace_id: "t4",
      connected_source_port_ids: ["R4_p2", "R5_p1"],
      connected_source_net_ids: [],
    },

    // Sim experiment
    {
      type: "simulation_experiment",
      simulation_experiment_id: "se1",
      name: "Test Transient Analysis",
      experiment_type: "spice_transient_analysis" as const,
      time_per_step: 1, // ms
      end_time_ms: 100, // ms
    },

    // Probes
    {
      type: "simulation_voltage_probe",
      source_port_id: "R1_p1",
      name: "N1",
    } as SimulationVoltageProbe,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R2_p1",
      name: "N2",
    } as SimulationVoltageProbe,
    {
      type: "simulation_voltage_probe",
      source_port_id: "R4_p1",
      name: "N4",
    } as SimulationVoltageProbe,
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  // Due to probe naming, node counting for automatic names should start after
  // the max N-value from probes. Probes: N1, N2, N4. Counter should start at 5.
  expect(spiceString).toContain("RR1 N1 N2 1K")
  expect(spiceString).toContain("RR2 N2 N5 1K")
  expect(spiceString).toContain("RR3 N5 N4 1K")
  expect(spiceString).toContain("RR4 N4 N6 1K")
  expect(spiceString).toContain("RR5 N6 N7 1K")

  // The order of probes in the .PRINT statement is not guaranteed
  expect(spiceString).toContain(".PRINT TRAN")
  expect(spiceString).toContain("V(N1)")
  expect(spiceString).toContain("V(N2)")
  expect(spiceString).toContain("V(N4)")
  expect(spiceString).not.toContain("V(n3)")
  expect(spiceString).not.toContain("V(n5)")
})
