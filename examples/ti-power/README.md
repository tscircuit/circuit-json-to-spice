# TI power simulation reproductions

Run from the repository root with Bun, `unzip`, and internet access:

```sh
bun examples/ti-power/run.ts all
# Or select linear, buck, or power-tree.
```

The latest Desktop-generated test benches are also available:

```sh
bun examples/ti-power/run.ts desktop-linear
bun examples/ti-power/run.ts desktop-linear-startup
bun examples/ti-power/run.ts desktop-buck
bun examples/ti-power/run.ts desktop-buck-loadstep
bun examples/ti-power/run.ts desktop-buck-ripple
bun examples/ti-power/run.ts desktop-power-tree
bun examples/ti-power/run.ts lmzm-startup
```

These preserve the generated external circuit and source conditions. Native
`.control` blocks are expressed as batch analysis directives, and model libraries
use the existing hash-verified download and exporter isolation. `.SAVE` restricts
stored vectors to the requested outputs; `interp` limits storage to the output
grid for the larger switching cases. Neither changes the internal solver step
(see the [ngspice manual](https://ngspice.sourceforge.io/docs/ngspice-manual.pdf)).

The Desktop power-tree case intentionally retains the generated `SS=1` settings,
separate analog-ground net, and current loads at startup. It reproduces an
unvalidated test bench; it is not a recommended reference design. Compare it with
the original `power-tree` case before attributing a failure to the exporter.

`lmzm-startup` isolates the upstream module with a 24 V ramp and a 24 Ω load.
It uses trapezoidal integration to expose the startup convergence failure; the
Gear version of the same bench advances extremely slowly instead. Native
ngspice 47 also reproduces this behavior with the adapter's compatibility
rewrites applied. This is an unresolved model/solver interaction, not an
established exporter defect.

The `AGND` connection in the original `power-tree` and `lmzm-startup` benches is
a simulation return for this macro-model. The [TI model](https://www.ti.com/lit/zip/snvmbf8)
does not implement the hardware's internal AGND-to-PGND connection. The
[hardware datasheet](https://www.ti.com/lit/ds/symlink/lmzm33602.pdf) says to keep
those pins separate externally; do not copy the simulation return into a PCB.

The small CI-passing visual reproduction of TI's ignored `.IC V(SS_TR )=0`
syntax is in [ngspice adapter PR #42](https://github.com/tscircuit/ngspice-spice-engine/pull/42).
Its [stacked fix](https://github.com/tscircuit/ngspice-spice-engine/pull/43)
normalizes voltage-node whitespace without changing the vendor model files.

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

Recorded on 2026-11-18 using the local adapter and exporter PR builds: the
linear case reached 2.79995 V and the buck reached 3.33045 V at 5 ms. The complete
four-regulator tree did not finish within ten minutes. Native ngspice also
advanced extremely slowly around 0.766 ms; adding 2 mΩ to the external capacitors
did not resolve that behavior. The library-collision regressions pass, but the
full-tree transient remains unvalidated and needs further model-convergence work.
