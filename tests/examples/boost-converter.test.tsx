import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import {
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPcbSvg,
} from "circuit-to-svg"
import boostConverterCircuit from "./assets/Boost-converter-circuit.json"

test(
  "Boost converter circuit",
  async () => {
    const circuitJson = boostConverterCircuit as any

    const spiceNetlist = circuitJsonToSpice(circuitJson)
    const spiceString = spiceNetlist.toSpiceString()

    expect(spiceString).toMatchInlineSnapshot(`
      "* Circuit JSON to SPICE Netlist
      .MODEL D D
      .MODEL NMOS_ENHANCEMENT NMOS
      LL1 N1 N2 1
      DD1 N2 N3 D
      CC1 N3 0 10U
      RR1 N3 0 1K
      MM1 N2 N4 0 0 NMOS_ENHANCEMENT
      Vsimulation_voltage_source_0 N1 0 DC 5
      Vsimulation_voltage_source_1 N4 0 PULSE(0 10 0 1n 1n 0.00068 0.001)
      .END"
    `)

    expect(convertCircuitJsonToSchematicSvg(circuitJson)).toMatchSvgSnapshot(
      import.meta.path + "-schematic",
    )
    expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
      import.meta.path + "-pcb",
    )
  },
  { timeout: 20000 },
)
