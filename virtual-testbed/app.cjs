// Startup file for cPanel "Setup Node.js App" (Phusion Passenger), which loads
// the entry with require(). The application itself is ESM, so load it dynamically.
import('./dist/server/src/index.js').catch((err) => {
  console.error(err);
  process.exit(1);
});
