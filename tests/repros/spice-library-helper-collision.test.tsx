import { expect, test } from "bun:test"
import { convertCircuitJsonToSchematicSvg } from "circuit-to-svg"
import { Simulation } from "eecircuit-engine"
import { circuitJsonToSpice } from "lib/circuitJsonToSpice"
import { Circuit } from "tscircuit"

test("cascaded model libraries retain their own helper subcircuits", async () => {
  const circuit = new Circuit()
  circuit.pcbDisabled = true
  circuit.add(
    <board routingDisabled>
      <voltagesource
        name="V1"
        voltage="12V"
        schX={-7}
        connections={{ pin1: "net.IN", pin2: "net.GND" }}
      />
      <chip
        name="U1"
        displayName="12 V to 6 V"
        schX={-2}
        pinLabels={{ pin1: "IN", pin2: "OUT", pin3: "GND" }}
        connections={{ IN: "net.IN", OUT: "net.MID", GND: "net.GND" }}
        spiceModel={
          <spicemodel
            source={`.subckt FIRST_STAGE IN OUT GND
X1 IN OUT GND BUFFER
.ends FIRST_STAGE
.subckt BUFFER IN OUT GND
E1 OUT GND IN GND 0.5
.ends BUFFER`}
          />
        }
      />
      <chip
        name="U2"
        displayName="6 V to 1.5 V"
        schX={4}
        pinLabels={{ pin1: "IN", pin2: "OUT", pin3: "GND" }}
        connections={{ IN: "net.MID", OUT: "net.OUT", GND: "net.GND" }}
        spiceModel={
          <spicemodel
            source={`.subckt SECOND_STAGE IN OUT GND
X1 IN OUT GND BUFFER
.ends SECOND_STAGE
.subckt BUFFER IN OUT GND
E1 OUT GND IN GND 0.25
.ends BUFFER`}
          />
        }
      />
      <voltageprobe name="MID" connectsTo="net.MID" />
      <voltageprobe name="OUT" connectsTo="net.OUT" />
    </board>,
  )
  await circuit.renderUntilSettled()
  expect(
    convertCircuitJsonToSchematicSvg(circuit.getCircuitJson()),
  ).toMatchSvgSnapshot(import.meta.path)

  const netlist = circuitJsonToSpice(circuit.getCircuitJson())
  netlist.tranCommand = ".tran 1u 2u"
  const simulation = new Simulation()
  await simulation.start()
  simulation.setNetList(netlist.toSpiceString())
  const result = await simulation.runSim()
  if (result.dataType !== "real") throw new Error("Expected real voltages")

  expect(result.data.find((field) => field.name === "v(mid)")?.values[0]).toBeCloseTo(
    6,
    6,
  )
  expect(result.data.find((field) => field.name === "v(out)")?.values[0]).toBeCloseTo(
    1.5,
    6,
  )
}, 15_000)
