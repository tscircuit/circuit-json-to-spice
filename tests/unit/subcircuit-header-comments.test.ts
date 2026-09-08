import { expect, test } from "bun:test"
import { SpiceNetlist } from "lib/spice-classes/SpiceNetlist"
import { processSimulationSpiceSubcircuits } from "lib/processors/process-simulation-spice-subcircuits"

test("subcircuit header comments do not add grounded call terminals", () => {
  for (const header of [
    ".SUBCKT filter in out $ signal pins",
    ".SUBCKT filter in out; signal pins",
    ".SUBCKT filter in out // signal pins",
    ".SUBCKT filter in $ first pin\n+ out ; second pin",
    ".SUBCKT filter in\n* pin documentation\n\n+ out // second pin",
    ".SUBCKT filter in out",
  ]) {
    const source = `${header}\nR1 in out 1k\n.ENDS filter`
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
    expect(netlist.models.get("filter")).toBe(source)
  }
})
