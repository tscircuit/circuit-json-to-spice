# TI power simulation reproductions

Run from the repository root with Bun, `unzip`, and internet access:

```sh
bun examples/ti-power/run.ts all
# Or select linear, buck, or power-tree.
```

The runner downloads the original TI libraries, verifies their SHA-256 hashes,
bundles them through this exporter, and runs the ngspice WASM adapter. Vendor
libraries and generated netlists/results remain in `.cache/ti-power`.
Each simulation runs in a separate process with a ten-minute limit. The buck and
four-stage tree can take several minutes. Set `TI_POWER_TIMEOUT_MS` to change the
process limit. A timeout is recorded as an incomplete failure, never a pass.

| Case | Test bench | Basic acceptance |
| --- | --- | --- |
| Linear | TPS7A2028, 3.1 V input, 1 µF capacitors, 1–300 mA steps with 1 µs edges | Final output within 2% of 2.8 V |
| Buck | TPS54320, 12 V input, 1.1 Ω load, 6.8 µH / 47 µF EVM power stage | Final output within 2% of 3.3 V |
| Power tree | LMZM33602 → TPS82130 → TPS82084 / TPS82085, 24 V input, simultaneous 50–100% final-rail load steps | All four rails within 2% of 12 / 5 / 1.2 / 1.8 V |

These checks establish basic regulation. They do not establish agreement with
hardware ripple, transient peaks, efficiency, or thermal measurements. The tree
uses the detailed TIDA-010011 module branch, with its analog ground connected and
each model's declared startup defaults retained. `interp` limits stored samples
to the requested output interval without increasing the internal solver step.

Sources: [TPS7A20](https://www.ti.com/product/TPS7A20),
[TPS54320EVM-513](https://www.ti.com/lit/pdf/slvu380), and
[TIDA-010011](https://www.ti.com/lit/pdf/tiduel1).

The small automated regressions are in `tests/repros/spice-library-helper-collision.test.tsx`
and the ngspice adapter's PSpice fixtures. The full benches intentionally expose
the adapter's reversed-switch and `Adc` compatibility failures as well as shared
helper-library collisions; all corresponding fixes are required for validation.
