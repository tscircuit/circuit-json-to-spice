# circuit-json-to-spice

Convert Circuit JSON into ngspice compatible SPICE netlists

## Installation

```bash
bun add circuit-json-to-spice
```

## Usage

```typescript
import { circuitJsonToSpice, convertSpiceNetlistToString } from "circuit-json-to-spice"

// Convert Circuit JSON to SPICE netlist
const spiceNetlist = circuitJsonToSpice(circuitJson)

// Convert to SPICE string format
const spiceString = spiceNetlist.toSpiceString()
```

## Example: Converting tscircuit code to SPICE

Here's a complete example showing how to create a circuit with tscircuit and convert it to SPICE:

```typescript
import { Circuit, sel } from "tscircuit"
import { circuitJsonToSpice } from "circuit-json-to-spice"

// Create a simple RC circuit
const circuit = new Circuit()

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
  </board>
)

// Render the circuit to get Circuit JSON
await circuit.renderUntilSettled()
const circuitJson = circuit.getCircuitJson()

// Convert to SPICE
const spiceNetlist = circuitJsonToSpice(circuitJson)
const spiceString = spiceNetlist.toSpiceString()

console.log(spiceString)
```

**Output:**
```spice
Circuit JSON to SPICE Netlist
RR1 N1 N2 1K
CC1 N1 N3 1U
.END
```

## Supported Components

Currently supports the following tscircuit components:

- **Resistors** (`simple_resistor`) - Converted to SPICE R components
- **Capacitors** (`simple_capacitor`) - Converted to SPICE C components

More components will be added in future releases.

## Value Formatting

The library automatically formats component values using standard SPICE notation:

- **Resistors**: `1000` → `1K`, `1000000` → `1MEG`
- **Capacitors**: `0.000001` → `1U`, `0.000000001` → `1N`, `0.000000000001` → `1P`

## References

- Inspired by [https://eecircuit.com/](https://eecircuit.com/)
