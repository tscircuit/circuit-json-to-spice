import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

const createDiodeWithSpiceSubcircuit = (): AnyCircuitElement[] => [
  {
    type: "source_component",
    source_component_id: "sc_d1",
    name: "D1",
    ftype: "simple_diode",
  },
  {
    type: "source_port",
    source_port_id: "sp_d1_anode",
    source_component_id: "sc_d1",
    name: "anode",
    pin_number: 1,
    port_hints: ["anode"],
  },
  {
    type: "source_port",
    source_port_id: "sp_d1_cathode",
    source_component_id: "sc_d1",
    name: "cathode",
    pin_number: 2,
    port_hints: ["cathode"],
  },
  {
    type: "source_component",
    source_component_id: "sc_r1",
    name: "R1",
    ftype: "simple_resistor",
    resistance: 1000,
  },
  {
    type: "source_port",
    source_port_id: "sp_r1_1",
    source_component_id: "sc_r1",
    name: "pin1",
    pin_number: 1,
  },
  {
    type: "source_port",
    source_port_id: "sp_r1_2",
    source_component_id: "sc_r1",
    name: "pin2",
    pin_number: 2,
  },
  {
    type: "source_net",
    source_net_id: "net_gnd",
    name: "GND",
    member_source_group_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "st_b",
    connected_source_port_ids: ["sp_d1_cathode", "sp_r1_1"],
    connected_source_net_ids: [],
  },
  {
    type: "source_trace",
    source_trace_id: "st_gnd",
    connected_source_port_ids: ["sp_r1_2"],
    connected_source_net_ids: ["net_gnd"],
  },
  {
    type: "simulation_spice_subcircuit",
    simulation_spice_subcircuit_id: "simulation_spice_subcircuit_0",
    source_component_id: "sc_d1",
    subcircuit_source: `.subckt GE_DIODE anode cathode
D1 anode cathode GEMODEL
.model GEMODEL D(Is=6e-7 N=1.3)
.ends GE_DIODE`,
    spice_pin_to_source_port_map: {
      anode: "sp_d1_anode",
      cathode: "sp_d1_cathode",
    },
  },
]

test("emits custom spice subcircuit definition for diode with spicemodel", () => {
  const spiceString = circuitJsonToSpice(
    createDiodeWithSpiceSubcircuit(),
  ).toSpiceString()

  expect(spiceString).toContain(".subckt GE_DIODE anode cathode")
  expect(spiceString).toContain(
    "Xsimulation_spice_subcircuit_0 N2 N1 GE_DIODE",
  )
})

test.failing(
  "skips built-in diode element when a simulation_spice_subcircuit is attached (#73)",
  () => {
    const spiceString = circuitJsonToSpice(
      createDiodeWithSpiceSubcircuit(),
    ).toSpiceString()

    expect(spiceString).not.toContain("DD1 ")
    expect(spiceString).not.toContain(".MODEL D D")
  },
)
