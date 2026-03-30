import axios from "axios";
import keycloak from "./keycloak";

function createClient(baseURL: string) {
  const client = axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });

  client.interceptors.request.use(
    async (config) => {
      if (keycloak && keycloak.authenticated) {
        if (keycloak.isTokenExpired(30)) {
          try {
            await keycloak.updateToken(30);
          } catch (error) {
            console.error("Loi refresh token", error);
          }
        }

        if (keycloak.token) {
          config.headers.Authorization = `Bearer ${keycloak.token}`;
        }
      }

      return config;
    },
    (error) => Promise.reject(error),
  );

  return client;
}

const gatewayBaseUrl = import.meta.env.VITE_API_GATEWAY_URL || "http://localhost:8080";
const coreBaseUrl = import.meta.env.DEV
  ? "/_core"
  : import.meta.env.VITE_CORE_SERVICE_URL || "http://localhost:8081";
const userBaseUrl = import.meta.env.DEV
  ? "/_user"
  : import.meta.env.VITE_USER_SERVICE_URL || "http://localhost:8082";

export const gatewayFallbackClient = createClient(gatewayBaseUrl);
export const coreDirectClient = createClient(coreBaseUrl);
export const userDirectClient = createClient(userBaseUrl);
