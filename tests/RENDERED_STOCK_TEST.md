# Local rendered stock test

Run `node tests/rendered-stock-server.mjs --check` to compile the fixture.
Run `node tests/rendered-stock-server.mjs 43134` and open
`http://127.0.0.1:43134/` to inspect it. Select **Run five-failure and recovery
proof**. The status must show PASS.

The fixture compiles the actual food page, menu slice, card component, and
stock reader. It supplies synthetic menu data, manual poll timers, and local
fetch replies. It does not load environment files or server routes. The server
binds only to localhost and its content policy blocks network connections.

Expected result: four failed polls retain the stock and NEW labels; the fifth clears
both. A valid response restores both and resets the failure count. The unrelated
card and the editorially removed card must keep their own label states.

Main verified this sequence in the browser on 2026-09-06. All eight existing
stock tests also passed. This proves local rendering, not production feed
availability or notification delivery. Stop the server with Ctrl+C.
