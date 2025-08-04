import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("circuit with unrelated voltage_source components", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board width="20mm" height="20mm">
      <resistor name="R1_Test" resistance="10k" footprint="0402" />
      <chip name="U1_Test" footprint="soic8" />
      <trace from=".R1_Test > .pin1" to="net.SCL" />
      <trace from="net.VCC" to=".U1_Test > .pin1" />
      <chip
        name="U_REG"
        footprint="soic8"
        pinLabels={{
          pin2: "GND",
          pin3: "VOUT",
        }}
        pinAttributes={{
          VOUT: { providesPower: true, providesVoltage: 3.3 },
          GND: { providesGround: true },
        }}
      />
      <chip
        name="U_MCU"
        footprint="soic8"
        pinLabels={{
          pin8: "VCC",
          pin4: "GND",
        }}
      />
      <trace from=".U_REG > .VOUT" to="net.V_3V3" />
      <trace from=".U_REG > .GND" to="net.GND" />
      <trace from=".U_MCU > .VCC" to="net.V_3V3" />
      <trace from=".U_MCU > .GND" to="net.GND" />
      <resistor name="R2_Test" resistance="10k" footprint="0402" />
      <chip name="U2_Test" footprint="soic8" />
      <trace from=".R2_Test > .pin1" to=".U2_Test > .pin1" />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const spiceNetlist = circuitJsonToSpice(circuitJson)

  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1_Test N1 0 10K
    RR2_Test N4 0 10K
    Vsimulation_voltage_source_0 N3 0 DC 3.3
    .END"
  `)
})
