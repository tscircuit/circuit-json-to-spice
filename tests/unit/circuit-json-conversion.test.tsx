import { test, expect } from "bun:test"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import type { AnyCircuitElement } from "circuit-json"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { sel } from "tscircuit"

test("empty circuit JSON", () => {
  const circuitJson: AnyCircuitElement[] = []
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(0)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    .END"
  `)
})

test("single resistor circuit", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <trace from="net.GND" to={sel.R1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(1)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    .END"
  `)
})

test("RC circuit with trace", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <capacitor name="C1" capacitance="1uF" />
      <trace from={sel.R1.pin2} to={sel.C1.pin1} />
      <trace from="net.GND1" to={sel.R1.pin1} />
      <trace from="net.GND2" to={sel.C1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 0 N1 1K
    CC1 N1 0 1U
    .END"
  `)
})

test("circuit with simulation voltage source", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <chip
        name="U1"
        footprint="soic8"
        pinLabels={{
          pin2: "GND",
          pin3: "VOUT",
        }}
        pinAttributes={{
          VOUT: { providesPower: true, providesVoltage: 5 },
          GND: { providesGround: true },
        }}
      />
      <trace from={"net.VCC"} to={sel<"VOUT">("U1").VOUT} />
      <trace from={"net.GND"} to={sel<"GND">("U1").GND} />
      <trace from={"net.VCC"} to={sel.R1.pin1} />
      <trace from={"net.GND"} to={sel.R1.pin2} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()
  const netlist = circuitJsonToSpice(circuitJson)

  expect(netlist.components).toHaveLength(2)
  expect(netlist.toSpiceString()).toMatchInlineSnapshot(`
    "* Circuit JSON to SPICE Netlist
    RR1 N1 0 1K
    Vsimulation_voltage_source_0 N1 0 DC 5
    .END"
  `)
})
