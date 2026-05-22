import { useIsUnauthorized } from "~/composables/is-unauthorized";

export const api = {
  provider: (
    url: string,
    queryParams?: Record<string, string> | undefined,
    body?:
      | Record<
          string,
          boolean | string | "" | string[] | undefined | null | object[]
        >
      | FormData
      | undefined,
    headers?: Record<string, string> | undefined,
    isByte?: boolean
  ): { newUrl: string; newHeaders: Record<string, string> } => {
    const { token } = useAuth();
    const baseUrl = useRuntimeConfig().public.baseAPI;

    if (token) {
      headers = {
        ...headers,
        Authorization: `${token.value}`,
      };
    }

    let newHeaders = { ...headers };

    if (!(body instanceof FormData)) {
      newHeaders = {
        "Content-Type": isByte
          ? "application/octret-stream"
          : "application/json",
        ...headers,
      };
    }

    newHeaders = {
      Accept: isByte ? "application/octret-stream" : "application/json",
      ...newHeaders,
    };

    const newUrl = queryParams
      ? `${baseUrl}${url}?${new URLSearchParams(queryParams)}`
      : `${baseUrl}${url}`;

    return { newUrl, newHeaders };
  },

  afterResponse: async <T>(response: Response, isByte: boolean) => {
    const data = isByte ? await response.blob() : await response.json();

    if (response.status >= 500) navigateTo("/server-error");

    if (response.status === 401 && !response.url.includes("syncfms")) {
      useIsUnauthorized().value = true;

      const { signOut } = useAuth();
      await signOut({ callbackUrl: "/login" });
    }

    if (response.status >= 400) throw data;

    return data;
  },

  get: async (
    url: string,
    option?: {
      queryParams?: Record<string, string>;
      headers?: Record<string, string>;
      isByte?: boolean;
    }
  ) => {
    const { newUrl, newHeaders } = api.provider(
      url,
      option?.queryParams,
      option?.headers
    );

    const isByte = option?.isByte || false;
    const response = await fetch(newUrl, {
      method: "GET",
      headers: newHeaders,
    });

    return await api.afterResponse(response, isByte);
  },

  post: async (
    url: string,
    option?: {
      queryParams?: Record<string, string>;
      body?:
        | Record<
            string,
            boolean | string | "" | string[] | undefined | null | object[]
          >
        | FormData;
      headers?: Record<string, string>;
      isByte?: boolean;
    }
  ) => {
    const { newUrl, newHeaders } = api.provider(
      url,
      option?.queryParams,
      option?.body,
      option?.headers,
      option?.isByte
    );

    const isByte = option?.isByte || false;
    const response = await fetch(newUrl, {
      method: "POST",
      headers: newHeaders,
      body:
        option?.body instanceof FormData
          ? option.body
          : JSON.stringify(option?.body),
    });

    return await api.afterResponse(response, isByte);
  },

  put: async (
    url: string,
    option?: {
      queryParams?: Record<string, string>;
      body?: Record<any, any>;
      headers?: Record<string, string>;
      isByte?: boolean;
    }
  ) => {
    const { newUrl, newHeaders } = api.provider(
      url,
      option?.queryParams,
      option?.body,
      option?.headers
    );

    const isByte = option?.isByte || false;
    const response = await fetch(newUrl, {
      method: "PUT",
      headers: newHeaders,
      body:
        option?.body instanceof FormData
          ? option.body
          : JSON.stringify(option?.body),
    });

    return await api.afterResponse(response, isByte);
  },

  delete: async (
    url: string,
    option?: {
      queryParams?: Record<string, string>;
      body?: Record<any, any>;
      headers?: Record<string, string>;
      isByte?: boolean;
    }
  ) => {
    const { newUrl, newHeaders } = api.provider(
      url,
      option?.queryParams,
      option?.body,
      option?.headers
    );

    const isByte = option?.isByte || false;
    const response = await fetch(newUrl, {
      method: "DELETE",
      headers: newHeaders,
    });

    return await api.afterResponse(response, isByte);
  },
};
