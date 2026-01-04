import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"

test("simulation op amp", () => {
  const circuitJson: AnyCircuitElement[] = [
    {
      type: "source_port",
      source_port_id: "U1_non_inverting_input",
      name: "non_inverting_input",
    },
    {
      type: "source_port",
      source_port_id: "U1_inverting_input",
      name: "inverting_input",
    },
    {
      type: "source_port",
      source_port_id: "U1_positive_supply",
      name: "positive_supply",
    },
    {
      type: "source_port",
      source_port_id: "U1_negative_supply",
      name: "negative_supply",
    },
    {
      type: "source_port",
      source_port_id: "U1_output",
      name: "output",
    },
    {
      type: "simulation_op_amp",
      simulation_op_amp_id: "sim_op_amp_1",
      inverting_input_source_port_id: "U1_inverting_input",
      non_inverting_input_source_port_id: "U1_non_inverting_input",
      output_source_port_id: "U1_output",
      positive_supply_source_port_id: "U1_positive_supply",
      negative_supply_source_port_id: "U1_negative_supply",
    },
  ]

  const netlist = circuitJsonToSpice(circuitJson)
  const spiceString = netlist.toSpiceString()

  expect(spiceString).toContain(".SUBCKT GENERIC_OPAMP")
  expect(spiceString).toContain("Xsim_op_amp_1 N1 N2 N3 N4 N5 GENERIC_OPAMP")
  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .SUBCKT GENERIC_OPAMP non_inverting_input inverting_input positive_supply negative_supply output
    * Generic Op-Amp Model
    E1 internal_output 0 non_inverting_input inverting_input 100k
    Rin non_inverting_input inverting_input 10Meg
    Rout internal_output output 75
    D1 output positive_supply opamp_diode
    D2 negative_supply output opamp_diode
    .model opamp_diode D
    .ENDS GENERIC_OPAMP
    Xsim_op_amp_1 N1 N2 N3 N4 N5 GENERIC_OPAMP
    .END"
  `)
})
