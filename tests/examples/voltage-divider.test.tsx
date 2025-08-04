import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"

test("circuit with multiple components", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="10k" />
      <resistor name="R2" resistance="5.6k" />
      <capacitor name="C1" capacitance="100nF" />
      <capacitor name="C2" capacitance="1uF" />
      {/* Connect components */}
      <trace from={sel.R1.pin1} to={sel.C1.pin1} />
      <trace from={sel.R1.pin2} to={sel.R2.pin1} />
      <trace from={sel.R2.pin2} to={sel.C2.pin1} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 10K
    RR2 N2 N3 5.6K
    CC1 N1 0 100N
    CC2 N3 0 1U
    .END"
  `)
})

test("simple resistor divider", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board width={16} height={16}>
      <chip
        name="V1"
        footprint="sot23"
        pinLabels={{
          pin1: "VOUT",
          pin2: "GND",
        }}
        pinAttributes={{
          VOUT: { providesPower: true, providesVoltage: 5 },
          GND: { providesGround: true },
        }}
      />

      <resistor name="R1" resistance="1k" footprint="0402" pcbX={4} pcbY={4} />
      <resistor
        name="R2"
        resistance="2k"
        footprint="0402"
        pcbX={-4}
        pcbY={-4}
      />
      <capacitor
        name="C1"
        capacitance="10uF"
        footprint="0402"
        pcbX={0}
        pcbY={-2}
      />

      <trace from={"net.VOUT"} to={sel.R1.pin1} />
      <trace from={".V1 > .VOUT"} to={"net.VOUT"} />
      <trace from={sel.R1.pin2} to={sel.R2.pin1} />
      <trace from={sel.R2.pin2} to={"net.GND"} />
      <trace from={"net.GND"} to={".V1 > .GND"} />

      <trace from={sel.C1.pin1} to={sel.R1.pin2} />
      <trace from={sel.C1.pin2} to={"net.GND"} />
    </board>,
  )

  await circuit.renderUntilSettled()
  const circuitJson = circuit.getCircuitJson()

  const spiceNetlist = circuitJsonToSpice(circuitJson)

  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    RR2 N2 0 2K
    CC1 N2 0 10U
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})
