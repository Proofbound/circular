const ALLOWED_ORIGINS = [
  "https://proofbound.com",
  "http://localhost:8888",
  "http://localhost:8080",
];

export default async (req, context) => {
  const origin = req.headers.get("origin");
  const cors = ALLOWED_ORIGINS.includes(origin) ? origin : "null";

  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Hello from Circular functions",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": cors,
      },
    }
  );
};
