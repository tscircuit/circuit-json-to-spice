import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import switchCircuit from "./assets/switch.json"

test(
  "Switch circuit",
  async () => {
    const circuitJson = switchCircuit as any

    const spiceNetlist = circuitJsonToSpice(circuitJson)
    const spiceString = spiceNetlist.toSpiceString()

    expect(spiceString).toMatchInlineSnapshot(`
      "* Circuit JSON to SPICE Netlist
      .MODEL SW_SW1 SW(Ron=0.1 Roff=1e9 Vt=2.5 Vh=0.1)
      .MODEL NPN NPN
      RR_base N1 VP_BASE 10K
      VCTRL_SW1 NCTRL_SW1 0 PULSE(0 5 0 1n 1n 0.0005 0.001)
      SSW1 VP_BASE N2 NCTRL_SW1 0 SW_SW1
      QQ1 VP_COLLECTOR N2 0 NPN
      RR_collector N1 VP_COLLECTOR 300
      Vsimulation_voltage_source_0 N1 0 DC 5
      .PRINT TRAN V(VP_BASE) V(VP_COLLECTOR)
      .tran 0.00005 0.004 UIC
      .END"
    `)
  },
  { timeout: 10000 },
)
