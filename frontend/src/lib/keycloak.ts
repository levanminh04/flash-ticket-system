import Keycloak from 'keycloak-js';

const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};

// @ts-expect-error
if (!window.__KEYCLOAK_INSTANCE__) {
  const kc = new Keycloak(keycloakConfig);
  // @ts-expect-error
  window.__KEYCLOAK_INSTANCE__ = kc;
}

// @ts-expect-error
const keycloak: Keycloak = window.__KEYCLOAK_INSTANCE__;

export default keycloak;