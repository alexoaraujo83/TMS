const startedAt = new Date().toISOString();

console.log(
  JSON.stringify({
    service: "tms-worker",
    status: "started",
    startedAt,
  }),
);

setInterval(() => {
  // Worker loop placeholder. Domain jobs will be introduced after the foundation.
}, 30_000);
