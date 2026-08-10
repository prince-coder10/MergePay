// Empty stub module.
// Aliased via next.config.ts turbopack.resolveAlias to replace
// @x402/* packages that @coinbase/cdp-sdk imports transitively.
// Uses a Proxy so any named import resolves to undefined
// instead of throwing "export X doesn't exist in target module".
const stub = new Proxy(
  {},
  {
    get(_target, _key) {
      return undefined;
    },
  }
);

module.exports = stub;
