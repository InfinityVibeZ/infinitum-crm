export class ApiError extends Error {
  public status: number;
  public data: any;

  constructor(
    message: string,
    status: number,
    data: any
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

interface ApiClientOptions
  extends RequestInit {
  /**
   * If true, mutations must return:
   * { success: true }
   */
  requireSuccessField?: boolean;
}

/**
 * Core fetch wrapper.
 *
 * IMPORTANT:
 *
 * Authentication is handled exclusively through
 * HttpOnly cookies.
 *
 * We intentionally DO NOT read:
 *
 * localStorage.getItem("nexus-token")
 *
 * and we DO NOT manually create:
 *
 * Authorization: Bearer ...
 *
 * The browser sends the HttpOnly authentication cookie
 * automatically for same-origin requests.
 */
async function fetchWithValidation(
  url: string,
  options: ApiClientOptions = {}
) {
  const {
    requireSuccessField = false,
    ...fetchOptions
  } = options;

  const requestStartedAt =
    Date.now();

  console.log(
    "[API-CLIENT] REQUEST START",
    {
      method:
        fetchOptions.method || "GET",

      url,

      origin:
        typeof window !== "undefined"
          ? window.location.origin
          : "server",

      credentials:
        fetchOptions.credentials ||
        "same-origin",
    }
  );

  // ============================================================
  // HEADERS
  // ============================================================

  const headers = new Headers(
    fetchOptions.headers
  );

  /*
   * Add JSON content type automatically unless
   * the body is FormData.
   */
  if (
    !headers.has("Content-Type") &&
    !(fetchOptions.body instanceof FormData)
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  /*
   * IMPORTANT:
   *
   * Do NOT inject Authorization from localStorage.
   *
   * Authentication is via HttpOnly cookie.
   */

  // ============================================================
  // REQUEST
  // ============================================================

  let response: Response;

  try {
    response = await fetch(
      url,
      {
        ...fetchOptions,

        /*
         * Explicitly send same-origin cookies.
         *
         * This is important when accessing the application
         * through the Cloudflare hostname.
         */
        credentials:
          fetchOptions.credentials ||
          "same-origin",

        headers,

        /*
         * Prevent browser caching authenticated API responses.
         */
        cache:
          fetchOptions.cache ||
          "no-store",
      }
    );
  } catch (error) {
    console.error(
      "[API-CLIENT] NETWORK ERROR",
      {
        method:
          fetchOptions.method ||
          "GET",

        url,

        origin:
          typeof window !== "undefined"
            ? window.location.origin
            : "server",

        durationMs:
          Date.now() -
          requestStartedAt,

        error,
      }
    );

    throw error;
  }

  // ============================================================
  // RESPONSE
  // ============================================================

  console.log(
    "[API-CLIENT] RESPONSE",
    {
      method:
        fetchOptions.method ||
        "GET",

      url,

      status:
        response.status,

      ok:
        response.ok,

      durationMs:
        Date.now() -
        requestStartedAt,

      redirected:
        response.redirected,

      responseUrl:
        response.url,
    }
  );

  // ============================================================
  // PARSE RESPONSE
  // ============================================================

  let data: any = null;

  const contentType =
    response.headers.get(
      "content-type"
    );

  if (
    contentType &&
    contentType.includes(
      "application/json"
    )
  ) {
    try {
      data =
        await response.json();
    } catch (error) {
      console.error(
        "[API-CLIENT] JSON PARSE ERROR",
        {
          url,
          status:
            response.status,
          error,
        }
      );
    }
  } else {
    try {
      data =
        await response.text();
    } catch (error) {
      console.error(
        "[API-CLIENT] TEXT PARSE ERROR",
        {
          url,
          status:
            response.status,
          error,
        }
      );
    }
  }

  // ============================================================
  // ERROR RESPONSE
  // ============================================================

  if (!response.ok) {
    const errorMsg =
      data?.error ||
      data?.message ||
      "An error occurred during the request.";

    console.error(
      "[API-CLIENT] REQUEST FAILED",
      {
        method:
          fetchOptions.method ||
          "GET",

        url,

        status:
          response.status,

        error:
          errorMsg,

        durationMs:
          Date.now() -
          requestStartedAt,
      }
    );

    throw new ApiError(
      errorMsg,
      response.status,
      data
    );
  }

  // ============================================================
  // STRICT SUCCESS FIELD
  // ============================================================

  if (
    requireSuccessField &&
    fetchOptions.method &&
    fetchOptions.method !== "GET"
  ) {
    if (
      data &&
      typeof data === "object" &&
      data.success !== true
    ) {
      console.error(
        "[API-CLIENT] SUCCESS FIELD VALIDATION FAILED",
        {
          method:
            fetchOptions.method,

          url,

          status:
            response.status,

          success:
            data?.success,
        }
      );

      throw new ApiError(
        data?.error ||
          "API did not return an explicit success confirmation.",
        response.status,
        data
      );
    }
  }

  console.log(
    "[API-CLIENT] REQUEST SUCCESS",
    {
      method:
        fetchOptions.method ||
        "GET",

      url,

      status:
        response.status,

      durationMs:
        Date.now() -
        requestStartedAt,
    }
  );

  return data;
}

/**
 * Standardized API client.
 *
 * Authentication:
 * HttpOnly cookies only.
 *
 * No localStorage token.
 * No manually injected Authorization header.
 */
export const apiClient = {
  get: (
    url: string,
    options?: Omit<
      ApiClientOptions,
      "method"
    >
  ) =>
    fetchWithValidation(
      url,
      {
        ...options,
        method: "GET",
        requireSuccessField: false,
      }
    ),

  post: (
    url: string,
    data?: any,
    options?: Omit<
      ApiClientOptions,
      "method" | "body"
    >
  ) =>
    fetchWithValidation(
      url,
      {
        ...options,
        method: "POST",
        body:
          data !== undefined
            ? JSON.stringify(data)
            : undefined,
      }
    ),

  put: (
    url: string,
    data?: any,
    options?: Omit<
      ApiClientOptions,
      "method" | "body"
    >
  ) =>
    fetchWithValidation(
      url,
      {
        ...options,
        method: "PUT",
        body:
          data !== undefined
            ? JSON.stringify(data)
            : undefined,
      }
    ),

  patch: (
    url: string,
    data?: any,
    options?: Omit<
      ApiClientOptions,
      "method" | "body"
    >
  ) =>
    fetchWithValidation(
      url,
      {
        ...options,
        method: "PATCH",
        body:
          data !== undefined
            ? JSON.stringify(data)
            : undefined,
      }
    ),

  delete: (
    url: string,
    options?: Omit<
      ApiClientOptions,
      "method"
    >
  ) =>
    fetchWithValidation(
      url,
      {
        ...options,
        method: "DELETE",
      }
    ),
};