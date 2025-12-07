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
      .MODEL ENH_SW SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)
      .MODEL D D
      SM1 N2 VP_IN VP_IN N1 ENH_SW
      DD1 0 N2 D
      LL1 N2 VP_OUT 10
      CC1 VP_OUT 0 10U
      RR1 VP_OUT 0 1K
      Vsimulation_voltage_source_0 VP_IN 0 DC 5
      Vsimulation_voltage_source_1 N1 0 PULSE(0 10 0 1n 1n 0.0005 0.001)
      .PRINT TRAN V(VP_IN) V(VP_OUT)
      .tran 0.00001 0.05 UIC
      .END"
    `)
  },
  { timeout: 10000 },
)
