/** Optional Playgrounds functions entry; game KV is provided by the host API. */
export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-alleyclaim",
      path: new URL(request.url).pathname,
    });
  },
};
