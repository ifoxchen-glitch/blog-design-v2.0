const cors = require("cors");

function devCors() {
  if (process.env.NODE_ENV === "production") {
    return (req, res, next) => next();
  }
  return cors({
    origin: ["http://localhost:8787", "http://localhost:5173"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });
}

module.exports = devCors;
