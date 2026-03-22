export default async (req, context) => {
  return new Response(
    JSON.stringify({
      status: "ok",
      message: "Hello from Circular functions",
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        "content-type": "application/json",
        "access-control-allow-origin": "*",
      },
    }
  );
};
