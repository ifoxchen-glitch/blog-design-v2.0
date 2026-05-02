const frontApp = require("./apps/frontApp");

const PORT = parseInt(process.env.PORT, 10) || 8787;

frontApp.listen(PORT, () => {
  console.log(`Blog server running on http://localhost:${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin/login`);
});
