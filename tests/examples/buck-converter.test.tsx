import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import buckConverterCircuit from "./assets/buck-converter.json"

test(
  "Buck converter circuit",
  async () => {
    const circuitJson = buckConverterCircuit as any

    const spiceNetlist = circuitJsonToSpice(circuitJson)
    const spiceString = spiceNetlist.toSpiceString()

    expect(spiceString).toMatchInlineSnapshot(`
      "* Circuit JSON to SPICE Netlist
      .MODEL PMOS_ENHANCEMENT PMOS (VTO=-1 KP=0.1)
      .MODEL D D
      MM1 N2 N1 VP_IN VP_IN PMOS_ENHANCEMENT
      DD1 0 N2 D
      LL1 N2 VP_OUT 10
      CC1 VP_OUT 0 10U
      RR1 VP_OUT 0 1K
      Vsimulation_voltage_source_0 VP_IN 0 DC 5
      Vsimulation_voltage_source_1 N1 0 PULSE(0 10 0 1n 1n 500u 1m)
      * tscircuit_probe {"simulation_voltage_probe_id":"simulation_voltage_probe_0","name":"VP_IN","spice_vector":"V(VP_IN)","source_node_name":"VP_IN"}
      * tscircuit_probe {"simulation_voltage_probe_id":"simulation_voltage_probe_1","name":"VP_OUT","spice_vector":"V(VP_OUT)","source_node_name":"VP_OUT"}
      .PRINT TRAN V(VP_IN) V(VP_OUT)
      .SAVE V(VP_IN) V(VP_OUT)
      .tran 0.00001 0.05 UIC
      .END"
    `)
  },
  { timeout: 10000 },
)
