import { useKeycloak } from "@react-keycloak/web";
import { hasRealmRole } from "../../lib/auth";

export function useOrganizerGate() {
  const { initialized, keycloak } = useKeycloak();

  const ready =
    initialized &&
    Boolean(keycloak.authenticated) &&
    hasRealmRole(keycloak.tokenParsed, "ORGANIZER");

  return {
    initialized,
    authenticated: Boolean(keycloak.authenticated),
    ready,
  };
}
