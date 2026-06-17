import { expect, test } from "bun:test"
import type { AnyCircuitElement, SimulationCurrentProbe } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const currentProbe = (probe: SimulationCurrentProbe): AnyCircuitElement => probe

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
    source_component_id: "AM1",
    name: "AM1",
  } as unknown as AnyCircuitElement,
  // Test-only inline ammeter placeholder; the simulation_current_probe record
  // below supplies the generated 0V SPICE sense source for this branch.
  {
    type: "source_port",
    source_port_id: "AM1_p1",
    source_component_id: "AM1",
    name: "p1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "AM1_p2",
    source_component_id: "AM1",
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
    source_trace_id: "t_probe_pos",
    connected_source_port_ids: ["R1_p2", "AM1_p1"],
    connected_source_net_ids: ["net_probe_pos"],
  },
  {
    type: "source_net",
    source_net_id: "net_probe_pos",
    name: "PROBE_POS",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "t_probe_neg",
    connected_source_port_ids: ["AM1_p2", "R2_p1"],
    connected_source_net_ids: ["net_probe_neg"],
  },
  {
    type: "source_net",
    source_net_id: "net_probe_neg",
    name: "PROBE_NEG",
    member_source_group_ids: [],
  },
  {
    type: "simulation_experiment",
    simulation_experiment_id: "se1",
    name: "Test Transient Analysis",
    experiment_type: "spice_transient_analysis" as const,
    time_per_step: 1,
    end_time_ms: 100,
  },
]

test("port-based inline current probe creates a series 0V sense source and current output", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp1",
      name: "IAM1",
      positive_source_port_id: "AM1_p1",
      negative_source_port_id: "AM1_p2",
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain("RR1 N3 N1 1K")
  expect(spiceString).toContain("Vsense_cp1 N1 N2 DC 0")
  expect(spiceString).toContain("RR2 N2 N4 1K")
  expect(spiceString).toContain(".PRINT TRAN I(Vsense_cp1)")
  expect(spiceString).toContain(".SAVE I(Vsense_cp1)")
  expect(spiceString).toContain(
    `* tscircuit_current_probe {"simulation_current_probe_id":"cp1","name":"IAM1","spice_vector":"I(Vsense_cp1)","sense_voltage_source_name":"Vsense_cp1","positive_node_name":"N1","negative_node_name":"N2"}`,
  )
})

test("net-based current probe resolves source net ids to node names", () => {
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
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp_net",
      name: "I_NET",
      positive_source_net_id: "net_probe_pos",
      negative_source_net_id: "net_probe_neg",
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain("RR2 N2 0 1K")
  expect(spiceString).toContain("Vsense_cp_net N1 N2 DC 0")
  expect(spiceString).toContain(".PRINT TRAN I(Vsense_cp_net)")
  expect(spiceString).toContain(".SAVE I(Vsense_cp_net)")
  expect(spiceString).toContain(
    `* tscircuit_current_probe {"simulation_current_probe_id":"cp_net","name":"I_NET","spice_vector":"I(Vsense_cp_net)","sense_voltage_source_name":"Vsense_cp_net","positive_node_name":"N1","negative_node_name":"N2"}`,
  )
})

test("inline current probe sense source remains in non-transient netlists without transient output", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit.filter(
      (element) => element.type !== "simulation_experiment",
    ),
    {
      type: "simulation_experiment",
      simulation_experiment_id: "se_dc",
      name: "Test DC Operating Point",
      experiment_type: "spice_dc_operating_point" as const,
    },
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp_dc",
      positive_source_port_id: "AM1_p1",
      negative_source_port_id: "AM1_p2",
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain("Vsense_cp_dc N1 N2 DC 0")
  expect(spiceString).not.toContain(".PRINT TRAN")
  expect(spiceString).not.toContain(".SAVE")
})

test("multiple current probes share one .PRINT and one .SAVE current output", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp_r1",
      positive_source_port_id: "AM1_p1",
      negative_source_port_id: "AM1_p2",
    }),
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp_r2",
      positive_source_port_id: "R1_p1",
      negative_source_port_id: "R2_p2",
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain("Vsense_cp_r1 N1 N2 DC 0")
  expect(spiceString).toContain("Vsense_cp_r2 N3 N4 DC 0")
  expect(spiceString).toContain(".PRINT TRAN I(Vsense_cp_r1) I(Vsense_cp_r2)")
  expect(spiceString).toContain(".SAVE I(Vsense_cp_r1) I(Vsense_cp_r2)")
})

test("current and voltage probes emit one merged .PRINT and .SAVE", () => {
  const circuitJson: AnyCircuitElement[] = [
    ...baseCircuit,
    {
      type: "simulation_voltage_probe",
      simulation_voltage_probe_id: "vp1",
      name: "VPROBE_POS",
      signal_input_source_port_id: "AM1_p1",
    },
    currentProbe({
      type: "simulation_current_probe",
      simulation_current_probe_id: "cp1",
      name: "IAM1",
      positive_source_port_id: "AM1_p1",
      negative_source_port_id: "AM1_p2",
    }),
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()
  const printStatements = spiceString
    .split("\n")
    .filter((line) => line.startsWith(".PRINT TRAN"))
  const saveStatements = spiceString
    .split("\n")
    .filter((line) => line.startsWith(".SAVE"))

  expect(printStatements).toEqual([".PRINT TRAN V(VPROBE_POS) I(Vsense_cp1)"])
  expect(saveStatements).toEqual([".SAVE V(VPROBE_POS) I(Vsense_cp1)"])
})
