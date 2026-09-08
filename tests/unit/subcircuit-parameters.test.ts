import { expect, test } from "bun:test"
import { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import {
  parseSpiceSubckt,
  processSimulationSpiceSubcircuits,
} from "lib/processors/process-simulation-spice-subcircuits"

for (const header of [
  ".SUBCKT filter in out rval=100k cval=100n",
  ".SUBCKT filter in out PARAMS: rval=100k",
  ".subckt filter in out params:rval=100k",
  ".subckt filter in out rval = 100k",
  ".subckt filter in out rval =100k",
  ".subckt filter in\n+ out\n+ params: rval={ 2 * 50k }",
]) {
  test(`parameters are not pins: ${header}`, () => {
    expect(parseSpiceSubckt(header)).toEqual({
      modelName: "filter",
      pinNames: ["in", "out"],
    })
  })
}

test("an ordinary pin named params is preserved", () => {
  expect(parseSpiceSubckt(".subckt device params output")).toEqual({
    modelName: "device",
    pinNames: ["params", "output"],
  })
})

test("a parameterized model emits only its mapped pin nodes", () => {
  const source =
    ".SUBCKT filter in out PARAMS: rval=100k\nR1 in out {rval}\n.ENDS filter"
  const netlist = new SpiceNetlist()
  processSimulationSpiceSubcircuits(
    netlist,
    [
      {
        type: "simulation_spice_subcircuit",
        simulation_spice_subcircuit_id: "filter_1",
        source_component_id: "component_1",
        subcircuit_source: source,
        spice_pin_to_source_port_map: { in: "port_in", out: "port_out" },
      },
    ],
    new Map([
      ["port_in", "N_IN"],
      ["port_out", "N_OUT"],
    ]),
  )
  expect(netlist.components[0]!.toSpiceString()).toBe(
    "Xfilter_1 N_IN N_OUT filter",
  )
  expect(netlist.components[0]!.nodes).toEqual(["N_IN", "N_OUT"])
  expect(netlist.models.get("filter")).toBe(source)
})
