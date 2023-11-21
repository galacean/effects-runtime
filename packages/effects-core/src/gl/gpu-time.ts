export function gpuTimer (gl: WebGL2RenderingContext) {
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2');

  if (ext) {
    let query = gl.createQuery();
    const getTime = async () => {
      return new Promise<number | null>((resolve, reject) => {
        if (query) {
          const available = gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE);
          const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);

          if (available && !disjoint) {
            // See how much time the rendering of the object took in nanoseconds.
            const timeElapsed = gl.getQueryParameter(query, gl.QUERY_RESULT); // Do something useful with the time.  Note that care should be

            // taken to use all significant bits of the result, not just the
            // least significant 32 bits.
            resolve(timeElapsed / 1000 / 1000);
          }
          if (available || disjoint) {
            // Clean up the query object.
            gl.deleteQuery(query); // Don't re-enter this polling loop.

            query = null;
          }
          available !== null && query && window.setTimeout(() => {
            getTime().then(resolve).catch;
          }, 1);
        }
      });
    };

    if (!query) {
      return;
    }

    return {
      begin: () => {
        query && gl.beginQuery(ext.TIME_ELAPSED_EXT, query);
      },
      end: () => {
        gl.endQuery(ext.TIME_ELAPSED_EXT);
      },
      getTime,
    };
  }
}

