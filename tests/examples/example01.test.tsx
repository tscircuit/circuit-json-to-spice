import { test, expect } from "bun:test"
import { sel } from "tscircuit"
import { getTestFixture } from "tests/fixtures/getTestFixture"
import { convertSpiceNetlistToString } from "lib/spice-utils/convertSpiceNetlistToString"

test("example01", async () => {
  const { circuit } = await getTestFixture()

  circuit.add(
    <board>
      <resistor name="R1" resistance="1k" />
      <capacitor
        name="C1"
        capacitance="1uF"
        connections={{
          pin1: sel.R1.pin1,
        }}
      />
      {/* Not supported in tscircuit yet */}
      {/* <powersource name="V1" voltage="1V" /> */}
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  expect(circuitJson).toMatchInlineSnapshot(`
    [
      {
        "software_used_string": "@tscircuit/core@0.0.418",
        "source_project_metadata_id": "source_project_metadata_0",
        "type": "source_project_metadata",
      },
      {
        "name": "pin1",
        "pin_number": 1,
        "port_hints": [
          "anode",
          "pos",
          "left",
          "pin1",
          "1",
        ],
        "source_component_id": "source_component_0",
        "source_port_id": "source_port_0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_port",
      },
      {
        "name": "pin2",
        "pin_number": 2,
        "port_hints": [
          "cathode",
          "neg",
          "right",
          "pin2",
          "2",
        ],
        "source_component_id": "source_component_0",
        "source_port_id": "source_port_1",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_port",
      },
      {
        "are_pins_interchangeable": true,
        "display_resistance": "1kΩ",
        "ftype": "simple_resistor",
        "manufacturer_part_number": undefined,
        "name": "R1",
        "resistance": 1000,
        "source_component_id": "source_component_0",
        "supplier_part_numbers": undefined,
        "type": "source_component",
      },
      {
        "name": "pin1",
        "pin_number": 1,
        "port_hints": [
          "anode",
          "pos",
          "left",
          "pin1",
          "1",
        ],
        "source_component_id": "source_component_1",
        "source_port_id": "source_port_2",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_port",
      },
      {
        "name": "pin2",
        "pin_number": 2,
        "port_hints": [
          "cathode",
          "neg",
          "right",
          "pin2",
          "2",
        ],
        "source_component_id": "source_component_1",
        "source_port_id": "source_port_3",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_port",
      },
      {
        "are_pins_interchangeable": true,
        "capacitance": 0.000001,
        "display_capacitance": "1µF",
        "ftype": "simple_capacitor",
        "manufacturer_part_number": undefined,
        "max_decoupling_trace_length": undefined,
        "max_voltage_rating": undefined,
        "name": "C1",
        "source_component_id": "source_component_1",
        "supplier_part_numbers": undefined,
        "type": "source_component",
      },
      {
        "is_subcircuit": true,
        "name": undefined,
        "source_group_id": "source_group_0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_group",
      },
      {
        "connected_source_net_ids": [],
        "connected_source_port_ids": [
          "source_port_2",
          "source_port_0",
        ],
        "display_name": "capacitor.C1 > port.pin1 to .R1 > .pin1",
        "max_length": NaN,
        "min_trace_thickness": undefined,
        "source_trace_id": "source_trace_0",
        "subcircuit_connectivity_map_key": "unnamedsubcircuit42_connectivity_net0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "source_trace",
      },
      {
        "center": {
          "x": 0,
          "y": 0,
        },
        "schematic_component_id": "schematic_component_0",
        "size": {
          "height": 0.388910699999999,
          "width": 1.0583332999999997,
        },
        "source_component_id": "source_component_0",
        "symbol_display_value": "1kΩ",
        "symbol_name": "boxresistor_right",
        "type": "schematic_component",
      },
      {
        "center": {
          "x": 0,
          "y": 0,
        },
        "schematic_component_id": "schematic_component_1",
        "size": {
          "height": 0.8400173000000031,
          "width": 1.0583333000000001,
        },
        "source_component_id": "source_component_1",
        "symbol_display_value": "1µF",
        "symbol_name": "capacitor_right",
        "type": "schematic_component",
      },
      {
        "center": {
          "x": -0.5337907000000003,
          "y": 0.045805199999999324,
        },
        "display_pin_label": "pos",
        "distance_from_component_edge": 0.4,
        "facing_direction": "left",
        "pin_number": 1,
        "schematic_component_id": "schematic_component_0",
        "schematic_port_id": "schematic_port_0",
        "side_of_component": undefined,
        "source_port_id": "source_port_0",
        "true_ccw_index": undefined,
        "type": "schematic_port",
      },
      {
        "center": {
          "x": 0.5687907000000003,
          "y": 0.04525870000000065,
        },
        "display_pin_label": "neg",
        "distance_from_component_edge": 0.4,
        "facing_direction": "right",
        "pin_number": 2,
        "schematic_component_id": "schematic_component_0",
        "schematic_port_id": "schematic_port_1",
        "side_of_component": undefined,
        "source_port_id": "source_port_1",
        "true_ccw_index": undefined,
        "type": "schematic_port",
      },
      {
        "center": {
          "x": -0.5512093000000002,
          "y": 0.016380250000000984,
        },
        "display_pin_label": "pos",
        "distance_from_component_edge": 0.4,
        "facing_direction": "left",
        "pin_number": 1,
        "schematic_component_id": "schematic_component_1",
        "schematic_port_id": "schematic_port_2",
        "side_of_component": undefined,
        "source_port_id": "source_port_2",
        "true_ccw_index": undefined,
        "type": "schematic_port",
      },
      {
        "center": {
          "x": 0.5512093000000002,
          "y": 0.016926950000000218,
        },
        "display_pin_label": "neg",
        "distance_from_component_edge": 0.4,
        "facing_direction": "right",
        "pin_number": 2,
        "schematic_component_id": "schematic_component_1",
        "schematic_port_id": "schematic_port_3",
        "side_of_component": undefined,
        "source_port_id": "source_port_3",
        "true_ccw_index": undefined,
        "type": "schematic_port",
      },
      {
        "edges": [
          {
            "from": {
              "layer": "top",
              "route_type": "wire",
              "width": 0.1,
              "x": -0.5512093000000002,
              "y": 0.016380250000000984,
            },
            "to": {
              "layer": "top",
              "route_type": "wire",
              "width": 0.1,
              "x": -0.5512093000000002,
              "y": 0.016380250000000984,
            },
          },
          {
            "from": {
              "layer": "top",
              "route_type": "wire",
              "width": 0.1,
              "x": -0.5512093000000002,
              "y": 0.016380250000000984,
            },
            "to": {
              "x": -0.5512093000000002,
              "y": 0.045805199999999324,
            },
          },
          {
            "from": {
              "x": -0.5512093000000002,
              "y": 0.045805199999999324,
            },
            "to": {
              "x": -0.5337907000000003,
              "y": 0.045805199999999324,
            },
          },
        ],
        "junctions": [],
        "schematic_trace_id": "schematic_trace_0",
        "source_trace_id": "source_trace_0",
        "type": "schematic_trace",
      },
      {
        "center": {
          "x": 0,
          "y": 0,
        },
        "height": 0,
        "layer": "top",
        "pcb_component_id": "pcb_component_0",
        "rotation": 0,
        "source_component_id": "source_component_0",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "pcb_component",
        "width": 0,
      },
      {
        "error_type": "pcb_missing_footprint_error",
        "message": "No footprint found for component: <resistor#36 name=".R1" />",
        "pcb_missing_footprint_error_id": "pcb_missing_footprint_error_0",
        "source_component_id": "source_component_0",
        "type": "pcb_missing_footprint_error",
      },
      {
        "center": {
          "x": 0,
          "y": 0,
        },
        "height": 0,
        "layer": "top",
        "pcb_component_id": "pcb_component_1",
        "rotation": 0,
        "source_component_id": "source_component_1",
        "subcircuit_id": "subcircuit_source_group_0",
        "type": "pcb_component",
        "width": 0,
      },
      {
        "error_type": "pcb_missing_footprint_error",
        "message": "No footprint found for component: <capacitor#39 name=".C1" />",
        "pcb_missing_footprint_error_id": "pcb_missing_footprint_error_1",
        "source_component_id": "source_component_1",
        "type": "pcb_missing_footprint_error",
      },
      {
        "center": {
          "x": 0,
          "y": 0,
        },
        "height": 0,
        "material": "fr4",
        "num_layers": 4,
        "outline": undefined,
        "pcb_board_id": "pcb_board_0",
        "thickness": 1.4,
        "type": "pcb_board",
        "width": 0,
      },
      {
        "message": "Unexpected numItems value: 0.",
        "pcb_autorouting_error_id": "pcb_autorouting_error_0",
        "pcb_error_id": "pcb_autorouter_error_subcircuit_subcircuit_source_group_0",
        "type": "pcb_autorouting_error",
      },
    ]
  `)

  // Convert circuit JSON to SPICE
  const { circuitJsonToSpice } = await import("lib/circuitJsonToSpice")
  const spiceNetlist = circuitJsonToSpice(circuitJson)
  const spiceString = spiceNetlist.toSpiceString()

  expect(spiceString).toMatchInlineSnapshot(`
    "Circuit JSON to SPICE Netlist
    RR1 N1 N2 1K
    CC1 N1 N3 1U
    .END"
  `)
})
