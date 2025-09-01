import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import {
  convertCircuitJsonToSchematicSvg,
  convertCircuitJsonToPcbSvg,
} from "circuit-to-svg"

test(
  "Boost converter circuit",
  async () => {
    const { circuit } = await getTestFixture()

    circuit.add(
      <board width={30} height={30}>
        <voltagesource
          name="V1"
          voltage={"5V"}
          schY={2}
          schX={-5}
          schRotation={270}
        />
        <trace from={".V1 > .pin1"} to={".L1 > .pin1"} />
        <trace from={".L1 > .pin2"} to={".D1 > .anode"} />
        <trace from={".D1 > .cathode"} to={".C1 > .pin1"} />
        <trace from={".D1 > .cathode"} to={".R1 > .pin1"} />
        <trace from={".C1 > .pin2"} to={".R1 > .pin2"} />
        <trace from={".R1 > .pin2"} to={".V1 > .pin2"} />
        <trace from={".L1 > .pin2"} to={".M1 > .drain"} />
        <trace from={".M1 > .source"} to={".V1 > .pin2"} />
        <trace from={".M1 > .source"} to={"net.GND"} />
        <trace from={".M1 > .gate"} to={".V2 > .pin1"} />
        <trace from={".V2 > .pin2"} to={".V1 > .pin2"} />
        <inductor name="L1" inductance={"1H"} schY={3} pcbY={3} />
        <diode
          name="D1"
          footprint={"0603"}
          schY={3}
          schX={3}
          pcbY={6}
          pcbX={3}
        />
        <capacitor
          polarized
          schRotation={270}
          name="C1"
          capacitance={"10uF"}
          footprint={"0603"}
          schX={3}
          pcbX={3}
        />
        <resistor
          schRotation={270}
          name="R1"
          resistance={"1k"}
          footprint={"0603"}
          schX={6}
          pcbX={9}
        />
        <voltagesource
          name="V2"
          schRotation={270}
          voltage={"10V"}
          waveShape="square"
          dutyCycle={0.68}
          frequency={"1kHz"}
          schX={-3}
        />
        <mosfet
          channelType="n"
          footprint={"sot23"}
          name="M1"
          mosfetMode="enhancement"
          pcbX={-4}
        />
      </board>,
    )

    await circuit.renderUntilSettled()
    const circuitJson = circuit.getCircuitJson()

    const spiceNetlist = circuitJsonToSpice(circuitJson)
    const spiceString = spiceNetlist.toSpiceString()

    expect(spiceString).toMatchInlineSnapshot(`
      "* Circuit JSON to SPICE Netlist
      .MODEL D D
      .MODEL SWMOD SW
      LL1 N1 N2 1
      DD1 N2 N3 D
      CC1 N3 0 10U
      RR1 N3 0 1K
      SM1 N2 0 N4 0 SWMOD
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
